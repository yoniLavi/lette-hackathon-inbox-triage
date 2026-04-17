/**
 * CRM data client.
 * Uses the Next.js /api/crm proxy route (works from both server and client).
 *
 * Entity types come from @repo/crm-schema (Api* — dates serialized to strings).
 * Crm* aliases extend them with ?include= fields populated by the API.
 */

import type {
    ApiProperty,
    ApiContact,
    ApiCase,
    ApiEmail,
    ApiTask,
    ApiNote,
    ApiThread,
    ApiShift,
} from "@repo/crm-schema";

async function crmFetch(path: string, params?: Record<string, string>) {
    const url = new URL("/api/crm", window.location.origin);
    url.searchParams.set("path", path);
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            url.searchParams.set(k, v);
        }
    }
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
        throw new Error(`CRM ${path}: ${res.status} ${res.statusText}`);
    }
    return res.json();
}

export type UrgencyTier = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

// --- Entity types (with ?include= extensions) ---

export type CrmProperty = ApiProperty;
export type CrmContact = ApiContact;
export type CrmTask = ApiTask;
export type CrmNote = ApiNote;

export type CrmEmail = ApiEmail & {
    contact?: CrmContact | null;
};

export type CrmCase = ApiCase & {
    property?: CrmProperty | null;
    emails?: CrmEmail[];
    tasks?: CrmTask[];
    notes?: CrmNote[];
};

export type CrmThread = ApiThread & {
    emails?: CrmEmail[];
    contact?: CrmContact | null;
};

export type CrmShift = ApiShift & {
    case?: CrmCase | null;
    notes?: CrmNote[];
};

async function crmPatch(path: string, body: Record<string, unknown>) {
    const url = new URL("/api/crm", window.location.origin);
    url.searchParams.set("path", path);
    const res = await fetch(url.toString(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        throw new Error(`CRM PATCH ${path}: ${res.status} ${res.statusText}`);
    }
    return res.json();
}

export async function updateCase(id: number, data: Record<string, unknown>) {
    return crmPatch(`cases/${id}`, data);
}

export async function updateTask(id: number, data: Record<string, unknown>) {
    return crmPatch(`tasks/${id}`, data);
}

export async function deleteEmail(id: number) {
    const url = new URL("/api/crm", window.location.origin);
    url.searchParams.set("path", `emails/${id}`);
    const res = await fetch(url.toString(), { method: "DELETE", cache: "no-store" });
    if (!res.ok) throw new Error(`Delete email: ${res.status}`);
    return res.json();
}

export async function updateEmail(id: number, data: Record<string, unknown>) {
    return crmPatch(`emails/${id}`, data);
}

// --- Fetch functions ---

export async function getCases(include?: string): Promise<CrmCase[]> {
    const params: Record<string, string> = {
        order_by: "updated_at",
        order: "desc",
        limit: "50",
    };
    if (include) params.include = include;
    const data = await crmFetch("cases", params);
    return data.list || [];
}

export async function getCasesCreatedDuring(after: string, before: string): Promise<CrmCase[]> {
    const data = await crmFetch("cases", {
        created_at_after: after,
        created_at_before: before,
        order_by: "created_at",
        order: "asc",
        limit: "50",
        include: "emails,tasks,notes,property",
    });
    return data.list || [];
}

export async function getCasesUpdatedDuring(after: string, before: string): Promise<CrmCase[]> {
    const data = await crmFetch("cases", {
        updated_at_after: after,
        updated_at_before: before,
        order_by: "updated_at",
        order: "asc",
        limit: "50",
        include: "emails,tasks,notes,property",
    });
    return data.list || [];
}

export async function getCase(id: number, include?: string): Promise<CrmCase> {
    const params: Record<string, string> = {};
    if (include) params.include = include;
    return crmFetch(`cases/${id}`, params);
}

export async function getEmails(limit = 20, params?: Record<string, string>): Promise<CrmEmail[]> {
    const data = await crmFetch("emails", {
        order_by: "date_sent",
        order: "desc",
        limit: String(limit),
        ...params,
    });
    return data.list || [];
}

export async function searchEmails(query: string, limit = 20): Promise<CrmEmail[]> {
    const data = await crmFetch("emails", {
        search: query,
        order_by: "date_sent",
        order: "desc",
        limit: String(limit),
        include: "contact",
    });
    return data.list || [];
}

export async function getProperty(id: number): Promise<CrmProperty> {
    return crmFetch(`properties/${id}`);
}

export async function getContact(id: number): Promise<CrmContact> {
    return crmFetch(`contacts/${id}`);
}

export async function getProperties(): Promise<CrmProperty[]> {
    const data = await crmFetch("properties", {
        order_by: "name",
        order: "asc",
        limit: "50",
    });
    return data.list || [];
}

export async function getTasks(limit = 50, params?: Record<string, string>): Promise<CrmTask[]> {
    const data = await crmFetch("tasks", {
        order_by: "updated_at",
        order: "desc",
        limit: String(limit),
        ...params,
    });
    return data.list || [];
}

export async function getRelatedEmails(caseId: number): Promise<CrmEmail[]> {
    const data = await crmFetch("emails", {
        case_id: String(caseId),
        order_by: "date_sent",
        order: "asc",
        limit: "50",
        include: "contact",
    });
    return data.list || [];
}

export async function getRelatedTasks(caseId: number): Promise<CrmTask[]> {
    const data = await crmFetch("tasks", {
        case_id: String(caseId),
        order_by: "updated_at",
        order: "desc",
        limit: "50",
    });
    return data.list || [];
}

export async function getNotes(caseId: number): Promise<CrmNote[]> {
    const data = await crmFetch("notes", {
        case_id: String(caseId),
        order_by: "created_at",
        order: "asc",
        limit: "50",
    });
    return data.list || [];
}

export async function getTaskNotes(taskId: number): Promise<CrmNote[]> {
    const data = await crmFetch("notes", {
        task_id: String(taskId),
        order_by: "created_at",
        order: "asc",
        limit: "50",
    });
    return data.list || [];
}

export async function createNote(data: Record<string, unknown>): Promise<CrmNote> {
    const url = new URL("/api/crm", window.location.origin);
    url.searchParams.set("path", "notes");
    const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        cache: "no-store",
    });
    if (!res.ok) throw new Error(`Create note: ${res.status}`);
    return res.json();
}

