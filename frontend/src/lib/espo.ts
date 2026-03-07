/**
 * EspoCRM data client.
 * Uses the Next.js /api/crm proxy route (works from both server and client).
 */

async function espoFetch(path: string, params?: Record<string, string>) {
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
    id: string;
    name: string;
    status: string;
    priority: string;
    description: string;
    accountId?: string;
    accountName?: string;
    createdAt: string;
    modifiedAt: string;
}

export interface CrmEmail {
    id: string;
    name: string; // subject
    status: string;
    dateSent: string;
    from: string;
    to: string;
    body: string;
    bodyPlain: string;
    isRead: boolean;
    parentId?: string;
    parentType?: string;
}

export interface CrmTask {
    id: string;
    name: string;
    status: string;
    priority: string;
    description: string;
    dateStart?: string;
    dateEnd?: string;
    parentId?: string;
    parentType?: string;
}

export interface CrmAccount {
    id: string;
    name: string;
    description: string;
}

// --- Fetch functions ---

export async function getCases(): Promise<CrmCase[]> {
    const data = await espoFetch("Case", {
        orderBy: "modifiedAt",
        order: "desc",
        maxSize: "50",
    });
    return data.list || [];
}

export async function getCase(id: string): Promise<CrmCase> {
    return espoFetch(`Case/${id}`);
}

export async function getEmails(maxSize = 20): Promise<CrmEmail[]> {
    const data = await espoFetch("Email", {
        orderBy: "dateSent",
        order: "desc",
        maxSize: String(maxSize),
        select: "id,name,status,dateSent,from,to,body,bodyPlain,isRead,parentId,parentType,personStringData",
    });
    return data.list || [];
}

export async function getAccounts(): Promise<CrmAccount[]> {
    const data = await espoFetch("Account", {
        orderBy: "name",
        order: "asc",
        maxSize: "50",
    });
    return data.list || [];
}

export async function getTasks(maxSize = 50): Promise<CrmTask[]> {
    const data = await espoFetch("Task", {
        orderBy: "modifiedAt",
        order: "desc",
        maxSize: String(maxSize),
    });
    return data.list || [];
}

export async function getRelatedEmails(caseId: string): Promise<CrmEmail[]> {
    const data = await espoFetch(`Case/${caseId}/emails`, {
        orderBy: "dateSent",
        order: "desc",
        maxSize: "50",
        select: "id,name,status,dateSent,from,to,body,bodyPlain,isRead,parentId,parentType,personStringData",
    });
    return data.list || [];
}

export async function getRelatedTasks(caseId: string): Promise<CrmTask[]> {
    const data = await espoFetch(`Case/${caseId}/tasks`, {
        orderBy: "modifiedAt",
        order: "desc",
        maxSize: "50",
    });
    return data.list || [];
}

export async function getEmailCount(): Promise<number> {
    const data = await espoFetch("Email", {
        maxSize: "0",
        "where[0][type]": "isTrue",
        "where[0][attribute]": "isRead",
    });
    // EspoCRM returns -1 for total without a where clause; use a trivial filter
    const total = data.total;
    if (total >= 0) return total;
    // Fallback: fetch a batch and count
    const all = await espoFetch("Email", { maxSize: "200", select: "id" });
    return all.list?.length || 0;
}

export async function getOpenTaskCount(): Promise<number> {
    const data = await espoFetch("Task", {
        "where[0][type]": "notIn",
        "where[0][attribute]": "status",
        "where[0][value][]": "Completed",
        maxSize: "0",
    });
    return data.total || 0;
}

export async function getClosedCaseCount(): Promise<number> {
    const data = await espoFetch("Case", {
        "where[0][type]": "equals",
        "where[0][attribute]": "status",
        "where[0][value]": "Closed",
        maxSize: "0",
    });
    return data.total || 0;
}
