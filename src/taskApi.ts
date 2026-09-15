import { randomUUID } from "crypto";
import { PatchOperation } from "@azure/cosmos";

export type TaskStatus = "todo" | "in-progress" | "completed";

export type TaskPriority = "low" | "medium" | "high";

export interface TaskCustomFieldDefinition {
    name: string;
    label: string;
    type: FormFieldType;
    required: boolean;
    placeholder?: string;
    options?: Array<{ label: string; value: string }>;
    defaultValue?: any;
    colSpan?: 1 | 2;
}

export interface Task {
    id: string;
    organizationId: string;
    title: string;
    description?: string;
    dueDate?: string;
    priority?: TaskPriority;
    status: TaskStatus;
    tags?: string[];
    customFields?: Record<string, any>;
    customFieldDefinitions?: TaskCustomFieldDefinition[];
    createdAt?: string;
    updatedAt?: string;
}

const VALID_STATUSES: TaskStatus[] = ["todo", "in-progress", "completed"];

const VALID_PRIORITIES: TaskPriority[] = ["low", "medium", "high"];

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const TITLE_MIN_LENGTH = 1;

export function validateTaskInput(data: any, forCreate = true): string | null {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return "Request body must be a non-empty object";
    }

    if (!forCreate && Object.keys(data).length === 0) {
        return "No fields provided to update";
    }

    const ALLOWED = new Set([
        "id", "organizationId", "title", "description",
        "dueDate", "priority", "status", "tags", "customFields",
        "customFieldDefinitions"
    ]);
    for (const key of Object.keys(data)) {
        if (!ALLOWED.has(key)) {
            return `Unknown field '${key}' is not allowed`;
        }
    }

    if (forCreate) {
        if (data.id !== undefined && (typeof data.id !== "string" || !UUID_REGEX.test(data.id))) {
            return "Field 'id' must be a valid UUID if provided";
        }
    }

    if (data.organizationId !== undefined) {
        if (typeof data.organizationId !== "string" || !UUID_REGEX.test(data.organizationId)) {
            return "Field 'organizationId' must be a valid UUID";
        }
    }
    if (forCreate && !data.organizationId) {
        return "Field 'organizationId' is required";
    }

    if (data.title !== undefined) {
        if (typeof data.title !== "string") return "Field 'title' must be a string";
        const trimmedTitle = data.title.trim();
        data.title = trimmedTitle;
        if (trimmedTitle.length === 0) {
            return "Field 'title' cannot be empty or whitespace-only";
        }
        if (trimmedTitle.length < TITLE_MIN_LENGTH) {
            return `Field 'title' min length is ${TITLE_MIN_LENGTH} character(s)`;
        }
        if (trimmedTitle.length > 100) {
            return "Field 'title' max length is 100 characters";
        }
    }
    if (forCreate) {
        const t = typeof data.title === "string" ? data.title : "";
        if (t.length === 0) return "Field 'title' is required";
    }

    if (data.description !== undefined) {
        if (typeof data.description !== "string") return "Field 'description' must be a string";
        const trimmedDesc = data.description.trim();
        if (trimmedDesc.length === 0) {
            delete data.description;
        } else {
            if (trimmedDesc.length > 1000) {
                return "Field 'description' max length is 1000 characters";
            }
            data.description = trimmedDesc;
        }
    }

    if (data.dueDate !== undefined && data.dueDate !== null) {
        if (typeof data.dueDate !== "string") return "Field 'dueDate' must be a ISO date string";
        const d = new Date(data.dueDate);
        if (isNaN(d.getTime())) return "Field 'dueDate' is not a valid date";
    }

    if (data.priority !== undefined && data.priority !== null) {
        if (!VALID_PRIORITIES.includes(data.priority)) {
            return `Field 'priority' must be one of: ${VALID_PRIORITIES.join(", ")}`;
        }
    }

    if (data.status !== undefined && data.status !== null) {
        if (!VALID_STATUSES.includes(data.status)) {
            return `Field 'status' must be one of: ${VALID_STATUSES.join(", ")}`;
        }
    }

    if (data.tags !== undefined && data.tags !== null) {
        if (!Array.isArray(data.tags)) return "Field 'tags' must be an array of strings";
        const cleanedTags: string[] = [];
        for (const rawTag of data.tags) {
            if (typeof rawTag !== "string") return "All items in 'tags' must be strings";
            const trimmedTag = rawTag.trim();
            if (trimmedTag.length === 0) continue;
            if (trimmedTag.length > 50) return "Each 'tags' item max length is 50 characters";
            cleanedTags.push(trimmedTag);
        }
        data.tags = cleanedTags;
    }

    if (data.customFields !== undefined) {
        if (data.customFields !== null &&
            (typeof data.customFields !== "object" || Array.isArray(data.customFields))) {
            return "Field 'customFields' must be a plain object (key-value pairs)";
        }
        if (data.customFields !== null) {
            const keys = Object.keys(data.customFields);
            if (keys.length > 50) return "Field 'customFields' max 50 keys";
            for (const k of keys) {
                if (k.length === 0) {
                    delete data.customFields[k];
                    continue;
                }
                if (k.length > 50) return `customFields key '${k}' max 50 characters`;
                const v = data.customFields[k];
                if (v === null || v === undefined) continue;
                if (typeof v === "string") {
                    const trimmedV = v.trim();
                    if (trimmedV.length > 2000) return `customFields['${k}'] string max 2000 characters`;
                    data.customFields[k] = trimmedV;
                }
            }
        }
    }

    if (data.customFieldDefinitions !== undefined && data.customFieldDefinitions !== null) {
        if (!Array.isArray(data.customFieldDefinitions)) {
            return "Field 'customFieldDefinitions' must be an array";
        }
        const VALID_DEF_TYPES: FormFieldType[] = [
            "text", "textarea", "number", "date",
            "select", "multiselect", "checkbox", "radio", "tags",
        ];
        for (let i = 0; i < data.customFieldDefinitions.length; i++) {
            const d = data.customFieldDefinitions[i];
            if (!d || typeof d !== "object" || Array.isArray(d)) {
                return `customFieldDefinitions[${i}] must be an object`;
            }
            if (typeof d.name !== "string" || d.name.trim().length === 0) {
                return `customFieldDefinitions[${i}].name is required`;
            }
            if (d.name.length > 50) {
                return `customFieldDefinitions[${i}].name max 50 characters`;
            }
            if (d.type !== undefined && !VALID_DEF_TYPES.includes(d.type)) {
                return `customFieldDefinitions[${i}].type is invalid`;
            }
        }
    }
    return null;
}

