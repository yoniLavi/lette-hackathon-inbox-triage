"use client"

import React, { createContext, useContext, useState } from "react";
import type { CrmCase, CrmEmail, CrmTask, CrmNote, CrmContact, CrmProperty, CrmThread } from "./crm";
import { contactName, caseActionStatus, senderDisplay } from "./crm";

// ---------- Types for structured page context ----------

// Context-type field shorthands for nullable strings from the CRM
type S = string | null;

interface DashboardContext {
    page: "dashboard";
    caseCount: number;
    openCaseCount: number;
    stats: { pendingTasks: number; draftsToReview: number; resolvedCases: number };
    topCases: {
        id: number;
        name: string;
        priority: string;
        status: string;
        actionStatus: string;
        propertyName?: S;
        description?: S;
        pendingTasks?: string[];
        draftSubjects?: S[];
    }[];
}

interface SituationEmailContext {
    id: number;
    subject: S;
    from: S;
    to: string[];
    bodyPlain: string;
    dateSent: S;
    status: string;
    threadId?: S;
    threadPosition?: number | null;
    isRead: boolean;
    senderName?: S;
    senderType?: S;
}

interface SituationDraftContext {
    id: number;
    subject: S;
    to: string[];
    bodyPlain: string;
}

interface SituationTaskContext {
    id: number;
    name: string;
    status: string;
    priority: string;
    description?: S;
    dueDate?: S;
}

interface SituationContext {
    page: "situation";
    caseId: number;
    caseName: string;
    priority: string;
    status: string;
    description: string;
    propertyName?: S;
    propertyManager?: S;
    propertyManagerEmail?: S;
    tasks: SituationTaskContext[];
    drafts: SituationDraftContext[];
    emails: SituationEmailContext[];
    notes: { id: number; content: S; createdAt: string }[];
    contacts: { name: S; type: S; email: S; company?: S; unit?: S }[];
}

interface PropertiesContext {
    page: "properties";
    properties: {
        name: string;
        type: S;
        units: number | null;
        manager: S;
        managerEmail: S;
        description?: S;
        caseCount: number;
        contactCount: number;
    }[];
}

interface SearchContext {
    page: "search";
    query: string;
    resultCount: number;
    topResults: {
        subject: S;
        sender: string;
        dateSent: S;
        bodySnippet?: S;
        caseId?: number | null;
    }[];
}

interface InboxContext {
    page: "inbox";
    threadCount: number;
    unreadCount: number;
    draftCount: number;
    threads: { threadId: string; subject: S; sender: string; emailCount: number; isRead: boolean; hasDraft: boolean; caseId?: number | null }[];
}

interface TasksContext {
    page: "tasks";
    totalTasks: number;
    pendingCount: number;
    completedCount: number;
    tasks: { id: number; name: string; status: string; priority: string; caseName?: S; description?: S }[];
}

interface ContactsContext {
    page: "contacts";
    totalContacts: number;
    contacts: { id: number; name: S; type: S; email: S; propertyName?: S; unit?: S; company?: S }[];
}

interface PropertyDetailContext {
    page: "propertyDetail";
    propertyId: number;
    propertyName: string;
    type: S;
    units: number | null;
    manager: S;
    managerEmail: S;
    openCaseCount: number;
    openCases: { id: number; name: string; priority: string; status: string; actionStatus: string; description?: S }[];
    contactCount: number;
    contacts: { id: number; name: S; type: S; email: S; unit?: S }[];
}

interface ContactDetailContext {
    page: "contactDetail";
    contactId: number;
    contactName: S;
    contactType: S;
    email: S;
    propertyName?: string;
    unit?: S;
    company?: S;
    openCaseCount: number;
    openCases: { id: number; name: string; priority: string; description?: S }[];
    recentEmails: { id: number; subject: S; dateSent: S }[];
}

interface GenericContext {
    page: string;
}

type PageData = DashboardContext | SituationContext | PropertiesContext | SearchContext | InboxContext | TasksContext | ContactsContext | PropertyDetailContext | ContactDetailContext | GenericContext;

// ---------- Context ----------

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

// ---------- Builder helpers ----------

