"use client"

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Clock, Zap, MapPin, FileText, Check, X, Pencil, Users, StickyNote, MessageSquare, ChevronDown } from "lucide-react";
import Link from "next/link";
import { getCase, getRelatedEmails, getRelatedTasks, getNotes, contactName, senderDisplay, updateCase, updateTask, updateEmail } from "@/lib/crm";
import type { CrmCase, CrmEmail, CrmTask, CrmNote, CrmContact } from "@/lib/crm";
import { usePageData, buildSituationContext } from "@/lib/page-context";
import { UrgencyBadge } from "@/components/ui/Badge";
import { ContactBadge } from "@/components/ui/ContactBadge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { useParams } from "next/navigation";

function priorityToTier(priority: string): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
    switch (priority) {
        case "critical": return "CRITICAL";
        case "high": return "HIGH";
        case "medium": return "MEDIUM";
        case "low": return "LOW";
        default: return "MEDIUM";
    }
}

function tierLabel(tier: string) {
    switch (tier) {
        case "CRITICAL": return "CRITICAL";
        case "HIGH": return "HIGH";
        case "MEDIUM": return "MEDIUM";
        default: return "LOW";
    }
}

function initials(email: CrmEmail): string {
    const name = contactName(email.contact);
    if (name) {
        const parts = name.split(" ").filter(Boolean);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.slice(0, 2).toUpperCase();
    }
    const addr = email.from_address || "";
    const localPart = addr.split("@")[0].replace(/[._-]/g, " ");
    const parts = localPart.split(" ").filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return localPart.slice(0, 2).toUpperCase();
}

/** Group emails by thread_id */
function groupByThread(emails: CrmEmail[]): { threadId: string; emails: CrmEmail[] }[] {
    const groups = new Map<string, CrmEmail[]>();
    for (const email of emails) {
        const tid = email.thread_id || `single-${email.id}`;
        if (!groups.has(tid)) groups.set(tid, []);
        groups.get(tid)!.push(email);
    }
    // Sort threads by latest email date descending
    return Array.from(groups.entries())
        .map(([threadId, emails]) => ({
            threadId,
            emails: emails.sort((a, b) => (a.thread_position || 0) - (b.thread_position || 0)),
        }))
        .sort((a, b) => {
            const aDate = a.emails[a.emails.length - 1]?.date_sent || "";
            const bDate = b.emails[b.emails.length - 1]?.date_sent || "";
            return bDate.localeCompare(aDate);
        });
}

/** Extract unique contacts from emails */
function extractContacts(emails: CrmEmail[]): CrmContact[] {
    const seen = new Set<number>();
    const contacts: CrmContact[] = [];
    for (const email of emails) {
        if (email.contact && !seen.has(email.contact.id)) {
            seen.add(email.contact.id);
            contacts.push(email.contact);
        }
    }
    return contacts;
}

function EmailCard({ email, isFirst }: { email: CrmEmail; isFirst: boolean }) {
    const [expanded, setExpanded] = useState(false);
    const bodyText = (email.body_plain || email.body || "").replace(/<[^>]*>/g, '');
    const sender = senderDisplay(email);
    return (
        <Card
            data-ai-target={`email-${email.id}`}
            className={`p-4 border-transparent shadow-sm border-l-4 cursor-pointer transition-all ${isFirst ? "border-l-[#0F1016]/20 bg-[#F2F2EC]" : "border-l-[#0F1016]/10 bg-[#F2F2EC]"} hover:shadow-md`}
            onClick={() => setExpanded(!expanded)}
        >
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                    <div className="bg-[#0000EE]/10 text-[#0000EE] w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs">
                        {initials(email)}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="font-bold text-[#0F1016] text-sm">{sender}</p>
                            {email.contact && <ContactBadge type={email.contact.type} />}
                        </div>
                        <p className="text-[#0F1016]/80 text-sm font-medium">{email.subject}</p>
                    </div>
                </div>
                <span className="text-[10px] text-[#0F1016]/40 font-bold uppercase tracking-wider" suppressHydrationWarning>
                    {formatDistanceToNow(new Date(email.date_sent), { addSuffix: true })}
                </span>
            </div>
            {bodyText && (
                <div className={`bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm text-slate-700 font-sans leading-relaxed whitespace-pre-line ${expanded ? "" : "line-clamp-4"}`}>
                    {bodyText}
                </div>
            )}
        </Card>
    );
}