export function buildTaskForCreate(input: Partial<Task> & { organizationId: string; title: string }): Task {
    const safeTitle = typeof input.title === "string" ? input.title.trim() : input.title;
    const safeDesc = typeof input.description === "string" && input.description.trim().length > 0
        ? input.description.trim()
        : undefined;
    const safeTags = Array.isArray(input.tags)
        ? input.tags
            .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
            .map((t) => t.trim())
        : [];
    const safeCustomFields: Record<string, any> = {};
    if (input.customFields && typeof input.customFields === "object" && !Array.isArray(input.customFields)) {
        for (const [k, v] of Object.entries(input.customFields)) {
            if (!k || k.length === 0 || k.length > 50) continue;
            safeCustomFields[k] = typeof v === "string" ? v.trim() : v;
        }
    }

    const now = new Date().toISOString();

    const safeDefs: TaskCustomFieldDefinition[] = [];
    if (Array.isArray(input.customFieldDefinitions)) {
        for (const d of input.customFieldDefinitions) {
            if (!d || typeof d.name !== "string" || d.name.length === 0) continue;
            safeDefs.push({
                name: d.name,
                label: typeof d.label === "string" ? d.label : d.name,
                type: (d.type ?? "text") as FormFieldType,
                required: d.required === true,
                placeholder: d.placeholder,
                options: Array.isArray(d.options) ? d.options : undefined,
                defaultValue: d.defaultValue,
                colSpan: d.colSpan === 2 ? 2 : 1,
            });
        }
    }

    return {
        id: input.id || randomUUID(),
        organizationId: input.organizationId,
        title: safeTitle,
        description: safeDesc,
        dueDate: input.dueDate,
        priority: input.priority,
        status: input.status || "todo",
        tags: safeTags,
        customFields: Object.keys(safeCustomFields).length > 0 ? safeCustomFields : {},
        customFieldDefinitions: safeDefs,
        createdAt: now,
        updatedAt: now,
    };
}

