"use client"

import React, { createContext, useContext, useState } from "react";
import type { CrmCase, CrmEmail, CrmTask, CrmNote, CrmContact, CrmProperty } from "./crm";
import { contactName, caseActionStatus, senderDisplay } from "./crm";

// ---------- Types for structured page context ----------

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
        propertyName?: string;
        description?: string;
        pendingTasks?: string[];
        draftSubjects?: string[];
    }[];
}

interface SituationEmailContext {
    id: number;
    subject: string;
    from: string;
    to: string[];
    bodyPlain: string;
    dateSent: string;
    status: string;
    threadId?: string;
    threadPosition?: number;
    isRead: boolean;
    senderName?: string;
    senderType?: string;
}

interface SituationDraftContext {
    id: number;
    subject: string;
    to: string[];
    bodyPlain: string;
}

interface SituationTaskContext {
    id: number;
    name: string;
    status: string;
    priority: string;
    description?: string;
    dueDate?: string;
}

interface SituationContext {
    page: "situation";
    caseId: number;
    caseName: string;
    priority: string;
    status: string;
    description: string;
    propertyName?: string;
    propertyManager?: string;
    propertyManagerEmail?: string;
    tasks: SituationTaskContext[];
    drafts: SituationDraftContext[];
    emails: SituationEmailContext[];
    notes: { id: number; content: string; createdAt: string }[];
    contacts: { name: string; type: string; email: string; company?: string; unit?: string }[];
}

interface PropertiesContext {
    page: "properties";
    properties: {
        name: string;
        type: string;
        units: number;
        manager: string;
        managerEmail: string;
        description?: string;
        caseCount: number;
        contactCount: number;
    }[];
}

interface SearchContext {
    page: "search";
    query: string;
    resultCount: number;
    topResults: {
        subject: string;
        sender: string;
        dateSent: string;
        bodySnippet?: string;
        caseId?: number;
    }[];
}

interface GenericContext {
    page: string;
}

export type PageData = DashboardContext | SituationContext | PropertiesContext | SearchContext | GenericContext;

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

/** Serialize page data to a compact JSON string for the AI context field. */
export function serializePageContext(data: PageData | null): string {
    if (!data) return "";
    return JSON.stringify(data);
}
