/**
 * Endpoint: UpdateTask (POST)
 * ---------------------------
 * HTTP Route   : POST /api/UpdateTask
 * Query Params : id             (WAJIB) - ID Task yang diupdate
 *                organizationId (WAJIB) - Partition key
 * Request Body : Partial<Task> (field yang ingin diupdate)
 * Response 200 : Task yang sudah diupdate
 * Response 400 : Tidak ada field valid untuk diupdate
 * Response 404 : Task tidak ditemukan
 *
 * Response body:
 *   { ...Task }
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getContainer } from "../utils/cosmos";
import { errorResponse, isErrorResponse, parseJsonBody, requireQueryParams, withErrorHandler } from "../utils/http";
import {
    buildPatchOperations,
    mergeCustomFields,
    mergeCustomFieldDefinitions,
    remapCustomFieldsByFormFields,
    tryLoadFormSettingsFields,
    validateTaskInput,
} from "../taskApi";

/** Update partial task via patch operations. */
async function _UpdateTask(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    // 1: Wajib ada id + organizationId
    const params = requireQueryParams(request, ["id", "organizationId"]);
    if (isErrorResponse(params)) return params;

    // 2: Parse + validasi body (partial update)
    const body = await parseJsonBody<Record<string, any>>(request, context, (b) => validateTaskInput(b, false));
    if (isErrorResponse(body)) return body;

    // 3: Baca task existing, 404 jika tidak ada
    const container = getContainer();
    const { resource: existing } = await container
        .item(params.id, params.organizationId)
        .read();
    if (!existing) {
        return errorResponse("Task not found", 404);
    }

    // 4: Remap key customFields (request + existing) pakai form settings
    const formFields = await tryLoadFormSettingsFields(container, params.organizationId);
    if ("customFields" in body) {
        if (formFields && Array.isArray(formFields)) {
            body.customFields = remapCustomFieldsByFormFields(body.customFields, formFields);
            if (existing.customFields) {
                existing.customFields = remapCustomFieldsByFormFields(existing.customFields, formFields);
            }
        }
    }

    // 5: Merge customFields (existing + incoming)
    if ("customFields" in body) {
        const merged = mergeCustomFields(existing.customFields, body.customFields);
        body.customFields = merged;
    }

    // 6: Merge customFieldDefinitions (lama + baru) agar definisi lama tidak hilang
    const existingDefs = Array.isArray(existing.customFieldDefinitions)
        ? existing.customFieldDefinitions
        : [];
    const incomingDefs = Array.isArray(body.customFieldDefinitions)
        ? body.customFieldDefinitions
        : [];
    if (existingDefs.length > 0 || incomingDefs.length > 0) {
        body.customFieldDefinitions = mergeCustomFieldDefinitions(incomingDefs, existingDefs);
    }

    // 7: Selalu update updatedAt
    body.updatedAt = new Date().toISOString();

    // 8: Bangun patch ops, tolak jika kosong
    const patchOps = buildPatchOperations(body);
    if (patchOps.length === 0) {
        return errorResponse("No valid fields provided to update");
    }

    // 9: Patch ke Cosmos DB
    const { resource: updatedTask } = await container
        .item(params.id, params.organizationId)
        .patch(patchOps);

    return { jsonBody: updatedTask, status: 200 };
}

export const UpdateTask = withErrorHandler(_UpdateTask);

/** Daftarkan endpoint POST UpdateTask ke Azure Functions Runtime. */
app.http('UpdateTask', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: UpdateTask
});