export function buildPatchOperations(data: Record<string, any>): PatchOperation[] {
    const ops: PatchOperation[] = [];
    for (const key of Object.keys(data)) {
        const rawVal = data[key];
        let finalVal = rawVal;

        if (key === "title" && typeof rawVal === "string") {
            const trimmed = rawVal.trim();
            if (trimmed.length === 0) continue;
            finalVal = trimmed;
        } else if (key === "description" && typeof rawVal === "string") {
            const trimmed = rawVal.trim();
            if (trimmed.length === 0) {
                continue;
            }
            if (trimmed.length > 1000) continue;
            finalVal = trimmed;
        } else if (key === "tags" && Array.isArray(rawVal)) {
            const cleaned = rawVal
                .filter((t: any): t is string => typeof t === "string" && t.trim().length > 0 && t.trim().length <= 50)
                .map((t: string) => t.trim());
            finalVal = cleaned;
        } else if (key === "customFields" && rawVal && typeof rawVal === "object" && !Array.isArray(rawVal)) {
            const cleaned: Record<string, any> = {};
            for (const [k, v] of Object.entries(rawVal)) {
                if (!k || k.length === 0 || k.length > 50) continue;
                cleaned[k] = typeof v === "string" ? v.trim() : v;
            }
            finalVal = cleaned;
        } else if (key === "customFieldDefinitions" && Array.isArray(rawVal)) {
            const cleaned: TaskCustomFieldDefinition[] = [];
            for (const d of rawVal) {
                if (!d || typeof d.name !== "string" || d.name.length === 0) continue;
                cleaned.push({
                    name: d.name,
                    label: typeof d.label === "string" ? d.label : d.name,
                    type: (d.type ?? "text") as FormFieldType,
                    required: d.required === true,
                    placeholder: d.placeholder,
                    options: Array.isArray(d.options) ? d.options : undefined,
                    defaultValue: d.defaultValue,
                    colSpan: d.colSpan === 2 ? 2 : 1,
                });
            }
            finalVal = cleaned;
        }

        ops.push({
            op: "replace",
            path: `/${key}`,
            value: finalVal,
        });
    }
    return ops;
}

export function mergeCustomFields(
    existingCustomFields: Record<string, any> | undefined | null,
    incomingCustomFields: Record<string, any> | undefined | null
): Record<string, any> {
    const merged: Record<string, any> = {};
    if (existingCustomFields && typeof existingCustomFields === "object" && !Array.isArray(existingCustomFields)) {
        for (const [k, v] of Object.entries(existingCustomFields)) {
            merged[k] = v;
        }
    }

    if (!incomingCustomFields || typeof incomingCustomFields !== "object" || Array.isArray(incomingCustomFields)) {
        return merged;
    }

    for (const [k, rawVal] of Object.entries(incomingCustomFields)) {
        if (!k || typeof k !== "string" || k.length === 0 || k.length > 50) continue;

        if (rawVal === undefined) continue;

        if (rawVal === null) {
            delete merged[k];
            continue;
        }

        const finalVal = typeof rawVal === "string" ? rawVal.trim() : rawVal;
        merged[k] = finalVal;
    }

    return merged;
}

export function remapCustomFieldsByFormFields(
    customFieldsIn: Record<string, any> | undefined | null,
    formFields: FormFieldConfig[]
): Record<string, any> {
    if (!customFieldsIn || typeof customFieldsIn !== "object" || Array.isArray(customFieldsIn)) {
        return customFieldsIn as Record<string, any>;
    }

    const keyMap = new Map<string, string>();
    if (Array.isArray(formFields)) {
        for (const ff of formFields) {
            if (!ff || typeof (ff as any).name !== "string") continue;
            const correctKey: string = (ff as any).name.trim();
            if (correctKey.length === 0) continue;
            if (typeof (ff as any).id === "string") {
                const idV: string = (ff as any).id.trim();
                if (idV !== correctKey) keyMap.set(idV, correctKey);
                const stripped = idV.replace(/^custom_/i, "");
                if (stripped && stripped !== correctKey) keyMap.set(stripped, correctKey);
            }
            if (!keyMap.has(correctKey)) keyMap.set(correctKey, correctKey);
        }
    }

    if (keyMap.size === 0) {
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(customFieldsIn)) out[k] = v;
        return out;
    }

    const remapped: Record<string, any> = {};
    for (const [k, v] of Object.entries(customFieldsIn)) {
        const newKey = keyMap.get(k) ?? k;
        remapped[newKey] = v;
    }
    return remapped;
}