export async function getContacts(params?: Record<string, string>): Promise<CrmContact[]> {
    const data = await crmFetch("contacts", {
        order_by: "last_name",
        order: "asc",
        limit: "100",
        ...params,
    });
    return data.list || [];
}

export async function getThreads(include?: string, limit = 20): Promise<CrmThread[]> {
    const params: Record<string, string> = {
        order_by: "last_activity_at",
        order: "desc",
        limit: String(limit),
    };
    if (include) params.include = include;
    const data = await crmFetch("threads", params);
    return data.list || [];
}

export async function getShifts(params?: Record<string, string>): Promise<CrmShift[]> {
    const data = await crmFetch("shifts", {
        order_by: "started_at",
        order: "desc",
        limit: "50",
        include: "notes",
        ...params,
    });
    return data.list || [];
}

export async function getShift(id: number, include?: string): Promise<CrmShift> {
    const params: Record<string, string> = {};
    if (include) params.include = include;
    return crmFetch(`shifts/${id}`, params);
}

export async function getUnreadThreads(): Promise<{ threads: CrmThread[]; total: number }> {
    const data = await crmFetch("threads", {
        is_read: "false",
        order_by: "last_activity_at",
        order: "asc",
        limit: "200",
        include: "contact",
    });
    return { threads: data.list || [], total: data.total || 0 };
}

export async function getCounts(): Promise<{ emails: number; open_tasks: number; closed_cases: number }> {
    return crmFetch("counts");
}

export async function getDraftCount(): Promise<number> {
    const data = await crmFetch("emails", { status: "draft", limit: "1" });
    return data.total || 0;
}

// --- Helpers ---

export function contactName(contact?: CrmContact | null): string | null {
    if (!contact) return null;
    return `${contact.first_name} ${contact.last_name}`.trim() || null;
}

export function senderDisplay(email: CrmEmail): string {
    const name = contactName(email.contact);
    return name || email.from_address || "Unknown sender";
}

/** Derive action status text for a case based on its linked emails and tasks. */
export function caseActionStatus(c: CrmCase): { text: string; style: "draft" | "pending" | "triage" | "done" } {
    const drafts = c.emails?.filter(e => e.status === "draft") || [];
    const pendingTasks = c.tasks?.filter(t => t.status !== "completed") || [];

    if (c.status === "closed") return { text: "Resolved", style: "done" };
    if (drafts.length > 0) return { text: "Draft ready", style: "draft" };
    if (pendingTasks.length > 0) return { text: `${pendingTasks.length} action${pendingTasks.length > 1 ? "s" : ""} pending`, style: "pending" };
    if ((c.tasks?.length || 0) === 0 && drafts.length === 0) return { text: "Needs triage", style: "triage" };
    return { text: "Up to date", style: "done" };
}
