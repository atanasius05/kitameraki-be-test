/**
 * Endpoint: SaveFormSettings (POST)
 * ----------------------------------
 * HTTP Route   : POST /api/SaveFormSettings
 * Request Body : {
 *                  organizationId: string (WAJIB),
 *                  fields: FormFieldConfig[] (WAJIB),
 *                  updatedAt?: string
 *                }
 * Response 200 : Config diperbarui
 * Response 201 : Config baru dibuat
 * Response 400 : Validation error
 *
 * Response body:
 *   { result: "Success", code: 200|201, message: "...", data: FormSettings }
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getContainer } from "../utils/cosmos";
import { isErrorResponse, parseJsonBody, withErrorHandler } from "../utils/http";
import {
    adaptFieldsForFrontend,
    buildFormSettingsForUpsert,
    FormSettings,
    validateFormSettingsInput,
} from "../taskApi";

/** Simpan / update konfigurasi form Task via UPSERT. */
async function _SaveFormSettings(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    // 1: Parse + validasi body (organizationId + fields)
    const body = await parseJsonBody<{
        organizationId: string;
        fields: FormSettings["fields"];
        updatedAt?: string;
    }>(request, context, (b) => validateFormSettingsInput(b));
    if (isErrorResponse(body)) return body;

    // 2: Build FormSettings final (id tetap, updatedAt auto)
    const settings = buildFormSettingsForUpsert(body.organizationId, body.fields);

    // 3: UPSERT ke Cosmos DB (create atau replace)
    const { resource: saved, statusCode } = await getContainer()
        .items
        .upsert<FormSettings>(settings);

    // 4: Status Cosmos 201 = created, selain itu = replaced
    const httpStatus = statusCode === 201 ? 201 : 200;
    const message = statusCode === 201
        ? "Berhasil membuat konfigurasi form baru"
        : "Berhasil memperbarui konfigurasi form";

    // 5: Adaptasi fields agar property lengkap untuk frontend
    const responseData: FormSettings | undefined = saved
        ? { ...saved, fields: adaptFieldsForFrontend(saved.fields) }
        : saved;

    return {
        status: httpStatus,
        jsonBody: {
            result: "Success",
            code: httpStatus,
            message,
            data: responseData,
        },
    };
}

export const SaveFormSettings = withErrorHandler(_SaveFormSettings);

/** Daftarkan endpoint POST SaveFormSettings ke Azure Functions Runtime. */
app.http("SaveFormSettings", {
    methods: ["POST"],
    authLevel: "anonymous",
    handler: SaveFormSettings,
});