"use client"

import React, { createContext, useContext, useState } from "react";
import type { CrmCase, CrmTask, CrmNote, CrmContact, CrmProperty } from "./crm";
import { contactName, caseActionStatus } from "./crm";

// ---------- Types for structured page context ----------

interface DashboardContext {
    page: "dashboard";
    caseCount: number;
    openCaseCount: number;
    stats: { pendingTasks: number; draftsToReview: number; resolvedCases: number };
    topCases: { id: number; name: string; priority: string; status: string; actionStatus: string; propertyName?: string }[];
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
    taskCount: number;
    tasks: { name: string; status: string; priority: string; dueDate?: string }[];
    draftCount: number;
    contactNames: { name: string; type: string }[];
    noteCount: number;
}

interface PropertiesContext {
    page: "properties";
    properties: { name: string; type: string; units: number; manager: string; caseCount: number; contactCount: number }[];
}

interface SearchContext {
    page: "search";
    query: string;
    resultCount: number;
    topResults: { subject: string; sender: string; dateSent: string }[];
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
    const openCases = cases.filter(c => c.status !== "closed");
    return {
        page: "dashboard",
        caseCount: cases.length,
        openCaseCount: openCases.length,
        stats: {
            pendingTasks: stats.tasks,
            draftsToReview: stats.drafts,
            resolvedCases: stats.closed,
        },
        topCases: openCases.slice(0, 15).map(c => ({
            id: c.id,
            name: c.name,
            priority: c.priority,
            status: c.status,
            actionStatus: caseActionStatus(c).text,
            propertyName: c.property?.name,
        })),
    };
}

export function buildSituationContext(
    crmCase: CrmCase,
    tasks: CrmTask[],
    notes: CrmNote[],
    contacts: CrmContact[],
): SituationContext {
    return {
        page: "situation",
        caseId: crmCase.id,
        caseName: crmCase.name,
        priority: crmCase.priority,
        status: crmCase.status,
        description: crmCase.description || "",
        propertyName: crmCase.property?.name,
        propertyManager: crmCase.property?.manager,
        taskCount: tasks.length,
        tasks: tasks.map(t => ({
            name: t.name,
            status: t.status,
            priority: t.priority,
            dueDate: t.date_end,
        })),
        draftCount: 0, // will be set by the page
        contactNames: contacts.map(c => ({
            name: contactName(c) || c.email,
            type: c.type,
        })),
        noteCount: notes.length,
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
            caseCount: caseCounts[p.id] || 0,
            contactCount: contactCounts[p.id] || 0,
        })),
    };
}

export function buildSearchContext(
    query: string,
    results: { subject: string; sender: string; dateSent: string }[],
): SearchContext {
    return {
        page: "search",
        query,
        resultCount: results.length,
        topResults: results.slice(0, 10),
    };
}

/** Serialize page data to a compact JSON string for the AI context field. */
export function serializePageContext(data: PageData | null): string {
    if (!data) return "";
    return JSON.stringify(data);
}
