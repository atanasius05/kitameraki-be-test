/**
 * Endpoint: GetTasks (GET)
 * -------------------------
 * HTTP Route   : GET /api/GetTasks
 * Query Params : organizationId (WAJIB, UUID)
 *                page           (OPSIONAL, default 1)
 *                per_page       (OPSIONAL, default 5, max 100)
 *                search         (OPSIONAL)
 *                status         (OPSIONAL) - Todo | InProgress | Done
 *                priority       (OPSIONAL) - Low | Medium | High
 * Response 200 : Daftar task dengan pagination
 * Response 400 : Query param tidak valid
 *
 * Response body:
 *   {
 *     result: "Success",
 *     code: 200,
 *     message: "Berhasil mengambil data task",
 *     data: {
 *       data: Task[],
 *       pagination: { current_page, per_page, total_items, total_pages }
 *     }
 *   }
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getContainer } from "../utils/cosmos";
import { isErrorResponse, requireQueryParams, withErrorHandler } from "../utils/http";
import { FORM_SETTINGS_DOCUMENT_ID, type TaskStatus, type TaskPriority } from "../taskApi";
import type { SqlParameter } from "@azure/cosmos";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 5;
const MAX_PER_PAGE = 100;

const VALID_STATUSES_INPUT = ["Todo", "InProgress", "Done"] as const;
const VALID_PRIORITIES_INPUT = ["Low", "Medium", "High"] as const;

type StatusInput = (typeof VALID_STATUSES_INPUT)[number];
type PriorityInput = (typeof VALID_PRIORITIES_INPUT)[number];

const STATUS_INPUT_TO_DB: Record<StatusInput, TaskStatus> = {
    Todo: "todo",
    InProgress: "in-progress",
    Done: "completed",
};

const PRIORITY_INPUT_TO_DB: Record<PriorityInput, TaskPriority> = {
    Low: "low",
    Medium: "medium",
    High: "high",
};

/** Ambil task dengan pagination, search, dan filter status/priority. */
async function _GetTasks(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    // 1: Wajib ada organizationId (partition key)
    const params = requireQueryParams(request, ["organizationId"]);
    if (isErrorResponse(params)) return params;
    const organizationId = params.organizationId;

    // 2: Parse + validasi page
    const rawPage = request.query.get("page");
    let page = DEFAULT_PAGE;
    if (rawPage !== null) {
        const parsed = Number(rawPage);
        if (!Number.isInteger(parsed) || parsed < 1) {
            return {
                status: 400,
                jsonBody: { result: "Error", code: 400, message: "page must be a positive integer" }
            };
        }
        page = parsed;
    }

    // 3: Parse + validasi per_page
    const rawPerPage = request.query.get("per_page");
    let perPage = DEFAULT_PER_PAGE;
    if (rawPerPage !== null) {
        const parsed = Number(rawPerPage);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_PER_PAGE) {
            return {
                status: 400,
                jsonBody: {
                    result: "Error",
                    code: 400,
                    message: `per_page must be an integer between 1 and ${MAX_PER_PAGE}`
                }
            };
        }
        perPage = parsed;
    }

    // 4: Parse + validasi status
    const rawStatus = request.query.get("status");
    let statusFilter: TaskStatus | undefined;
    if (rawStatus && rawStatus !== "all") {
        if (!VALID_STATUSES_INPUT.includes(rawStatus as StatusInput)) {
            return {
                status: 400,
                jsonBody: {
                    result: "Error",
                    code: 400,
                    message: `status must be one of: ${VALID_STATUSES_INPUT.join(", ")}`
                }
            };
        }
        statusFilter = STATUS_INPUT_TO_DB[rawStatus as StatusInput];
    }

    // 5: Parse + validasi priority
    const rawPriority = request.query.get("priority");
    let priorityFilter: TaskPriority | undefined;
    if (rawPriority && rawPriority !== "all") {
        if (!VALID_PRIORITIES_INPUT.includes(rawPriority as PriorityInput)) {
            return {
                status: 400,
                jsonBody: {
                    result: "Error",
                    code: 400,
                    message: `priority must be one of: ${VALID_PRIORITIES_INPUT.join(", ")}`
                }
            };
        }
        priorityFilter = PRIORITY_INPUT_TO_DB[rawPriority as PriorityInput];
    }

    // 6: Parse + validasi search
    const rawSearch = request.query.get("search");
    let searchFilter: string | undefined;
    if (rawSearch) {
        const trimmed = rawSearch.trim();
        if (trimmed.length > 200) {
            return {
                status: 400,
                jsonBody: { result: "Error", code: 400, message: "search query too long (max 200 characters)" }
            };
        }
        if (trimmed.length > 0) searchFilter = trimmed;
    }

    // 7: Bangun WHERE dinamis (shared untuk count & data)
    const conditions: string[] = [
        "c.organizationId = @organizationId",
        "c.id != @excludeFormSettingsId"
    ];
    const parameters: SqlParameter[] = [
        { name: "@organizationId", value: organizationId },
        { name: "@excludeFormSettingsId", value: FORM_SETTINGS_DOCUMENT_ID }
    ];

    if (statusFilter) {
        conditions.push("c.status = @status");
        parameters.push({ name: "@status", value: statusFilter });
    }

    if (priorityFilter) {
        conditions.push("c.priority = @priority");
        parameters.push({ name: "@priority", value: priorityFilter });
    }

    if (searchFilter) {
        conditions.push(
            `(CONTAINS(LOWER(c.title), LOWER(@search)) 
           OR CONTAINS(LOWER(c.description), LOWER(@search)) 
           OR CONTAINS(LOWER(c.assignee), LOWER(@search)))`
        );
        parameters.push({ name: "@search", value: searchFilter });
    }

    const whereClause = conditions.join(" AND ");

    // 8: Hitung total items dengan filter yang sama
    const countQuery = `SELECT VALUE COUNT(1) FROM c WHERE ${whereClause}`;
    const countIterator = getContainer()
        .items
        .query<number>({ query: countQuery, parameters });

    const { resources: countResources } = await countIterator.fetchNext();
    const totalItems = countResources[0] ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / perPage));

    // 9: Ambil data dengan OFFSET + LIMIT
    const offset = (page - 1) * perPage;
    const dataQuery = `
    SELECT c.id, c.organizationId, c.title, c.description, c.dueDate,
           c.priority, c.status, c.tags, c.customFields,
           c.createdAt, c.updatedAt
    FROM c 
    WHERE ${whereClause} 
    ORDER BY c.createdAt DESC 
    OFFSET ${offset} LIMIT ${perPage}
`;

    const dataIterator = getContainer()
        .items
        .query({ query: dataQuery, parameters });

    const { resources: tasks } = await dataIterator.fetchNext();

    // 10: Return dengan envelope format
    return {
        status: 200,
        jsonBody: {
            result: "Success",
            code: 200,
            message: "Berhasil mengambil data task",
            data: {
                data: tasks,
                pagination: {
                    current_page: page,
                    per_page: perPage,
                    total_items: totalItems,
                    total_pages: totalPages
                }
            }
        }
    };
}

export const GetTasks = withErrorHandler(_GetTasks);

/** Daftarkan endpoint GET GetTasks ke Azure Functions Runtime. */
app.http("GetTasks", {
    methods: ["GET"],
    authLevel: "anonymous",
    handler: GetTasks
});