function ThreadGroup({ threadEmails }: { threadEmails: CrmEmail[] }) {
    const [expanded, setExpanded] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const firstEmail = threadEmails[0];
    const subject = firstEmail?.subject || "No subject";
    const threadId = firstEmail?.thread_id || `single-${firstEmail?.id}`;

    // Listen for ai-expand custom event from AIAssistant
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const handler = () => setExpanded(true);
        el.addEventListener("ai-expand", handler);
        return () => el.removeEventListener("ai-expand", handler);
    }, []);

    if (threadEmails.length === 1) {
        return <EmailCard email={firstEmail} isFirst={false} />;
    }

    return (
        <div className="space-y-0" ref={ref} data-ai-target={`thread-${threadId}`}>
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-2 text-left bg-[#F2F2EC] rounded-[14px] p-3 hover:bg-[#EDEDEA] transition-colors"
            >
                <MessageSquare className="w-3.5 h-3.5 text-[#0F1016]/40" />
                <span className="text-sm font-serif font-medium text-[#0F1016] flex-1 truncate">{subject}</span>
                <span className="text-[10px] font-sans font-bold text-[#0F1016]/40 uppercase">{threadEmails.length} emails</span>
                <ChevronDown className={`w-3.5 h-3.5 text-[#0F1016]/40 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
            {expanded && (
                <div className="space-y-2 mt-2 pl-2 border-l-2 border-[#0F1016]/10 ml-4">
                    {threadEmails.map((email, i) => (
                        <EmailCard key={email.id} email={email} isFirst={i === 0} />
                    ))}
                </div>
            )}
        </div>
    );
}

function DraftCard({ draft, onUpdate }: { draft: CrmEmail; onUpdate: (e: CrmEmail) => void }) {
    const [editing, setEditing] = useState(false);
    const [editBody, setEditBody] = useState(draft.body?.replace(/<[^>]*>/g, '') || "");
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateEmail(draft.id, { body: editBody, body_plain: editBody });
            onUpdate({ ...draft, body: editBody, body_plain: editBody });
            setEditing(false);
        } catch (e) {
            console.error("Failed to save draft:", e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card data-ai-target={`draft-${draft.id}`} className="shadow-sm border-transparent bg-[#F2F2EC] mb-4">
            <div className="border-b border-[#0F1016]/5 p-3 px-4 flex justify-between items-center bg-violet-50 rounded-t-xl">
                <h3 className="font-bold text-violet-700 flex items-center text-[10px] tracking-[0.2em] uppercase">
                    Draft Response
                </h3>
            </div>
            <div className="p-4 border-b border-[#0F1016]/5 space-y-2 text-[13px]">
                <div className="flex font-medium"><span className="w-16 text-[#0F1016]/40 font-bold uppercase text-[10px] pt-0.5">To:</span> <span className="text-[#0F1016]">{(draft.to_addresses || []).join(", ")}</span></div>
                <div className="flex font-medium"><span className="w-16 text-[#0F1016]/40 font-bold uppercase text-[10px] pt-0.5">Subject:</span> <span className="text-[#0F1016]">{draft.subject}</span></div>
            </div>
            {editing ? (
                <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    className="w-full p-4 bg-white font-sans text-sm text-[#0F1016] leading-relaxed min-h-[120px] resize-y outline-none focus:ring-2 focus:ring-[#0000EE]/20"
                    autoFocus
                />
            ) : (
                <div className="p-4 bg-white/50 font-sans text-sm text-[#0F1016]/80 leading-relaxed italic whitespace-pre-line">
                    {draft.body?.replace(/<[^>]*>/g, '') || ""}
                </div>
            )}
            <div className="p-3 bg-[#0F1016]/5 rounded-b-xl border-t border-[#0F1016]/5 flex justify-end items-center">
                {editing ? (
                    <div className="flex gap-2">
                        <Button variant="secondary" size="sm" className="rounded-full shadow-sm text-[10px] font-bold uppercase tracking-wider" onClick={() => { setEditing(false); setEditBody(draft.body?.replace(/<[^>]*>/g, '') || ""); }}>
                            <X className="w-3 h-3 mr-1" /> Cancel
                        </Button>
                        <Button size="sm" className="rounded-full shadow-sm text-[10px] font-bold uppercase tracking-wider" onClick={handleSave} disabled={saving}>
                            <Check className="w-3 h-3 mr-1" /> {saving ? "Saving..." : "Save"}
                        </Button>
                    </div>
                ) : (
                    <Button variant="secondary" size="sm" className="rounded-full shadow-sm text-[10px] font-bold uppercase tracking-wider" onClick={() => setEditing(true)}>
                        <Pencil className="w-3 h-3 mr-1" /> Edit
                    </Button>
                )}
            </div>
        </Card>
    );
}

export default function SituationDetail() {
    const params = useParams();
    const id = params.id as string;
    const [crmCase, setCrmCase] = useState<CrmCase | null>(null);
    const [emails, setEmails] = useState<CrmEmail[]>([]);
    const [tasks, setTasks] = useState<CrmTask[]>([]);
    const [notes, setNotes] = useState<CrmNote[]>([]);
    const [loading, setLoading] = useState(true);
    const { setData } = usePageData();

    useEffect(() => {
        Promise.all([
            getCase(Number(id), "property").catch(() => null),
            getRelatedEmails(Number(id)).catch(() => []),
            getRelatedTasks(Number(id)).catch(() => []),
            getNotes(Number(id)).catch(() => []),
        ]).then(([c, e, t, n]) => {
            setCrmCase(c);
            setEmails(e);
            setTasks(t);
            setNotes(n);
            setLoading(false);
            if (c) {
                const contacts = extractContacts(e);
                setData(buildSituationContext(c, e, t, n, contacts));
            }
        });
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F7F7F2]">
                <p className="text-slate-400 font-sans">Loading situation...</p>
            </div>
        );
    }

    if (!crmCase) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F7F7F2]">
                <p className="text-slate-400 font-sans">Situation not found.</p>
            </div>
        );
    }

    const tier = priorityToTier(crmCase.priority);
    const draftEmails = emails.filter(e => e.status === "draft");
    const nonDraftEmails = emails.filter(e => e.status !== "draft");
    const threadGroups = groupByThread(nonDraftEmails);
    const relatedContacts = extractContacts(emails);
    const propertyName = crmCase.property?.name;

    // Group contacts by type
    const contactsByType = new Map<string, CrmContact[]>();
    for (const contact of relatedContacts) {
        const type = contact.type || "other";
        if (!contactsByType.has(type)) contactsByType.set(type, []);
        contactsByType.get(type)!.push(contact);
    }

    return (
        <div className="min-h-screen flex flex-col relative z-0 bg-[#F7F7F2]">
            <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#FF8A00] opacity-[0.03] blur-[120px] rounded-full" />
                <div className="absolute bottom-[20%] left-[-10%] w-[40%] h-[40%] bg-[#0000EE] opacity-[0.02] blur-[120px] rounded-full" />
            </div>

            <header className="sticky top-0 z-50 bg-[#F7F7F2]/80 backdrop-blur-md">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-10 flex items-center justify-between">
                    <Link href="/" className="flex items-center text-[#0F1016]/60 hover:text-[#0000EE] transition-colors bg-[#F2F2EC] hover:bg-[#0000EE]/5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                        <ArrowLeft className="w-3 h-3 mr-1.5" /> Back to Dashboard
                    </Link>
                    <div className="flex gap-3">
                        {crmCase.status !== "closed" ? (
                            <Button
                                size="fixed"
                                className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-4 py-1.5 rounded-full shadow-sm text-sm hover:-translate-y-0.5 transition-all"
                                onClick={async () => {
                                    await updateCase(crmCase.id, { status: "closed" });
                                    setCrmCase({ ...crmCase, status: "closed" });
                                }}
                            >
                                <Check className="w-4 h-4 mr-1.5" /> Close Case
                            </Button>
                        ) : (
                            <span className="px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-sm font-bold border border-emerald-200">Closed</span>
                        )}
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8">

                    {/* Left Panel */}
                    <div className="lg:col-span-7 flex flex-col gap-6">

                        {/* Header */}
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <UrgencyBadge tier={tier}>{tierLabel(tier)}</UrgencyBadge>
                                        <span className="text-[10px] font-sans font-bold text-[#0F1016]/60 bg-[#F2F2EC] px-2 py-0.5 rounded uppercase tracking-wider">{crmCase.status}</span>
                                    </div>
                                    <h1 className="text-2xl font-serif font-medium text-[#0F1016] tracking-tight leading-tight">{crmCase.name}</h1>
                                    {propertyName && (
                                        <p className="text-[#0F1016]/60 flex items-center mt-1 text-sm font-medium">
                                            <MapPin className="w-3.5 h-3.5 mr-1.5 text-[#0F1016]/40" />
                                            {propertyName}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-4 text-[10px] font-sans font-bold text-[#0F1016]/40 uppercase tracking-[0.2em] border-b border-[#0F1016]/5 pb-3 mt-4">
                                <span className="flex items-center" suppressHydrationWarning><Clock className="w-3 h-3 mr-1" /> Opened: {formatDistanceToNow(new Date(crmCase.created_at), { addSuffix: true })}</span>
                            </div>
                        </motion.div>

                        {/* AI Summary */}
                        {crmCase.description && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                                <Card className="border-[#0000EE]/20 overflow-hidden shadow-sm relative bg-[#F2F2EC]">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-[#0000EE]"></div>
                                    <div className="bg-[#0000EE]/5 border-b border-[#0000EE]/10 p-3 px-5 flex justify-between items-center">
                                        <h3 className="font-bold text-[#0000EE] flex items-center text-[10px] tracking-[0.2em] uppercase">
                                            <Zap className="w-4 h-4 mr-2 text-[#0000EE] fill-[#0000EE]" /> AI Summary
                                        </h3>
                                    </div>
                                    <div className="p-5">
                                        <p className="text-[#0F1016] leading-relaxed font-sans text-[15px] whitespace-pre-line">
                                            {crmCase.description}
                                        </p>
                                    </div>
                                </Card>
                            </motion.div>
                        )}

                        {/* Recommended Actions (Tasks) — shown first, above communications */}
                        {tasks.length > 0 && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                                <Card className="border-[#0000EE]/30 shadow-sm overflow-hidden border-2 relative bg-[#F2F2EC]">
                                    <div className="bg-[#0000EE] p-3 px-5 flex justify-between items-center text-white">
                                        <h3 className="font-bold flex items-center text-[10px] tracking-[0.2em] uppercase">
                                            <Zap className="w-4 h-4 mr-2 text-white/70 fill-white" /> Recommended Actions
                                        </h3>
                                    </div>
                                    <div className="p-1">
                                        {tasks.map((task, i) => (
                                            <div key={task.id} data-ai-target={`task-${task.id}`} className={`p-4 hover:bg-white/30 transition-colors ${i < tasks.length - 1 ? "border-b border-[#0F1016]/5" : ""}`}>
                                                <div className="flex items-start gap-3">
                                                    <input
                                                        type="checkbox"
                                                        className="mt-1 rounded border-[#0F1016]/20 text-[#0000EE] focus:ring-[#0000EE] w-4 h-4 cursor-pointer"
                                                        checked={task.status === "completed"}
                                                        onChange={async () => {
                                                            const newStatus = task.status === "completed" ? "not_started" : "completed";
                                                            await updateTask(task.id, { status: newStatus });
                                                            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
                                                        }}
                                                    />
                                                    <div className="flex-1">
                                                        <h4 className="font-bold text-[#0F1016] text-sm">{task.name}</h4>
                                                        {task.priority && (
                                                            <div className="flex text-[10px] font-bold uppercase tracking-wider text-[#0F1016]/60 gap-3 mt-1.5 font-sans">
                                                                <span className="px-1.5 py-0.5 rounded bg-white border border-[#0F1016]/5">Priority: {task.priority}</span>
                                                                {task.date_end && <span className="px-1.5 py-0.5 rounded bg-white border border-[#0F1016]/5">Due: {new Date(task.date_end).toLocaleDateString()}</span>}
                                                            </div>
                                                        )}
                                                        {task.description && (
                                                            <p className="text-sm text-[#0F1016]/80 mt-2 bg-white/50 border border-[#0F1016]/5 p-2 rounded italic">
                                                                {task.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </motion.div>
                        )}

                        {/* Draft Responses — shown after tasks */}
                        {draftEmails.length > 0 && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                                {draftEmails.map(draft => (
                                    <DraftCard key={draft.id} draft={draft} onUpdate={(updated) => {
                                        setEmails(prev => prev.map(e => e.id === updated.id ? updated : e));
                                    }} />
                                ))}
                            </motion.div>
                        )}

                        {/* Communications Timeline — grouped by thread */}
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                            <div className="flex justify-between items-center mb-4 mt-2">
                                <h3 className="text-lg font-serif font-medium text-[#0F1016] flex items-center">
                                    Communications <span className="ml-2 bg-[#F2F2EC] text-[#0F1016]/60 text-[10px] px-2 py-0.5 rounded-full font-bold">{nonDraftEmails.length}</span>
                                </h3>
                            </div>
                            <div className="space-y-3">
                                {threadGroups.map(group => (
                                    <ThreadGroup key={group.threadId} threadEmails={group.emails} />
                                ))}
                                {nonDraftEmails.length === 0 && (
                                    <p className="text-sm text-slate-400 italic">No communications yet</p>
                                )}
                            </div>
                        </motion.div>
                    </div>

                    {/* Right Panel */}
                    <div className="lg:col-span-5 flex flex-col gap-6">

                        {/* Related Contacts */}
                        {relatedContacts.length > 0 && (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
                                <Card className="shadow-sm border-transparent bg-[#F2F2EC]">
                                    <div className="border-b border-[#0F1016]/5 p-3 px-4 bg-[#0F1016]/5 rounded-t-xl">
                                        <h3 className="font-bold text-[#0F1016] text-[10px] uppercase tracking-[0.2em] flex items-center">
                                            <Users className="w-3.5 h-3.5 mr-2" /> Related Contacts
                                        </h3>
                                    </div>
                                    <div className="p-4 space-y-4">
                                        {Array.from(contactsByType.entries()).map(([type, contacts]) => (
                                            <div key={type}>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <ContactBadge type={type} />
                                                    <span className="text-[10px] font-sans font-bold text-[#0F1016]/40 uppercase">{contacts.length}</span>
                                                </div>
                                                {contacts.map(contact => (
                                                    <div key={contact.id} className="flex items-center gap-3 py-2">
                                                        <div className="bg-[#0000EE]/10 text-[#0000EE] w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs">
                                                            {(contact.first_name?.[0] || "") + (contact.last_name?.[0] || "")  }
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-[#0F1016] text-sm">{contactName(contact)}</p>
                                                            {contact.company && <p className="text-[11px] text-[#0F1016]/50 font-sans">{contact.company}</p>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </motion.div>
                        )}

                        {/* Agent Notes */}
                        {notes.length > 0 && (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                                <Card className="shadow-sm border-transparent bg-[#F2F2EC]">
                                    <div className="border-b border-[#0F1016]/5 p-3 px-4 bg-[#0F1016]/5 rounded-t-xl">
                                        <h3 className="font-bold text-[#0F1016] text-[10px] uppercase tracking-[0.2em] flex items-center">
                                            <StickyNote className="w-3.5 h-3.5 mr-2" /> Agent Notes
                                        </h3>
                                    </div>
                                    <div className="p-1">
                                        {notes.map((note, i) => (
                                            <div key={note.id} data-ai-target={`note-${note.id}`} className={`p-4 ${i < notes.length - 1 ? "border-b border-[#0F1016]/5" : ""}`}>
                                                <p className="text-sm text-[#0F1016]/80 font-sans leading-relaxed whitespace-pre-line">{note.content}</p>
                                                <p className="text-[10px] text-[#0F1016]/40 font-bold uppercase tracking-wider mt-2" suppressHydrationWarning>
                                                    {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </motion.div>
                        )}

                        {/* Property Context */}
                        {crmCase.property && (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                                <Card className="shadow-sm border-transparent bg-[#F2F2EC]">
                                    <div className="border-b border-[#0F1016]/5 p-3 px-4 bg-[#0F1016]/5 rounded-t-xl">
                                        <h3 className="font-bold text-[#0F1016] text-[10px] uppercase tracking-[0.2em] flex items-center">
                                            <FileText className="w-3.5 h-3.5 mr-2" /> Property
                                        </h3>
                                    </div>
                                    <div className="p-4 space-y-2">
                                        <p className="font-bold text-[#0F1016] text-sm">{crmCase.property.name}</p>
                                        <div className="flex gap-3 text-[11px] text-[#0F1016]/60 font-sans">
                                            <span>{crmCase.property.type}</span>
                                            <span>{crmCase.property.units} units</span>
                                        </div>
                                        {crmCase.property.manager && (
                                            <p className="text-[11px] text-[#0F1016]/50 font-sans">Manager: {crmCase.property.manager}</p>
                                        )}
                                    </div>
                                </Card>
                            </motion.div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
