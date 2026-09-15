/**
 * Endpoint: BulkDeleteTasks (DELETE)
 * ------------------------------------
 * HTTP Route   : DELETE /api/BulkDeleteTasks
 * Query Params : organizationId (WAJIB) - Partition key
 * Request Body : JSON array of string IDs, e.g. ["uuid-1", "uuid-2"]
 * Response 200 : Semua berhasil dihapus
 * Response 207 : Sebagian ada yang gagal (lihat .details / .failedCount)
 * Response 400 : Body bukan array / kosong / item bukan string
 *
 * Response body:
 *   {
 *     message:       "Successfully deleted X of Y tasks",
 *     deletedCount:  number,
 *     failedCount:   number,
 *     details:       [{ id, success, error? }]
 *   }
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getContainer } from "../utils/cosmos";
import { isErrorResponse, parseJsonBody, requireQueryParams, withErrorHandler } from "../utils/http";

/** Hapus banyak task sekaligus berdasarkan daftar ID. */
async function _BulkDeleteTasks(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    // 1: Wajib ada organizationId (partition key untuk semua item)
    const params = requireQueryParams(request, ["organizationId"]);
    if (isErrorResponse(params)) return params;

    // 2: Body harus non-empty array of strings
    const body = await parseJsonBody<string[]>(request, context, (b) => {
        if (!Array.isArray(b)) return "Request body must be an array of task IDs";
        if (b.length === 0) return "No task IDs provided";
        if (b.some((id: any) => typeof id !== "string")) return "All task IDs must be strings";
        return null;
    });
    if (isErrorResponse(body)) return body;

    const container = getContainer();

    // 3: Delete paralel, error ditangani per-item agar partial success tetap OK
    const results = await Promise.all(body.map(async (id) => {
        try {
            await container.item(id, params.organizationId).delete();
            return { id, success: true };
        } catch (err: any) {
            context.log(`Failed to delete task ${id}:`, err.message);
            return { id, success: false, error: err.code === 404 ? "Not found" : err.message };
        }
    }));

    const deletedCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    // 4: 200 jika semua sukses, 207 Multi-Status jika ada kegagalan
    return {
        jsonBody: {
            message: `Successfully deleted ${deletedCount} of ${body.length} tasks`,
            deletedCount,
            failedCount,
            details: results
        },
        status: failedCount === 0 ? 200 : 207
    };
}

export const BulkDeleteTasks = withErrorHandler(_BulkDeleteTasks);

/** Endpoint DELETE BulkDeleteTasks ke Azure Functions Runtime. */
app.http('BulkDeleteTasks', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    handler: BulkDeleteTasks
});