/**
 * Endpoint: InsertTask (POST)
 * ---------------------------
 * HTTP Route   : POST /api/InsertTask
 * Request Body : JSON Task + organizationId + title (wajib)
 * Response 201 : Task yang berhasil dibuat
 * Response 400 : Body tidak valid
 *
 * Response body:
 *   { ...Task }
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getContainer } from "../utils/cosmos";
import { isErrorResponse, parseJsonBody, withErrorHandler } from "../utils/http";
import {
    Task,
    buildTaskForCreate,
    extractCustomFieldDefinitions,
    remapCustomFieldsByFormFields,
    tryLoadFormSettingsFields,
    validateTaskInput,
    DEFAULT_FORM_FIELDS,
    normalizeFormFields,
    adaptFieldsForFrontend,
} from "../taskApi";

/** Buat task baru dengan snapshot definisi custom field. */
async function _InsertTask(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    // 1: Parse + validasi body
    const body = await parseJsonBody<Partial<Task> & { organizationId: string; title: string }>(
        request,
        context,
        (b) => validateTaskInput(b, true)
    );
    if (isErrorResponse(body)) return body;

    const container = getContainer();

    // 2: Load form settings global untuk remap + snapshot definisi
    const formFields = await tryLoadFormSettingsFields(container, body.organizationId);

    // 3: Remap key customFields jika form settings tersedia
    if ("customFields" in body && body.customFields !== undefined) {
        if (formFields && Array.isArray(formFields)) {
            body.customFields = remapCustomFieldsByFormFields(body.customFields, formFields);
        }
    }

    // 4: Snapshot definisi custom field (pakai dari frontend jika ada)
    let defs = Array.isArray((body as any).customFieldDefinitions)
        ? (body as any).customFieldDefinitions
        : undefined;

    if (!defs) {
        const normalized = formFields
            ? normalizeFormFields(formFields)
            : DEFAULT_FORM_FIELDS;
        const adapted = adaptFieldsForFrontend(normalized);
        defs = extractCustomFieldDefinitions(adapted);
    }

    // 5: Bangun task + simpan ke Cosmos DB
    const task = buildTaskForCreate({ ...body, customFieldDefinitions: defs });

    const { resource: createdTask } = await container.items.create(task);
    return { jsonBody: createdTask, status: 201 };
}

export const InsertTask = withErrorHandler(_InsertTask);

/** Daftarkan endpoint POST InsertTask ke Azure Functions Runtime. */
app.http('InsertTask', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: InsertTask
});