export function buildDashboardContext(
    cases: CrmCase[],
    stats: { tasks: number; drafts: number; closed: number },
): DashboardContext {
    const actionOrder: Record<string, number> = { triage: 0, draft: 1, pending: 2, done: 3 };
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

    // Unified work-queue order: action type first, then priority within each group
    const workQueue = cases
        .filter(c => c.status !== "closed" && !c.name.startsWith("Agent Shift"))
        .filter(c => caseActionStatus(c).style !== "done")
        .sort((a, b) => {
            const actionDiff = (actionOrder[caseActionStatus(a).style] ?? 3) - (actionOrder[caseActionStatus(b).style] ?? 3);
            if (actionDiff !== 0) return actionDiff;
            return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
        });

    return {
        page: "dashboard",
        caseCount: cases.length,
        openCaseCount: cases.filter(c => c.status !== "closed").length,
        stats: {
            pendingTasks: stats.tasks,
            draftsToReview: stats.drafts,
            resolvedCases: stats.closed,
        },
        topCases: workQueue.slice(0, 15).map(c => ({
            id: c.id,
            name: c.name,
            priority: c.priority,
            status: c.status,
            actionStatus: caseActionStatus(c).text,
            propertyName: c.property?.name,
            description: c.description || undefined,
            pendingTasks: c.tasks?.filter(t => t.status !== "completed").map(t => t.name),
            draftSubjects: c.emails?.filter(e => e.status === "draft").map(e => e.subject),
        })),
    };
}

export function buildSituationContext(
    crmCase: CrmCase,
    emails: CrmEmail[],
    tasks: CrmTask[],
    notes: CrmNote[],
    contacts: CrmContact[],
): SituationContext {
    const draftEmails = emails.filter(e => e.status === "draft");
    const nonDraftEmails = emails.filter(e => e.status !== "draft");

    return {
        page: "situation",
        caseId: crmCase.id,
        caseName: crmCase.name,
        priority: crmCase.priority,
        status: crmCase.status,
        description: crmCase.description || "",
        propertyName: crmCase.property?.name,
        propertyManager: crmCase.property?.manager,
        propertyManagerEmail: crmCase.property?.manager_email,
        tasks: tasks.map(t => ({
            id: t.id,
            name: t.name,
            status: t.status,
            priority: t.priority,
            description: t.description || undefined,
            dueDate: t.date_end,
        })),
        drafts: draftEmails.map(d => ({
            id: d.id,
            subject: d.subject,
            to: d.to_addresses || [],
            bodyPlain: (d.body_plain || d.body || "").replace(/<[^>]*>/g, ''),
        })),
        emails: nonDraftEmails.map(e => ({
            id: e.id,
            subject: e.subject,
            from: e.from_address,
            to: e.to_addresses || [],
            bodyPlain: (e.body_plain || e.body || "").replace(/<[^>]*>/g, ''),
            dateSent: e.date_sent,
            status: e.status,
            threadId: e.thread_id,
            threadPosition: e.thread_position,
            isRead: e.is_read,
            senderName: contactName(e.contact) || undefined,
            senderType: e.contact?.type,
        })),
        notes: notes.map(n => ({
            id: n.id,
            content: n.content,
            createdAt: n.created_at,
        })),
        contacts: contacts.map(c => ({
            name: contactName(c) || c.email,
            type: c.type,
            email: c.email,
            company: c.company || undefined,
            unit: c.unit || undefined,
        })),
    };
}

export function buildPropertiesContext(
    properties: CrmProperty[],
    caseCounts: Record<number, number>,
    contactCounts: Record<number, number>,
): PropertiesContext {
    return {
        page: "properties",
        properties: properties.map(p => ({
            name: p.name,
            type: p.type,
            units: p.units,
            manager: p.manager,
            managerEmail: p.manager_email,
            description: p.description || undefined,
            caseCount: caseCounts[p.id] || 0,
            contactCount: contactCounts[p.id] || 0,
        })),
    };
}

export function buildSearchContext(
    query: string,
    results: CrmEmail[],
): SearchContext {
    return {
        page: "search",
        query,
        resultCount: results.length,
        topResults: results.slice(0, 10).map(e => ({
            subject: e.subject,
            sender: senderDisplay(e),
            dateSent: e.date_sent,
            bodySnippet: (e.body_plain || e.body || "").replace(/<[^>]*>/g, '').slice(0, 200) || undefined,
            caseId: e.case_id,
        })),
    };
}

