/**
 * CRM data client.
 * Uses the Next.js /api/crm proxy route (works from both server and client).
 */

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

// --- Types matching CRM entities ---

export interface CrmProperty {
    id: number;
    name: string;
    type: string;
    units: number;
    manager: string;
    manager_email: string;
    description: string;
    challenge_id?: string;
    created_at: string;
    updated_at: string;
}

export interface CrmContact {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    type: string; // tenant, landlord, contractor, prospect, internal, legal
    property_id?: number;
    company: string;
    unit: string;
    role: string;
    created_at: string;
    updated_at: string;
}

export interface CrmCase {
    id: number;
    name: string;
    status: string;
    priority: string;
    description: string;
    property_id?: number;
    created_at: string;
    updated_at: string;
    // Populated via ?include=
    property?: CrmProperty | null;
    emails?: CrmEmail[];
    tasks?: CrmTask[];
    notes?: CrmNote[];
}

export interface CrmEmail {
    id: number;
    subject: string;
    status: string;
    date_sent: string;
    from_address: string;
    to_addresses: string[];
    cc_addresses: string[];
    body: string;
    body_plain: string;
    is_read: boolean;
    is_replied: boolean;
    is_important: boolean;
    thread_id?: string;
    thread_position?: number;
    case_id?: number;
    created_at: string;
    updated_at: string;
    // Populated via ?include=
    contact?: CrmContact | null;
}

export interface CrmTask {
    id: number;
    name: string;
    status: string;
    priority: string;
    description: string;
    date_start?: string;
    date_end?: string;
    case_id?: number;
    contact_id?: number;
    created_at: string;
    updated_at: string;
}

export interface CrmNote {
    id: number;
    content: string;
    case_id?: number;
    created_at: string;
    updated_at: string;
}

export interface CrmThread {
    id: number;
    thread_id: string;
    subject: string;
    last_activity_at: string;
    email_count: number;
    is_read: boolean;
    case_id?: number;
    property_id?: number;
    contact_id?: number;
    created_at: string;
    updated_at: string;
    // Populated via ?include=
    emails?: CrmEmail[];
    contact?: CrmContact | null;
}

export interface CrmShift {
    id: number;
    started_at: string;
    completed_at: string | null;
    status: string; // in_progress / completed / failed
    threads_processed: number;
    emails_processed: number;
    drafts_created: number;
    tasks_created: number;
    summary: string | null;
    cost_usd: number | null;
    case_id: number | null;
    created_at: string;
    updated_at: string;
    // Populated via ?include=
    case?: CrmCase | null;
}

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

export async function getContacts(params?: Record<string, string>): Promise<CrmContact[]> {
    const data = await crmFetch("contacts", {
        order_by: "last_name",
        order: "asc",
        limit: "100",
        ...params,
    });
    return data.list || [];
}

export async function getThreads(include?: string): Promise<CrmThread[]> {
    const params: Record<string, string> = {
        order_by: "last_activity_at",
        order: "desc",
        limit: "20",
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
        limit: "50",
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
