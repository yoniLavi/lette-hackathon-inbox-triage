"use client"

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Building2, Mail, Users } from "lucide-react";
import { getProperty, getCases, getContacts, getThreads } from "@/lib/crm";
import type { CrmProperty, CrmCase, CrmContact, CrmThread } from "@/lib/crm";
import { contactName } from "@/lib/crm";
import { usePageData, buildPropertyDetailContext } from "@/lib/page-context";
import { unescapeMarkdown } from "@/lib/unescape-markdown";
import { SituationCard } from "@/components/dashboard/SituationCard";
import { ContactBadge } from "@/components/ui/ContactBadge";
import { Card } from "@/components/ui/Card";

function priorityToTier(priority: string): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
    switch (priority) {
        case "critical":
        case "urgent": return "CRITICAL";
        case "high": return "HIGH";
        case "low": return "LOW";
        default: return "MEDIUM";
    }
}

export default function PropertyDetail() {
    const { id } = useParams<{ id: string }>();
    const [property, setProperty] = useState<CrmProperty | null>(null);
    const [cases, setCases] = useState<CrmCase[]>([]);
    const [contacts, setContacts] = useState<CrmContact[]>([]);
    const [threads, setThreads] = useState<CrmThread[]>([]);
    const { setData } = usePageData();

    useEffect(() => {
        if (!id) return;
        const pid = Number(id);

        getProperty(pid).then(setProperty).catch(() => {});

        getCases("emails,tasks,property").then(all => {
            setCases(all.filter(c => c.property_id === pid));
        }).catch(() => {});

        getContacts({ property_id: String(pid) }).then(setContacts).catch(() => {});

        getThreads("contact").then(all => {
            setThreads(all.filter(t => t.property_id === pid));
        }).catch(() => {});
    }, [id]);

    // Set page context for AI when data loads
    useEffect(() => {
        if (property && cases.length > 0) {
            setData(buildPropertyDetailContext(property, cases, contacts));
        }
    }, [property, cases, contacts]);

    if (!property) {
        return (
            <div className="min-h-screen bg-[#F7F7F2] flex items-center justify-center">
                <p className="text-sm text-slate-400 italic">Loading property...</p>
            </div>
        );
    }

    const openCases = cases.filter(c => c.status !== "closed" && !c.name.startsWith("Agent Shift"));
    const closedCases = cases.filter(c => c.status === "closed" && !c.name.startsWith("Agent Shift"));

    // Group contacts by type
    const contactsByType: Record<string, CrmContact[]> = {};
    for (const c of contacts) {
        const t = c.type || "other";
        if (!contactsByType[t]) contactsByType[t] = [];
        contactsByType[t].push(c);
    }
    const typeOrder = ["tenant", "landlord", "contractor", "prospect", "internal", "legal", "other"];

    return (
        <div className="min-h-screen flex flex-col relative z-0 bg-[#F7F7F2]">
            <header className="sticky top-0 z-50 bg-[#F7F7F2]/80 backdrop-blur-md">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-10 flex items-center justify-between">
                    <Link href="/properties" className="flex items-center text-[#0F1016]/60 hover:text-[#0000EE] transition-colors bg-[#F2F2EC] hover:bg-[#0000EE]/5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                        <ArrowLeft className="w-3 h-3 mr-1.5" /> Properties
                    </Link>
                    <div></div>
                    <div></div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
                {/* Property header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <Building2 className="w-6 h-6 text-[#0F1016]/40" />
                        <h1 className="text-3xl font-serif font-medium text-[#0F1016]">{property.name}</h1>
                    </div>
                    <div className="flex items-center gap-4 text-sm font-sans text-[#0F1016]/60">
                        <span className="bg-[#0F1016]/10 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">{property.type}</span>
                        <span>{property.units} units</span>
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {property.manager}</span>
                        <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {property.manager_email}</span>
                    </div>
                    {property.description && (
                        <div className="mt-3 text-sm text-[#0F1016]/70 prose prose-sm max-w-none">
                            <ReactMarkdown>{unescapeMarkdown(property.description)}</ReactMarkdown>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left: Cases */}
                    <div className="lg:col-span-8 space-y-6">
                        {/* Open cases */}
                        <section>
                            <h2 className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">
                                Open Cases
                                <span className="ml-4 h-px flex-1 bg-slate-200"></span>
                                <span className="ml-4 text-[#0000EE]">{openCases.length}</span>
                            </h2>
                            <div className="space-y-3">
                                {openCases.map(c => (
                                    <SituationCard key={c.id} crmCase={c} tier={priorityToTier(c.priority)} />
                                ))}
                                {openCases.length === 0 && (
                                    <p className="text-sm text-slate-400 italic">No open cases for this property.</p>
                                )}
                            </div>
                        </section>

                        {/* Recent threads */}
                        {threads.length > 0 && (
                            <section>
                                <h2 className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">
                                    Recent Threads
                                    <span className="ml-4 h-px flex-1 bg-slate-200"></span>
                                    <span className="ml-4">{threads.length}</span>
                                </h2>
                                <div className="space-y-2">
                                    {threads.slice(0, 10).map(t => {
                                        const firstEmailId = t.emails?.[0]?.id;
                                        return (
                                        <Link key={t.id} href={firstEmailId ? `/inbox?email=${firstEmailId}` : "/inbox"}>
                                        <Card className="p-3 bg-[#F2F2EC] border-transparent hover:border-black/5 transition-all">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-serif font-medium text-[#0F1016] truncate">{t.subject}</p>
                                                    <div className="flex items-center gap-2 mt-0.5 text-[10px] font-sans text-[#0F1016]/40 uppercase tracking-wider">
                                                        {t.contact && <span>{contactName(t.contact)}</span>}
                                                        <span>{t.email_count} email{t.email_count !== 1 ? "s" : ""}</span>
                                                        {t.case_id && (
                                                            <span className="text-[#0000EE]">
                                                                Case linked
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className={`w-2 h-2 rounded-full mt-1.5 ${t.is_read ? "bg-slate-200" : "bg-[#0000EE]"}`} />
                                            </div>
                                        </Card>
                                        </Link>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {/* Closed cases */}
                        {closedCases.length > 0 && (
                            <section>
                                <h2 className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">
                                    Resolved
                                    <span className="ml-4 h-px flex-1 bg-slate-200"></span>
                                    <span className="ml-4">{closedCases.length}</span>
                                </h2>
                                <div className="space-y-2">
                                    {closedCases.map(c => (
                                        <Card key={c.id} className="p-3 bg-[#F2F2EC]/50 border-transparent">
                                            <Link href={`/cases/${c.id}`} className="text-sm font-serif text-[#0F1016]/50 hover:text-[#0000EE] transition-colors">
                                                {c.name}
                                            </Link>
                                        </Card>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>

                    {/* Right: Contacts */}
                    <div className="lg:col-span-4">
                        <h2 className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">
                            Contacts
                            <span className="ml-4 h-px flex-1 bg-slate-200"></span>
                            <span className="ml-4">{contacts.length}</span>
                        </h2>
                        <div className="space-y-4">
                            {typeOrder.filter(t => contactsByType[t]?.length).map(type => (
                                <div key={type}>
                                    <div className="text-[10px] font-sans font-bold text-[#0F1016]/30 uppercase tracking-widest mb-2">
                                        {type}s
                                    </div>
                                    <div className="space-y-1.5">
                                        {contactsByType[type].map(c => (
                                            <Link key={c.id} href={`/contacts/${c.id}`} className="block">
                                                <Card className="p-2.5 bg-[#F2F2EC] border-transparent hover:border-black/5 transition-all">
                                                    <div className="flex items-center gap-2">
                                                        <ContactBadge type={c.type} />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-sans font-medium text-[#0F1016] truncate">
                                                                {contactName(c) || c.email}
                                                            </p>
                                                            <p className="text-[10px] text-[#0F1016]/40 truncate">
                                                                {c.email}{c.unit ? ` · ${c.unit}` : ""}{c.company ? ` · ${c.company}` : ""}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </Card>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {contacts.length === 0 && (
                                <p className="text-sm text-slate-400 italic">No contacts linked to this property.</p>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
