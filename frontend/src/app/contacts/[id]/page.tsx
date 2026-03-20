"use client"

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Mail, Briefcase } from "lucide-react";
import { getContact, getProperty, getCases, getEmails, getTasks, contactName } from "@/lib/crm";
import type { CrmContact, CrmProperty, CrmCase, CrmEmail, CrmTask } from "@/lib/crm";
import { usePageData, buildContactDetailContext } from "@/lib/page-context";
import { ContactBadge } from "@/components/ui/ContactBadge";
import { SituationCard } from "@/components/dashboard/SituationCard";
import { Card } from "@/components/ui/Card";
import { format } from "date-fns";

function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "";
    try { return format(new Date(dateStr), "MMM d, yyyy"); } catch { return ""; }
}

function priorityToTier(priority: string): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
    switch (priority) {
        case "critical":
        case "urgent": return "CRITICAL";
        case "high": return "HIGH";
        case "low": return "LOW";
        default: return "MEDIUM";
    }
}

export default function ContactDetail() {
    const { id } = useParams<{ id: string }>();
    const [contact, setContact] = useState<CrmContact | null>(null);
    const [property, setProperty] = useState<CrmProperty | null>(null);
    const { setData } = usePageData();
    const [cases, setCases] = useState<CrmCase[]>([]);
    const [emails, setEmails] = useState<CrmEmail[]>([]);
    const [tasks, setTasks] = useState<CrmTask[]>([]);

    useEffect(() => {
        if (!id) return;
        const cid = Number(id);

        getContact(cid).then(c => {
            setContact(c);
            if (c.property_id) {
                getProperty(c.property_id).then(setProperty).catch(() => {});
            }

            // Get emails from this contact (exclude drafts — those are replies drafted on their behalf)
            getEmails(100, { from_address: c.email, include: "contact" }).then(all => {
                setEmails(all.filter(e => e.status !== "draft"));
            }).catch(() => {});

            // Get tasks assigned to this contact
            getTasks(50, { contact_id: String(cid) }).then(setTasks).catch(() => {});
        }).catch(() => {});

        // Get all cases (with includes) to cross-reference
        getCases("emails,tasks,property").then(setCases).catch(() => {});
    }, [id]);

    // Set page context for AI
    useEffect(() => {
        if (contact && cases.length > 0) {
            const contactCaseIds = new Set(emails.filter(e => e.status !== "draft").map(e => e.case_id).filter(Boolean));
            for (const t of tasks) if (t.case_id) contactCaseIds.add(t.case_id);
            const contactCases = cases.filter(c => contactCaseIds.has(c.id));
            setData(buildContactDetailContext(contact, contactCases, emails.filter(e => e.status !== "draft"), property?.name));
        }
    }, [contact, cases, emails, tasks, property]);

    if (!contact) {
        return (
            <div className="min-h-screen bg-[#F7F7F2] flex items-center justify-center">
                <p className="text-sm text-slate-400 italic">Loading contact...</p>
            </div>
        );
    }

    // Derive cases this contact is involved in (via emails)
    const contactCaseIds = new Set(emails.map(e => e.case_id).filter(Boolean));
    // Also add cases from tasks assigned to this contact
    for (const t of tasks) if (t.case_id) contactCaseIds.add(t.case_id);

    const contactCases = cases.filter(c => contactCaseIds.has(c.id) && !c.name.startsWith("Agent Shift"));
    const openCases = contactCases.filter(c => c.status !== "closed");
    const closedCases = contactCases.filter(c => c.status === "closed");

    // Recent emails from this contact
    const recentEmails = emails.slice(0, 15);

    return (
        <div className="min-h-screen flex flex-col relative z-0 bg-[#F7F7F2]">
            <header className="sticky top-0 z-50 bg-[#F7F7F2]/80 backdrop-blur-md">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-10 flex items-center justify-between">
                    <Link href="/contacts" className="flex items-center text-[#0F1016]/60 hover:text-[#0000EE] transition-colors bg-[#F2F2EC] hover:bg-[#0000EE]/5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                        <ArrowLeft className="w-3 h-3 mr-1.5" /> Contacts
                    </Link>
                    <div></div>
                    <div></div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
                {/* Contact header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <ContactBadge type={contact.type} />
                        <h1 className="text-3xl font-serif font-medium text-[#0F1016]">
                            {contactName(contact) || contact.email}
                        </h1>
                    </div>
                    <div className="flex items-center gap-4 text-sm font-sans text-[#0F1016]/60 flex-wrap">
                        <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {contact.email}</span>
                        {property && (
                            <Link href={`/properties/${property.id}`} className="flex items-center gap-1 hover:text-[#0000EE] transition-colors">
                                <Building2 className="w-3.5 h-3.5" /> {property.name}
                            </Link>
                        )}
                        {contact.unit && <span>Unit {contact.unit}</span>}
                        {contact.company && <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {contact.company}</span>}
                        {contact.role && <span>{contact.role}</span>}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left: Cases */}
                    <div className="lg:col-span-8 space-y-6">
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
                                    <p className="text-sm text-slate-400 italic">No open cases involving this contact.</p>
                                )}
                            </div>
                        </section>

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

                    {/* Right: Recent emails + tasks */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Tasks assigned to this contact */}
                        {tasks.length > 0 && (
                            <section>
                                <h2 className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">
                                    Assigned Tasks
                                    <span className="ml-4 h-px flex-1 bg-slate-200"></span>
                                    <span className="ml-4">{tasks.length}</span>
                                </h2>
                                <div className="space-y-1.5">
                                    {tasks.map(t => (
                                        <Card key={t.id} className="p-2.5 bg-[#F2F2EC] border-transparent">
                                            <div className="flex items-start gap-2">
                                                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${t.status === "completed" ? "bg-emerald-500" : "bg-amber-500"}`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-sans text-[#0F1016] truncate">{t.name}</p>
                                                    <div className="text-[10px] text-[#0F1016]/40 font-sans uppercase tracking-wider">
                                                        {t.status.replace("_", " ")}
                                                        {t.case_id && (
                                                            <> · <Link href={`/cases/${t.case_id}`} className="text-[#0000EE] hover:underline">View case</Link></>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Recent emails */}
                        {recentEmails.length > 0 && (
                            <section>
                                <h2 className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">
                                    Recent Emails
                                    <span className="ml-4 h-px flex-1 bg-slate-200"></span>
                                    <span className="ml-4">{recentEmails.length}</span>
                                </h2>
                                <div className="space-y-1.5">
                                    {recentEmails.map(e => (
                                        <Link key={e.id} href={`/inbox?email=${e.id}`}>
                                        <Card className="p-2.5 bg-[#F2F2EC] border-transparent hover:border-black/5 transition-all">
                                            <p className="text-sm font-serif text-[#0F1016] truncate">{e.subject}</p>
                                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#0F1016]/40 font-sans">
                                                <span>{formatDate(e.date_sent)}</span>
                                                {e.case_id && (
                                                    <span className="text-[#0000EE] uppercase tracking-wider">
                                                        View in inbox →
                                                    </span>
                                                )}
                                            </div>
                                        </Card>
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
