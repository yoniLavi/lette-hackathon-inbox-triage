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

// --- Types matching CRM entities ---

export interface CrmCase {
    id: number;
    name: string;
    status: string;
    priority: string;
    description: string;
    property_id?: number;
    created_at: string;
    updated_at: string;
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
    thread_id?: string;
    thread_position?: number;
    case_id?: number;
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
}

export interface CrmProperty {
    id: number;
    name: string;
    type: string;
    units: number;
    manager: string;
    description: string;
}

// --- Fetch functions ---

export async function getCases(): Promise<CrmCase[]> {
    const data = await crmFetch("cases", {
        order_by: "updated_at",
        order: "desc",
        limit: "50",
    });
    return data.list || [];
}

export async function getCase(id: number): Promise<CrmCase> {
    return crmFetch(`cases/${id}`);
}

export async function getEmails(limit = 20): Promise<CrmEmail[]> {
    const data = await crmFetch("emails", {
        order_by: "date_sent",
        order: "desc",
        limit: String(limit),
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

export async function getTasks(limit = 50): Promise<CrmTask[]> {
    const data = await crmFetch("tasks", {
        order_by: "updated_at",
        order: "desc",
        limit: String(limit),
    });
    return data.list || [];
}

export async function getRelatedEmails(caseId: number): Promise<CrmEmail[]> {
    const data = await crmFetch("emails", {
        case_id: String(caseId),
        order_by: "date_sent",
        order: "desc",
        limit: "50",
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

export async function getEmailCount(): Promise<number> {
    const data = await crmFetch("counts");
    return data.emails || 0;
}

export async function getOpenTaskCount(): Promise<number> {
    const data = await crmFetch("counts");
    return data.open_tasks || 0;
}

export async function getClosedCaseCount(): Promise<number> {
    const data = await crmFetch("counts");
    return data.closed_cases || 0;
}