export async function tryLoadFormSettingsFields(
    container: {
        item: (id: string, partition: string) => {
            read: () => Promise<{ resource: any }>;
        };
    },
    organizationId: string
): Promise<FormFieldConfig[] | null> {
    try {
        if (!organizationId || typeof organizationId !== "string") return null;
        const { resource: formDoc } = await container
            .item(FORM_SETTINGS_DOCUMENT_ID, organizationId)
            .read();
        if (!formDoc || !Array.isArray(formDoc.fields)) return null;
        const normalized = normalizeFormFields(formDoc.fields);
        return normalized;
    } catch (_err) {
        return null;
    }
}

export type FormFieldType =
    | "text"
    | "textarea"
    | "number"
    | "date"
    | "select"
    | "multiselect"
    | "checkbox"
    | "radio"
    | "tags";

export interface FormFieldConfig {
    name: string;
    label: string;
    type: FormFieldType;
    required: boolean;
    placeholder?: string;
    options?: Array<{ label: string; value: string }>;
    defaultValue?: any;
    enabled?: boolean;
    order?: number;
    id?: string;
    isDefault?: boolean;
    colSpan?: 1 | 2;
}

export interface FormSettings {
    id: string;
    organizationId: string;
    fields: FormFieldConfig[];
    updatedAt: string;
}

export const DEFAULT_FORM_FIELDS: FormFieldConfig[] = [
    {
        id: "title",
        name: "title",
        label: "Title",
        type: "text",
        required: true,
        placeholder: "Masukkan judul task...",
        order: 1,
        enabled: true,
        isDefault: true,
        colSpan: 2,
    },
    {
        id: "status",
        name: "status",
        label: "Status",
        type: "text",
        required: false,
        order: 2,
        enabled: true,
        isDefault: true,
        colSpan: 1,
    },
    {
        id: "priority",
        name: "priority",
        label: "Priority",
        type: "text",
        required: false,
        order: 3,
        enabled: true,
        isDefault: true,
        colSpan: 1,
    },
    {
        id: "dueDate",
        name: "dueDate",
        label: "Due Date",
        type: "date",
        required: false,
        order: 4,
        enabled: true,
        isDefault: true,
        colSpan: 1,
    },
    {
        id: "assignee",
        name: "assignee",
        label: "Assignee",
        type: "text",
        required: false,
        placeholder: "Masukkan nama penanggung jawab...",
        order: 5,
        enabled: true,
        isDefault: true,
        colSpan: 1,
    },
    {
        id: "description",
        name: "description",
        label: "Description",
        type: "text",
        required: false,
        placeholder: "Deskripsikan detail task...",
        order: 6,
        enabled: true,
        isDefault: true,
        colSpan: 2,
    },
];

export const FORM_SETTINGS_DOCUMENT_ID = "form_settings";

export function buildFormSettingsForUpsert(
    organizationId: string,
    fields: FormFieldConfig[]
): FormSettings {
    return {
        id: FORM_SETTINGS_DOCUMENT_ID,
        organizationId,
        fields,
        updatedAt: new Date().toISOString(),
    };
}

export function normalizeFormFields(fields: unknown): FormFieldConfig[] {
    if (!Array.isArray(fields) || fields.length === 0) {
        return DEFAULT_FORM_FIELDS;
    }
    for (let i = 0; i < fields.length; i++) {
        const f: any = fields[i];
        if (!f || typeof f !== "object" || Array.isArray(f)) return DEFAULT_FORM_FIELDS;
        if (typeof f.name !== "string" || f.name.trim().length === 0) return DEFAULT_FORM_FIELDS;
        if (typeof f.label !== "string" || f.label.trim().length === 0) return DEFAULT_FORM_FIELDS;
        if (typeof f.type !== "string") return DEFAULT_FORM_FIELDS;
        if (typeof f.required !== "boolean") return DEFAULT_FORM_FIELDS;
    }
    return fields as FormFieldConfig[];
}

const DEFAULT_FIELD_NAMES: string[] = (() => {
    const set: Set<string> = new Set();
    for (const f of DEFAULT_FORM_FIELDS) set.add(f.name);
    return Array.from(set);
})();

const DEFAULT_COL_SPAN: Record<string, 1 | 2> = {
    title: 2,
    status: 1,
    priority: 1,
    dueDate: 1,
    assignee: 1,
    description: 2,
};

