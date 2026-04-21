/**
 * CRM data client — fetches through the Next.js /api/crm proxy.
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

type Params = Record<string, string>;

async function request<T>(method: string, path: string, params?: Params, body?: unknown): Promise<T> {
    const url = new URL("/api/crm", window.location.origin);
    url.searchParams.set("path", path);
    if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const init: RequestInit = { method, cache: "no-store" };
    if (body !== undefined) {
        init.body = JSON.stringify(body);
        init.headers = { "Content-Type": "application/json" };
    }
    const res = await fetch(url.toString(), init);
    if (!res.ok) throw new Error(`CRM ${method} ${path}: ${res.status} ${res.statusText}`);
    return res.json();
}

async function list<T>(entity: string, params?: Params): Promise<T[]> {
    const data = await request<{ list?: T[] }>("GET", entity, params);
    return data.list || [];
}

const one = <T>(entity: string, id: number, include?: string): Promise<T> =>
    request<T>("GET", `${entity}/${id}`, include ? { include } : undefined);

const withInclude = (include: string | undefined, rest: Params): Params =>
    include ? { ...rest, include } : rest;

export type UrgencyTier = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

// --- Entity types (with ?include= extensions) ---

export type CrmProperty = ApiProperty;
export type CrmContact = ApiContact;
export type CrmTask = ApiTask;
export type CrmNote = ApiNote;
export type CrmEmail = ApiEmail & { contact?: CrmContact | null };
export type CrmCase = ApiCase & {
    property?: CrmProperty | null;
    emails?: CrmEmail[];
    tasks?: CrmTask[];
    notes?: CrmNote[];
};
export type CrmThread = ApiThread & { emails?: CrmEmail[]; contact?: CrmContact | null };
export type CrmShift = ApiShift & { case?: CrmCase | null; notes?: CrmNote[] };

// --- Mutations ---

export const updateCase = (id: number, data: Record<string, unknown>) =>
    request<CrmCase>("PATCH", `cases/${id}`, undefined, data);
export const updateTask = (id: number, data: Record<string, unknown>) =>
    request<CrmTask>("PATCH", `tasks/${id}`, undefined, data);
export const updateEmail = (id: number, data: Record<string, unknown>) =>
    request<CrmEmail>("PATCH", `emails/${id}`, undefined, data);
export const deleteEmail = (id: number) =>
    request<{ ok: boolean }>("DELETE", `emails/${id}`);
export const createNote = (data: Record<string, unknown>) =>
    request<CrmNote>("POST", "notes", undefined, data);

// --- Single-entity fetches ---

export const getCase = (id: number, include?: string) => one<CrmCase>("cases", id, include);
export const getProperty = (id: number) => one<CrmProperty>("properties", id);
export const getContact = (id: number) => one<CrmContact>("contacts", id);
export const getShift = (id: number, include?: string) => one<CrmShift>("shifts", id, include);

// --- List fetches ---

export const getCases = (include?: string) =>
    list<CrmCase>("cases", withInclude(include, { order_by: "updated_at", order: "desc", limit: "50" }));

export const getCasesCreatedDuring = (after: string, before: string) =>
    list<CrmCase>("cases", {
        created_at_after: after, created_at_before: before,
        order_by: "created_at", order: "asc", limit: "50",
        include: "emails,tasks,notes,property",
    });

export const getCasesUpdatedDuring = (after: string, before: string) =>
    list<CrmCase>("cases", {
        updated_at_after: after, updated_at_before: before,
        order_by: "updated_at", order: "asc", limit: "50",
        include: "emails,tasks,notes,property",
    });

export const getProperties = () =>
    list<CrmProperty>("properties", { order_by: "name", order: "asc", limit: "50" });

export const getContacts = (params?: Params) =>
    list<CrmContact>("contacts", { order_by: "last_name", order: "asc", limit: "100", ...params });

export const getEmails = (limit = 20, params?: Params) =>
    list<CrmEmail>("emails", { order_by: "date_sent", order: "desc", limit: String(limit), ...params });

export const getTasks = (limit = 50, params?: Params) =>
    list<CrmTask>("tasks", { order_by: "updated_at", order: "desc", limit: String(limit), ...params });

export const searchEmails = (query: string, limit = 20) =>
    list<CrmEmail>("emails", {
        search: query, order_by: "date_sent", order: "desc",
        limit: String(limit), include: "contact",
    });

export const getRelatedEmails = (caseId: number) =>
    list<CrmEmail>("emails", {
        case_id: String(caseId), order_by: "date_sent", order: "asc",
        limit: "50", include: "contact",
    });

export const getRelatedTasks = (caseId: number) =>
    list<CrmTask>("tasks", { case_id: String(caseId), order_by: "updated_at", order: "desc", limit: "50" });

export const getNotes = (caseId: number) =>
    list<CrmNote>("notes", { case_id: String(caseId), order_by: "created_at", order: "asc", limit: "50" });

export const getTaskNotes = (taskId: number) =>
    list<CrmNote>("notes", { task_id: String(taskId), order_by: "created_at", order: "asc", limit: "50" });

export const getThreads = (include?: string, limit = 20) =>
    list<CrmThread>("threads", withInclude(include, { order_by: "last_activity_at", order: "desc", limit: String(limit) }));

export const getShifts = (params?: Params) =>
    list<CrmShift>("shifts", { order_by: "started_at", order: "desc", limit: "50", include: "notes", ...params });

export async function getUnreadThreads(): Promise<{ threads: CrmThread[]; total: number }> {
    const data = await request<{ list?: CrmThread[]; total?: number }>("GET", "threads", {
        is_read: "false", order_by: "last_activity_at", order: "asc",
        limit: "200", include: "contact",
    });
    return { threads: data.list || [], total: data.total || 0 };
}

export const getCounts = () =>
    request<{ emails: number; open_tasks: number; closed_cases: number }>("GET", "counts");

export async function getDraftCount(): Promise<number> {
    const data = await request<{ total?: number }>("GET", "emails", { status: "draft", limit: "1" });
    return data.total || 0;
}

// --- Helpers ---

export function contactName(contact?: CrmContact | null): string | null {
    if (!contact) return null;
    return `${contact.first_name} ${contact.last_name}`.trim() || null;
}

export function senderDisplay(email: CrmEmail): string {
    return contactName(email.contact) || email.from_address || "Unknown sender";
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
