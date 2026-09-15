/**
 * Endpoint: GetTaskFormSettings (GET)
 * ------------------------------------
 * HTTP Route   : GET /api/GetTaskFormSettings
 * Query Params : id             (WAJIB) - ID Task
 *                organizationId (WAJIB) - Partition key
 * Response 200 : Config form gabungan (global + custom task + fallback legacy)
 * Response 404 : Task tidak ditemukan
 *
 * Response body:
 *   {
 *     result: "Success",
 *     code: 200,
 *     message: "...",
 *     data: { organizationId, taskId, fields: FormFieldConfig[], updatedAt }
 *   }
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getContainer } from "../utils/cosmos";
import { errorResponse, isErrorResponse, requireQueryParams, withErrorHandler } from "../utils/http";
import {
    adaptFieldsForFrontend,
    buildTaskFormFields,
    DEFAULT_FORM_FIELDS,
    FORM_SETTINGS_DOCUMENT_ID,
    FormFieldConfig,
    FormSettings,
    normalizeFormFields,
    Task,
} from "../taskApi";

/** Ubah key mentah ("bug_5", "custom_1234") jadi label readable ("Bug 5"). */
function keyToReadableLabel(key: string): string {
    return key
        .replace(/^custom_/i, "")
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim() || key;
}

/** Tebak tipe field dari value-nya. */
function guessTypeFromValue(val: unknown): FormFieldConfig["type"] {
    if (typeof val === "boolean") return "checkbox";
    if (typeof val === "number") return "number";
    if (typeof val === "string") {
        // Pola ISO date
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) return "date";
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return "date";
    }
    return "text";
}

/** Ambil config form spesifik task, gabungkan global + custom + fallback legacy. */
async function _GetTaskFormSettings(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    // 1: Wajib ada id + organizationId
    const params = requireQueryParams(request, ["id", "organizationId"]);
    if (isErrorResponse(params)) return params;
    const { id, organizationId } = params;

    const container = getContainer();

    // 2: Baca task
    const { resource: task } = await container
        .item(id, organizationId)
        .read<Task>();
    if (!task) {
        return errorResponse("Task not found", 404);
    }

    // 3: Baca form settings global (fallback DEFAULT jika belum ada)
    let globalFields = DEFAULT_FORM_FIELDS;
    let globalUpdatedAt: string | undefined;
    try {
        const { resource: savedSettings } = await container
            .item(FORM_SETTINGS_DOCUMENT_ID, organizationId)
            .read<FormSettings>();
        if (savedSettings && Array.isArray(savedSettings.fields)) {
            globalFields = normalizeFormFields(savedSettings.fields);
            globalUpdatedAt = savedSettings.updatedAt;
        }
    } catch (err: any) {
        if (err && err.code !== 404) {
            context.log("Error reading FormSettings from Cosmos:", err);
        }
    }

    // 4: Merge global + custom field definitions milik task
    const mergedFields = buildTaskFormFields(globalFields, task);

    // 5: Recover key legacy di task.customFields yang belum terwakili
    const normalizeKey = (k: string): string =>
        k.trim().toLowerCase().replace(/^custom_/, "");

    const existingFieldKeys = new Set<string>();
    for (const f of mergedFields) {
        if (typeof f.name === "string") existingFieldKeys.add(normalizeKey(f.name));
        if (f.id) existingFieldKeys.add(normalizeKey(f.id));
    }

    const taskCustomFields = task.customFields ?? {};
    const synthesizedFields: FormFieldConfig[] = [];
    for (const [key, val] of Object.entries(taskCustomFields)) {
        const nk = normalizeKey(key);
        if (existingFieldKeys.has(nk)) continue;
        if (val === null || val === undefined || val === "") continue;

        synthesizedFields.push({
            id: key,
            name: key,
            label: keyToReadableLabel(key),
            type: guessTypeFromValue(val),
            required: false,
            enabled: true,
            isDefault: false,
            colSpan: 1,
        });
        existingFieldKeys.add(nk);
    }

    // 6: Gabung + dedup final berdasarkan normalized key
    const allFields = [...mergedFields, ...synthesizedFields];
    const dedupedFinal = (() => {
        const out: FormFieldConfig[] = [];
        const seen = new Set<string>();
        for (const f of allFields) {
            const key = normalizeKey(f.name ?? f.id ?? "");
            if (!key || seen.has(key)) continue;
            seen.add(key);
            out.push(f);
        }
        return out;
    })();
    const finalFields = adaptFieldsForFrontend(dedupedFinal);

    return {
        status: 200,
        jsonBody: {
            result: "Success",
            code: 200,
            message: synthesizedFields.length > 0
                ? `Berhasil mengambil konfigurasi form (${synthesizedFields.length} field legacy di-recover dari data task)`
                : "Berhasil mengambil konfigurasi form untuk task",
            data: {
                organizationId,
                taskId: id,
                fields: finalFields,
                updatedAt: globalUpdatedAt ?? new Date().toISOString(),
            },
        },
    };
}

export const GetTaskFormSettings = withErrorHandler(_GetTaskFormSettings);

/** Daftarkan endpoint GET GetTaskFormSettings ke Azure Functions Runtime. */
app.http("GetTaskFormSettings", {
    methods: ["GET"],
    authLevel: "anonymous",
    handler: GetTaskFormSettings,
});