export function adaptFieldsForFrontend(fields: FormFieldConfig[]): FormFieldConfig[] {
    const usedNames: Set<string> = new Set();

    return fields.map((raw, idx) => {
        const f: any = { ...raw };
        const orderVal = idx + 1;
        const hasId = typeof f.id === "string" && (f.id as string).trim().length > 0;
        const idStr = hasId ? (f.id as string).trim() : "";
        const strippedId = idStr.replace(/^custom_/, "");
        const looksLikeTempCustomId =
            hasId &&
            (/^custom_/i.test(idStr) ||
                /^\d+$/.test(strippedId) ||
                strippedId.length >= 10);
        const looksLikeUglyName =
            typeof f.name === "string" &&
            (/^\d+$/.test((f.name as string).trim()) ||
                (f.name as string).trim().length >= 10 && /^\d/.test((f.name as string).trim()));

        if (
            typeof f.name !== "string" ||
            f.name.trim().length === 0 ||
            looksLikeTempCustomId ||
            looksLikeUglyName
        ) {
            if (typeof f.label === "string" && f.label.trim().length > 0) {
                f.name = toSlugName(f.label);
            } else if (hasId && KNOWN_ID_TO_NAME[strippedId]) {
                f.name = KNOWN_ID_TO_NAME[strippedId];
            } else if (hasId && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(strippedId)) {
                f.name = strippedId;
            } else {
                f.name = hasId ? toSlugName(idStr) : toSlugName(`field_${orderVal}`);
            }
        }
        f.name = (f.name as string).trim();
        if (f.name.length > 50) f.name = f.name.slice(0, 50).replace(/^_+|_+$/g, "");

        let finalName = f.name as string;
        let sfx = 2;
        while (usedNames.has(finalName.toLowerCase())) {
            const base = (f.name as string).slice(0, 47);
            finalName = `${base}_${sfx}`;
            sfx++;
            if (sfx > 999) break;
        }
        usedNames.add(finalName.toLowerCase());
        f.name = finalName;
        if (typeof f.label !== "string" || f.label.trim().length === 0) {
            f.label = f.name;
        } else {
            f.label = f.label.trim();
        }
        const VALID_TYPES: FormFieldType[] = [
            "text", "textarea", "number", "date",
            "select", "multiselect", "checkbox", "radio", "tags",
        ];
        if (typeof f.type !== "string" || !VALID_TYPES.includes(f.type)) {
            f.type = "text";
        }
        if (typeof f.required !== "boolean") f.required = false;
        if (typeof f.enabled !== "boolean") f.enabled = true;
        if (typeof f.order !== "number") f.order = orderVal;
        if (typeof f.id !== "string" || f.id.trim().length === 0) {
            f.id = f.name;
        }
        if (typeof f.isDefault !== "boolean") {
            f.isDefault = DEFAULT_FIELD_NAMES.includes(f.name);
        }
        if (f.colSpan !== 1 && f.colSpan !== 2) {
            f.colSpan = DEFAULT_COL_SPAN[f.name] ?? 1;
        }
        return f as FormFieldConfig;
    });
}

