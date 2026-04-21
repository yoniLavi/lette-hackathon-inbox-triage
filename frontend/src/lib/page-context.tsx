"use client"

import React, { createContext, useContext, useState } from "react";
import type { CrmCase, CrmEmail, CrmTask, CrmNote, CrmContact, CrmProperty, CrmThread } from "./crm";
import { contactName, caseActionStatus, senderDisplay } from "./crm";

// ---------- Field pickers ----------
// Fields exposed to the AI per entity. Kept as snake_case to match the CRM schema —
// adding a new field to the schema doesn't require renaming here.

const CASE_FIELDS = ["id", "name", "priority", "status", "description"] as const;
const TASK_FIELDS = ["id", "name", "status", "priority", "description", "date_end", "case_id"] as const;
const NOTE_FIELDS = ["id", "content", "created_at"] as const;
const EMAIL_CORE = ["id", "subject", "from_address", "to_addresses", "date_sent", "status", "thread_id", "thread_position", "is_read", "case_id"] as const;
const CONTACT_FIELDS = ["id", "first_name", "last_name", "email", "type", "company", "unit"] as const;
const PROPERTY_FIELDS = ["id", "name", "type", "units", "manager", "manager_email", "description"] as const;

function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
    const out = {} as Pick<T, K>;
    for (const k of keys) out[k] = obj[k];
    return out;
}

const stripHtml = (s: string | null | undefined): string => (s || "").replace(/<[^>]*>/g, "");
const truncate = (s: string | null | undefined, n = 200): string | undefined => s ? s.slice(0, n) : undefined;

// ---------- Builders ----------

