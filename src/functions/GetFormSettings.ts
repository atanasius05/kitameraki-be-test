/**
 * Endpoint: GetFormSettings (GET)
 * --------------------------------
 * HTTP Route   : GET /api/GetFormSettings
 * Query Params : organizationId (WAJIB) - Partition key
 * Response 200 : Config custom tersimpan, atau DEFAULT_FORM_FIELDS jika belum ada
 *
 * Response body:
 *   {
 *     result: "Success",
 *     code: 200,
 *     message: "...",
 *     data: { organizationId, fields: FormFieldConfig[], updatedAt }
 *   }
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getContainer } from "../utils/cosmos";
import { isErrorResponse, requireQueryParams, withErrorHandler } from "../utils/http";
import {
    adaptFieldsForFrontend,
    DEFAULT_FORM_FIELDS,
    FORM_SETTINGS_DOCUMENT_ID,
    FormSettings,
    normalizeFormFields,
} from "../taskApi";

/** Ambil konfigurasi form Task untuk satu organisasi, fallback ke default. */
async function _GetFormSettings(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    // 1: Wajib ada organizationId (partition key)
    const params = requireQueryParams(request, ["organizationId"]);
    if (isErrorResponse(params)) return params;
    const organizationId = params.organizationId;

    // 2: Baca dokumen form_settings dari Cosmos DB
    let savedSettings: FormSettings | null = null;
    try {
        const { resource } = await getContainer()
            .item(FORM_SETTINGS_DOCUMENT_ID, organizationId)
            .read<FormSettings>();
        savedSettings = resource || null;
    } catch (err: any) {
        // 404 = dokumen belum ada, lanjut ke default
        if (err && err.code !== 404) {
            context.log("Error reading FormSettings from Cosmos:", err);
        }
    }

    // 3: Normalisasi + adaptasi fields agar frontend tidak error
    const rawFields = savedSettings?.fields ?? DEFAULT_FORM_FIELDS;
    const normalizedFields = savedSettings ? normalizeFormFields(rawFields) : rawFields;
    const finalFields = adaptFieldsForFrontend(normalizedFields);
    const finalUpdatedAt = savedSettings?.updatedAt ?? new Date().toISOString();

    return {
        status: 200,
        jsonBody: {
            result: "Success",
            code: 200,
            message: savedSettings
                ? "Berhasil mengambil konfigurasi form"
                : "Menggunakan konfigurasi form default",
            data: {
                organizationId,
                fields: finalFields,
                updatedAt: finalUpdatedAt,
            },
        },
    };
}

export const GetFormSettings = withErrorHandler(_GetFormSettings);

/** Daftarkan endpoint GET GetFormSettings ke Azure Functions Runtime. */
app.http("GetFormSettings", {
    methods: ["GET"],
    authLevel: "anonymous",
    handler: GetFormSettings,
});