function toSlugName(input: string): string {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

const KNOWN_ID_TO_NAME: Record<string, string> = {
    title: "title",
    status: "status",
    priority: "priority",
    description: "description",
    desc: "description",
    dueDate: "dueDate",
    due_date: "dueDate",
    deadline: "dueDate",
    assignee: "assignee",
    tags: "tags",
};

export function validateFormSettingsInput(data: any): string | null {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return "Request body must be a non-empty object";
    }

    if (!data.organizationId || typeof data.organizationId !== "string") {
        return "Field 'organizationId' is required and must be a string";
    }

    if (!Array.isArray(data.fields)) {
        return "Field 'fields' is required and must be an array";
    }

    if (data.fields.length === 0) {
        return "Field 'fields' cannot be empty";
    }

    const VALID_TYPES: FormFieldType[] = [
        "text", "textarea", "number", "date",
        "select", "multiselect", "checkbox", "radio", "tags"
    ];

    const usedNames: Set<string> = new Set();

    for (let i = 0; i < data.fields.length; i++) {
        const field = data.fields[i];
        const pos = i + 1;

        if (!field || typeof field !== "object" || Array.isArray(field)) {
            return `Field config at position ${pos} must be an object (not null/array)`;
        }

        if (typeof field.label !== "string") {
            return `Field config at position ${pos}: 'label' is required (string)`;
        }
        field.label = field.label.trim();
        if (field.label.length === 0) {
            return `Field config at position ${pos}: 'label' is required (non-empty string)`;
        }

        if (typeof field.type !== "string" || !VALID_TYPES.includes(field.type as FormFieldType)) {
            return `Field config at position ${pos}: 'type' must be one of: ${VALID_TYPES.join(", ")}`;
        }

        if (typeof field.required !== "boolean") {
            if (field.required === undefined || field.required === null) {
                field.required = false;
            } else {
                return `Field config at position ${pos}: 'required' must be a boolean`;
            }
        }

        if (typeof field.name !== "string" || field.name.trim().length === 0) {
            let candidateName: string | null = null;
            const hasValidId = typeof field.id === "string" && field.id.trim().length > 0;
            const idStr: string = hasValidId ? (field.id as string).trim() : "";
            const strippedId = hasValidId ? idStr.replace(/^custom_/, "") : "";
            const isCustomFieldId =
                hasValidId &&
                (/^custom_/i.test(idStr) ||
                    /^\d+$/.test(strippedId) ||
                    strippedId.length >= 10);

            if (isCustomFieldId) {
                candidateName = toSlugName(field.label);
            }

            if (!candidateName && hasValidId && KNOWN_ID_TO_NAME[strippedId]) {
                candidateName = KNOWN_ID_TO_NAME[strippedId];
            }

            if (!candidateName && hasValidId && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(strippedId)) {
                candidateName = strippedId;
            }

            if (!candidateName) {
                candidateName = toSlugName(field.label);
            }
            if (!candidateName) {
                return `Field config at position ${pos}: 'name' is required (non-empty string)`;
            }
            if (candidateName.length > 50) {
                candidateName = candidateName.slice(0, 50).replace(/^_+|_+$/g, "");
            }
            field.name = candidateName;
        } else {
            field.name = field.name.trim();
            if (field.name.length > 50) {
                return `Field config at position ${pos}: 'name' max 50 characters`;
            }
        }

        if (typeof field.id !== "string" || field.id.trim().length === 0) {
            field.id = field.name;
        }

        if (field.enabled === undefined || field.enabled === null) {
            field.enabled = true;
        }

        if (typeof field.order !== "number") {
            field.order = i + 1;
        }

        if (typeof field.isDefault !== "boolean") {
            field.isDefault = false;
        }

        if (field.colSpan !== undefined && field.colSpan !== 1 && field.colSpan !== 2) {
            field.colSpan = field.colSpan === 2 ? 2 : 1;
        }
        if (typeof field.colSpan !== "number") {
            field.colSpan = 1;
        }

        let finalName = field.name as string;
        let suffixCounter = 2;
        while (usedNames.has(finalName.toLowerCase())) {
            const baseName = (field.name as string).slice(0, 47);
            finalName = `${baseName}_${suffixCounter}`;
            suffixCounter++;
            if (suffixCounter > 999) break;
        }
        usedNames.add(finalName.toLowerCase());
        field.name = finalName;

        if (field.options !== undefined) {
            if (!Array.isArray(field.options)) {
                return `Field config at position ${pos}: 'options' must be an array`;
            }
            for (const opt of field.options) {
                if (!opt || typeof opt.label !== "string" || typeof opt.value !== "string") {
                    return `Field config at position ${pos}: each option must have string 'label' and 'value'`;
                }
            }
        }
    }

    return null;
}

export function extractCustomFieldDefinitions(
    formFields: FormFieldConfig[]
): TaskCustomFieldDefinition[] {
    if (!Array.isArray(formFields)) return [];
    const defaults = new Set(DEFAULT_FIELD_NAMES);
    const result: TaskCustomFieldDefinition[] = [];
    for (const f of formFields) {
        if (!f || typeof f.name !== "string") continue;
        if (defaults.has(f.name)) continue;
        if (f.enabled === false) continue;
        result.push({
            name: f.name,
            label: f.label,
            type: f.type,
            required: f.required === true,
            placeholder: f.placeholder,
            options: f.options,
            defaultValue: f.defaultValue,
            colSpan: f.colSpan,
        });
    }
    return result;
}