export function buildDashboardContext(
    cases: CrmCase[],
    stats: { tasks: number; drafts: number; closed: number },
) {
    const actionOrder: Record<string, number> = { triage: 0, draft: 1, pending: 2, done: 3 };
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const workQueue = cases
        .filter(c => c.status !== "closed" && !c.name.startsWith("Agent Shift"))
        .filter(c => caseActionStatus(c).style !== "done")
        .sort((a, b) => {
            const d = (actionOrder[caseActionStatus(a).style] ?? 3) - (actionOrder[caseActionStatus(b).style] ?? 3);
            return d !== 0 ? d : (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
        });

    return {
        page: "dashboard" as const,
        case_count: cases.length,
        open_case_count: cases.filter(c => c.status !== "closed").length,
        pending_tasks: stats.tasks,
        drafts_to_review: stats.drafts,
        resolved_cases: stats.closed,
        top_cases: workQueue.slice(0, 15).map(c => ({
            ...pick(c, CASE_FIELDS),
            property_name: c.property?.name,
            action_status: caseActionStatus(c).text,
            pending_task_names: c.tasks?.filter(t => t.status !== "completed").map(t => t.name),
            draft_subjects: c.emails?.filter(e => e.status === "draft").map(e => e.subject),
        })),
    };
}

export function buildSituationContext(
    crmCase: CrmCase,
    emails: CrmEmail[],
    tasks: CrmTask[],
    notes: CrmNote[],
    contacts: CrmContact[],
) {
    return {
        page: "situation" as const,
        ...pick(crmCase, CASE_FIELDS),
        property_name: crmCase.property?.name,
        property_manager: crmCase.property?.manager,
        property_manager_email: crmCase.property?.manager_email,
        tasks: tasks.map(t => pick(t, TASK_FIELDS)),
        drafts: emails.filter(e => e.status === "draft").map(d => ({
            ...pick(d, ["id", "subject", "to_addresses"] as const),
            body_plain: stripHtml(d.body_plain || d.body),
        })),
        emails: emails.filter(e => e.status !== "draft").map(e => ({
            ...pick(e, EMAIL_CORE),
            body_plain: stripHtml(e.body_plain || e.body),
            sender_name: contactName(e.contact),
            sender_type: e.contact?.type,
        })),
        notes: notes.map(n => pick(n, NOTE_FIELDS)),
        contacts: contacts.map(c => pick(c, CONTACT_FIELDS)),
    };
}

export function buildPropertiesContext(
    properties: CrmProperty[],
    caseCounts: Record<number, number>,
    contactCounts: Record<number, number>,
) {
    return {
        page: "properties" as const,
        properties: properties.map(p => ({
            ...pick(p, PROPERTY_FIELDS),
            case_count: caseCounts[p.id] || 0,
            contact_count: contactCounts[p.id] || 0,
        })),
    };
}

export function buildSearchContext(query: string, results: CrmEmail[]) {
    return {
        page: "search" as const,
        query,
        result_count: results.length,
        top_results: results.slice(0, 10).map(e => ({
            ...pick(e, ["id", "subject", "date_sent", "case_id"] as const),
            sender: senderDisplay(e),
            body_snippet: truncate(stripHtml(e.body_plain || e.body)),
        })),
    };
}

export function buildInboxContext(threads: CrmThread[]) {
    return {
        page: "inbox" as const,
        thread_count: threads.length,
        unread_count: threads.filter(t => !t.is_read).length,
        draft_count: threads.filter(t => t.emails?.some(e => e.status === "draft")).length,
        threads: threads.slice(0, 30).map(t => ({
            ...pick(t, ["thread_id", "subject", "email_count", "is_read", "case_id"] as const),
            sender: contactName(t.contact) || "Unknown",
            has_draft: t.emails?.some(e => e.status === "draft") || false,
        })),
    };
}

export function buildTasksContext(tasks: CrmTask[], cases: Record<number, CrmCase>) {
    return {
        page: "tasks" as const,
        total_tasks: tasks.length,
        pending_count: tasks.filter(t => t.status !== "completed").length,
        completed_count: tasks.filter(t => t.status === "completed").length,
        tasks: tasks.slice(0, 30).map(t => ({
            ...pick(t, ["id", "name", "status", "priority"] as const),
            description: truncate(t.description),
            case_name: t.case_id ? cases[t.case_id]?.name : undefined,
        })),
    };
}

export function buildContactsContext(contacts: CrmContact[], properties: Record<number, CrmProperty>) {
    return {
        page: "contacts" as const,
        total_contacts: contacts.length,
        contacts: contacts.slice(0, 40).map(c => ({
            ...pick(c, CONTACT_FIELDS),
            property_name: c.property_id ? properties[c.property_id]?.name : undefined,
        })),
    };
}

export function buildPropertyDetailContext(property: CrmProperty, cases: CrmCase[], contacts: CrmContact[]) {
    const openCases = cases.filter(c => c.status !== "closed" && !c.name.startsWith("Agent Shift"));
    return {
        page: "property_detail" as const,
        ...pick(property, PROPERTY_FIELDS),
        open_case_count: openCases.length,
        open_cases: openCases.slice(0, 20).map(c => ({
            ...pick(c, CASE_FIELDS),
            action_status: caseActionStatus(c).text,
            description: truncate(c.description),
        })),
        contact_count: contacts.length,
        contacts: contacts.slice(0, 20).map(c => pick(c, CONTACT_FIELDS)),
    };
}

export function buildContactDetailContext(
    contact: CrmContact,
    cases: CrmCase[],
    emails: CrmEmail[],
    propertyName?: string,
) {
    const openCases = cases.filter(c => c.status !== "closed" && !c.name.startsWith("Agent Shift"));
    return {
        page: "contact_detail" as const,
        ...pick(contact, CONTACT_FIELDS),
        display_name: contactName(contact),
        property_name: propertyName,
        open_case_count: openCases.length,
        open_cases: openCases.slice(0, 15).map(c => ({
            ...pick(c, ["id", "name", "priority"] as const),
            description: truncate(c.description),
        })),
        recent_emails: emails.slice(0, 15).map(e => pick(e, ["id", "subject", "date_sent"] as const)),
    };
}

// ---------- Context plumbing ----------

type PageData =
    | ReturnType<typeof buildDashboardContext>
    | ReturnType<typeof buildSituationContext>
    | ReturnType<typeof buildPropertiesContext>
    | ReturnType<typeof buildSearchContext>
    | ReturnType<typeof buildInboxContext>
    | ReturnType<typeof buildTasksContext>
    | ReturnType<typeof buildContactsContext>
    | ReturnType<typeof buildPropertyDetailContext>
    | ReturnType<typeof buildContactDetailContext>
    | { page: string };

const PageDataContext = createContext<{
    data: PageData | null;
    setData: (data: PageData) => void;
}>({ data: null, setData: () => {} });

export function PageDataProvider({ children }: { children: React.ReactNode }) {
    const [data, setData] = useState<PageData | null>(null);
    return (
        <PageDataContext.Provider value={{ data, setData }}>
            {children}
        </PageDataContext.Provider>
    );
}

export function usePageData() {
    return useContext(PageDataContext);
}

/** Serialize page data to a compact JSON string for the AI context field. */
export function serializePageContext(data: PageData | null): string {
    return data ? JSON.stringify(data) : "";
}