export function buildInboxContext(
    threads: CrmThread[],
): InboxContext {
    return {
        page: "inbox",
        threadCount: threads.length,
        unreadCount: threads.filter(t => !t.is_read).length,
        draftCount: threads.filter(t => t.emails?.some(e => e.status === "draft")).length,
        threads: threads.slice(0, 30).map(t => ({
            threadId: t.thread_id,
            subject: t.subject,
            sender: contactName(t.contact) || "Unknown",
            emailCount: t.email_count,
            isRead: t.is_read,
            hasDraft: t.emails?.some(e => e.status === "draft") || false,
            caseId: t.case_id,
        })),
    };
}

export function buildTasksContext(
    tasks: CrmTask[],
    cases: Record<number, CrmCase>,
): TasksContext {
    return {
        page: "tasks",
        totalTasks: tasks.length,
        pendingCount: tasks.filter(t => t.status !== "completed").length,
        completedCount: tasks.filter(t => t.status === "completed").length,
        tasks: tasks.slice(0, 30).map(t => ({
            id: t.id,
            name: t.name,
            status: t.status,
            priority: t.priority,
            caseName: t.case_id ? cases[t.case_id]?.name : undefined,
            description: t.description ? t.description.slice(0, 200) : undefined,
        })),
    };
}

export function buildContactsContext(
    contacts: CrmContact[],
    properties: Record<number, CrmProperty>,
): ContactsContext {
    return {
        page: "contacts",
        totalContacts: contacts.length,
        contacts: contacts.slice(0, 40).map(c => ({
            id: c.id,
            name: contactName(c) || c.email,
            type: c.type,
            email: c.email,
            propertyName: c.property_id ? properties[c.property_id]?.name : undefined,
            unit: c.unit || undefined,
            company: c.company || undefined,
        })),
    };
}

export function buildPropertyDetailContext(
    property: CrmProperty,
    cases: CrmCase[],
    contacts: CrmContact[],
): PropertyDetailContext {
    const openCases = cases.filter(c => c.status !== "closed" && !c.name.startsWith("Agent Shift"));
    return {
        page: "propertyDetail",
        propertyId: property.id,
        propertyName: property.name,
        type: property.type,
        units: property.units,
        manager: property.manager,
        managerEmail: property.manager_email,
        openCaseCount: openCases.length,
        openCases: openCases.slice(0, 20).map(c => ({
            id: c.id,
            name: c.name,
            priority: c.priority,
            status: c.status,
            actionStatus: caseActionStatus(c).text,
            description: c.description ? c.description.slice(0, 200) : undefined,
        })),
        contactCount: contacts.length,
        contacts: contacts.slice(0, 20).map(c => ({
            id: c.id,
            name: contactName(c) || c.email,
            type: c.type,
            email: c.email,
            unit: c.unit || undefined,
        })),
    };
}

export function buildContactDetailContext(
    contact: CrmContact,
    cases: CrmCase[],
    emails: CrmEmail[],
    propertyName?: string,
): ContactDetailContext {
    const openCases = cases.filter(c => c.status !== "closed" && !c.name.startsWith("Agent Shift"));
    return {
        page: "contactDetail",
        contactId: contact.id,
        contactName: contactName(contact) || contact.email,
        contactType: contact.type,
        email: contact.email,
        propertyName,
        unit: contact.unit || undefined,
        company: contact.company || undefined,
        openCaseCount: openCases.length,
        openCases: openCases.slice(0, 15).map(c => ({
            id: c.id,
            name: c.name,
            priority: c.priority,
            description: c.description ? c.description.slice(0, 200) : undefined,
        })),
        recentEmails: emails.slice(0, 15).map(e => ({
            id: e.id,
            subject: e.subject,
            dateSent: e.date_sent,
        })),
    };
}

/** Serialize page data to a compact JSON string for the AI context field. */
export function serializePageContext(data: PageData | null): string {
    if (!data) return "";
    return JSON.stringify(data);
}
