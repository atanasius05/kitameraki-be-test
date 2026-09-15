/**
 * HTTP Utility Helpers
 * --------------------
 * Helper reusable untuk HTTP request/response di Azure Functions v4:
 * error response, global error handler, query params validator, JSON body parser.
 */

import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

/** Signature HTTP handler (dibungkus withErrorHandler). */
export type HttpHandler = (
    request: HttpRequest,
    context: InvocationContext
) => Promise<HttpResponseInit>;

/** Buat response error standar: { error: "<pesan>", status }. */
export function errorResponse(message: string, status: number = 400): HttpResponseInit {
    return { jsonBody: { error: message }, status };
}

/** Bungkus handler dengan global try/catch, mapping error.code ke HTTP status. */
export function withErrorHandler(handler: HttpHandler): HttpHandler {
    return async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        try {
            return await handler(request, context);
        } catch (error: any) {
            context.log("Unhandled error:", error);
            const errorCode = error?.code;
            if (errorCode === 404) {
                return errorResponse(error?.message || "Resource not found", 404);
            }
            if (typeof errorCode === "number" && errorCode >= 400 && errorCode < 500) {
                return errorResponse(error?.message || "Bad request", errorCode);
            }
            return errorResponse(error?.message || "Internal server error", 500);
        }
    };
}

/** Validasi query params wajib ada, return errorResponse(400) jika hilang. */
export function requireQueryParams(
    request: HttpRequest,
    params: string[]
): HttpResponseInit | Record<string, string> {
    const result: Record<string, string> = {};
    for (const param of params) {
        const value = request.query.get(param);
        if (!value) {
            return errorResponse(`Query parameter '${param}' is required`);
        }
        result[param] = value;
    }
    return result;
}

/** Type-guard: cek apakah object adalah response error. */
export function isErrorResponse(obj: any): obj is HttpResponseInit {
    return obj && typeof obj === "object" && "status" in obj && "jsonBody" in obj;
}

/** Parse JSON body + opsional validation callback. */
export async function parseJsonBody<T = any>(
    request: HttpRequest,
    context: InvocationContext,
    validate?: (body: any) => string | null
): Promise<HttpResponseInit | T> {
    let body: T;
    try {
        body = (await request.json()) as T;
    } catch (parseError) {
        context.log("Invalid JSON body:", parseError);
        return errorResponse("Invalid JSON body");
    }
    if (validate) {
        const err = validate(body);
        if (err) {
            return errorResponse(err);
        }
    }
    return body;
}