export function mergeCustomFieldDefinitions(
    primary: TaskCustomFieldDefinition[] | undefined,
    secondary: TaskCustomFieldDefinition[] | undefined
): TaskCustomFieldDefinition[] {
    const map = new Map<string, TaskCustomFieldDefinition>();
    for (const d of secondary ?? []) {
        if (d && typeof d.name === "string") map.set(d.name, d);
    }
    for (const d of primary ?? []) {
        if (d && typeof d.name === "string") map.set(d.name, d);
    }
    return Array.from(map.values());
}

export function buildTaskFormFields(
    globalFormFields: FormFieldConfig[] | null,
    task: {
        customFieldDefinitions?: TaskCustomFieldDefinition[];
        customFields?: Record<string, any>;
    }
): FormFieldConfig[] {
    // Normalisasi key: lowercase + strip prefix custom_
    const normalizeKey = (k: string): string =>
        k.trim().toLowerCase().replace(/^custom_/, "");

    // Map: normalizedName -> FormFieldConfig
    const fieldMap = new Map<string, FormFieldConfig>();

    // 1. Masukkan default fields dulu (paling prioritas, tidak boleh di-override)
    for (const df of DEFAULT_FORM_FIELDS) {
        fieldMap.set(normalizeKey(df.name), { ...df });
    }

    // 2. Masukkan global custom fields (skip kalau sudah ada)
    const baseFields = globalFormFields && globalFormFields.length > 0
        ? globalFormFields
        : DEFAULT_FORM_FIELDS;
    for (const f of baseFields) {
        if (!f || typeof f.name !== "string" || f.name.length === 0) continue;
        const key = normalizeKey(f.name);
        // Default fields sudah diinsert di step 1 — jangan overwrite label-nya
        if (DEFAULT_FIELD_NAMES.includes(f.name)) {
            if (!fieldMap.has(key)) fieldMap.set(key, { ...f });
            continue;
        }
        if (fieldMap.has(key)) continue;
        fieldMap.set(key, { ...f });
    }

    // 3. Masukkan task-specific definitions (override global kalau sama)
    const taskDefs = task.customFieldDefinitions ?? [];
    for (const def of taskDefs) {
        if (!def || typeof def.name !== "string" || def.name.length === 0) continue;
        const key = normalizeKey(def.name);
        const existing = fieldMap.get(key);
        if (existing) {
            fieldMap.set(key, {
                ...existing,
                label: def.label || existing.label,
                type: def.type || existing.type,
                required: def.required ?? existing.required,
                placeholder: def.placeholder ?? existing.placeholder,
                options: def.options ?? existing.options,
                defaultValue: def.defaultValue ?? existing.defaultValue,
                colSpan: def.colSpan ?? existing.colSpan,
            });
        } else {
            fieldMap.set(key, {
                id: def.name,
                name: def.name,
                label: def.label,
                type: def.type,
                required: def.required,
                placeholder: def.placeholder,
                options: def.options,
                defaultValue: def.defaultValue,
                enabled: true,
                isDefault: false,
                colSpan: def.colSpan ?? 1,
            });
        }
    }

    // 4. Susun output dengan urutan: default dulu, lalu custom
    const result: FormFieldConfig[] = [];
    const added = new Set<string>();

    // 4a. Default fields (urutan dari DEFAULT_FORM_FIELDS)
    for (const df of DEFAULT_FORM_FIELDS) {
        const key = normalizeKey(df.name);
        const f = fieldMap.get(key);
        if (f) {
            result.push(f);
            added.add(key);
        }
    }

    // 4b. Custom fields — urutkan sesuai urutan di globalFormFields,
    //     lalu task-specific yang belum ada
    const orderedCustom: FormFieldConfig[] = [];
    const seen = new Set<string>();

    for (const f of baseFields) {
        if (!f || typeof f.name !== "string") continue;
        if (DEFAULT_FIELD_NAMES.includes(f.name)) continue;
        const key = normalizeKey(f.name);
        if (seen.has(key)) continue;
        const ff = fieldMap.get(key);
        if (!ff) continue;
        orderedCustom.push(ff);
        seen.add(key);
    }

    for (const def of taskDefs) {
        if (!def || typeof def.name !== "string") continue;
        const key = normalizeKey(def.name);
        if (seen.has(key)) continue;
        const ff = fieldMap.get(key);
        if (!ff) continue;
        orderedCustom.push(ff);
        seen.add(key);
    }

    for (const f of orderedCustom) {
        const key = normalizeKey(f.name);
        if (added.has(key)) continue;
        result.push(f);
        added.add(key);
    }

    return result;
}