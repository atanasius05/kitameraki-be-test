/**
 * Endpoint: GetTask (GET)
 * ------------------------
 * HTTP Route   : GET /api/GetTask
 * Query Params : id             (WAJIB) - ID Task yang dicari
 *                organizationId (WAJIB) - Partition key
 * Response 200 : Object Task lengkap jika ditemukan
 * Response 404 : { error: "Task not found" } jika tidak ada
 * Response 400 : Jika salah satu query params hilang
 *
 * Response body:
 *   { ...Task } | { error: "Task not found" }
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getContainer } from "../utils/cosmos";
import { errorResponse, isErrorResponse, requireQueryParams, withErrorHandler } from "../utils/http";

/** Ambil satu task berdasarkan id + organizationId. */
async function _GetTask(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    // 1: Wajib ada id + organizationId di query string
    const params = requireQueryParams(request, ["id", "organizationId"]);
    if (isErrorResponse(params)) return params;

    // 2: Point read (operasi tercepat di Cosmos DB)
    const { resource: task } = await getContainer()
        .item(params.id, params.organizationId)
        .read();

    // 3: 404 jika task tidak ditemukan
    if (!task) {
        return errorResponse("Task not found", 404);
    }

    return { jsonBody: task, status: 200 };
}

export const GetTask = withErrorHandler(_GetTask);

/** Daftarkan endpoint GET GetTask ke Azure Functions Runtime. */
app.http('GetTask', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: GetTask
});