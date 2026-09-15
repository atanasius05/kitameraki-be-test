/**
 * Endpoint: DeleteTask (DELETE)
 * ------------------------------
 * HTTP Route   : DELETE /api/DeleteTask
 * Query Params : id             (WAJIB) - ID Task yang akan dihapus
 *                organizationId (WAJIB) - Partition key
 * Response 200 : { message: "Task deleted successfully" }
 * Response 400 : Jika query params hilang
 * Response 404 : Jika Task tidak ditemukan (dilempar dari Cosmos SDK)
 *
 * Response body:
 *   { message: "Task deleted successfully" }
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getContainer } from "../utils/cosmos";
import { isErrorResponse, requireQueryParams, withErrorHandler } from "../utils/http";

/** Hapus satu task berdasarkan id + organizationId. */
async function _DeleteTask(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    // 1: Wajib ada id + organizationId
    const params = requireQueryParams(request, ["id", "organizationId"]);
    if (isErrorResponse(params)) return params;

    // 2: Delete dari Cosmos DB (404 otomatis ditangani withErrorHandler)
    await getContainer()
        .item(params.id, params.organizationId)
        .delete();

    return { jsonBody: { message: "Task deleted successfully" }, status: 200 };
}

export const DeleteTask = withErrorHandler(_DeleteTask);

/** Daftarkan endpoint DELETE DeleteTask ke Azure Functions Runtime. */
app.http('DeleteTask', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    handler: DeleteTask
});