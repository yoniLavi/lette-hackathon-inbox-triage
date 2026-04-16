"use client"

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Search, Mail, ArrowLeft, ExternalLink, FileEdit } from "lucide-react";

function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "";
    try { return format(new Date(dateStr), "MMM d, yyyy h:mm a"); } catch { return ""; }
}
import { getThreads, searchEmails, contactName } from "@/lib/crm";
import type { CrmThread, CrmEmail } from "@/lib/crm";
import { usePageData, buildInboxContext } from "@/lib/page-context";
import { unescapeMarkdown } from "@/lib/unescape-markdown";
import { ContactBadge } from "@/components/ui/ContactBadge";
import { Card } from "@/components/ui/Card";
import { DraftEditor } from "@/components/dashboard/DraftEditor";

function InboxEmailCard({ email, onUpdate, onDiscard }: { email: CrmEmail; onUpdate: (e: CrmEmail) => void; onDiscard?: () => void }) {
    const isDraft = email.status === "draft";
    return (
        <Card
            data-email-id={email.id}
            className={`overflow-hidden ${isDraft ? "border-violet-200 bg-violet-50/30" : "bg-[#F2F2EC] border-transparent"}`}
        >
            <div className={`px-5 py-3 border-b ${isDraft ? "border-violet-200 bg-violet-50" : "border-[#0F1016]/5"}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {isDraft && (
                            <span className="text-[9px] font-sans font-bold text-violet-600 uppercase tracking-widest bg-violet-100 px-2 py-0.5 rounded-full">
                                Draft
                            </span>
                        )}
                        <span className="text-sm font-sans font-medium text-[#0F1016]">
                            {email.from_address}
                        </span>
                    </div>
                    <span className="text-[11px] text-[#0F1016]/40 font-sans">
                        {formatDate(email.date_sent)}
                    </span>
                </div>
                {email.to_addresses?.length > 0 && (
                    <p className="text-[11px] text-[#0F1016]/40 font-sans mt-0.5">
                        To: {email.to_addresses.join(", ")}
                    </p>
                )}
            </div>
            {isDraft ? (
                <DraftEditor email={email} onUpdate={onUpdate} onDiscard={onDiscard} />
            ) : (
                <div className="px-5 py-4 text-sm font-sans text-[#0F1016] leading-relaxed whitespace-pre-line">
                    {unescapeMarkdown(email.body_plain || email.body) || "(no body)"}
                </div>
            )}
        </Card>
    );
}

export default function InboxPage() {
    const searchParams = useSearchParams();
    const highlightEmailId = searchParams.get("email") ? Number(searchParams.get("email")) : null;

    const [threads, setThreads] = useState<CrmThread[]>([]);
    const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
    const { setData } = usePageData();
    const [search, setSearch] = useState("");
    const [searchResults, setSearchResults] = useState<CrmEmail[] | null>(null);
    const [filter, setFilter] = useState<"all" | "unread" | "drafts">("all");
    const searchTimeout = useRef<NodeJS.Timeout | null>(null);
    const emailRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        getThreads("emails,contact", 200).then(all => {
            // Sort by last_activity_at desc
            const sorted = all.sort((a, b) =>
                new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()
            );
            setThreads(sorted);
            setData(buildInboxContext(sorted));

            // If URL has ?email=N, find and select its thread
            if (highlightEmailId) {
                const thread = sorted.find(t =>
                    t.emails?.some(e => e.id === highlightEmailId)
                );
                if (thread) {
                    setSelectedThreadId(thread.thread_id);
                }
            } else if (sorted.length > 0) {
                setSelectedThreadId(sorted[0].thread_id);
            }
        }).catch(() => {});
    }, [highlightEmailId]);

    // Scroll to highlighted email after thread loads
    useEffect(() => {
        if (highlightEmailId && selectedThreadId) {
            setTimeout(() => {
                const el = document.querySelector(`[data-email-id="${highlightEmailId}"]`);
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
                el?.classList.add("ai-highlight");
            }, 300);
        }
    }, [highlightEmailId, selectedThreadId]);

    // Debounced search — combines server full-text with client-side sender/recipient matching
    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (!search.trim()) {
            setSearchResults(null);
            return;
        }
        searchTimeout.current = setTimeout(() => {
            searchEmails(search, 50).then(setSearchResults).catch(() => {});
        }, 300);
    }, [search]);

    const filteredThreads = threads.filter(t => {
        if (filter === "unread") return !t.is_read;
        if (filter === "drafts") return t.emails?.some(e => e.status === "draft");
        return true;
    });

    // If searching, combine server results (body/subject) with client-side (sender, recipient, contact)
    const displayThreads = (() => {
        if (!search.trim()) return filteredThreads;
        const q = search.toLowerCase();

        // Server-matched thread IDs
        const serverMatchIds = new Set((searchResults || []).map(e => e.thread_id).filter(Boolean));

        // Client-side match on sender, recipients, contact name
        return filteredThreads.filter(t => {
            if (serverMatchIds.has(t.thread_id)) return true;
            const name = (contactName(t.contact) || "").toLowerCase();
            if (name.includes(q)) return true;
            if (t.subject?.toLowerCase().includes(q)) return true;
            return t.emails?.some(e =>
                e.from_address?.toLowerCase().includes(q) ||
                e.to_addresses?.some(addr => addr.toLowerCase().includes(q))
            );
        });
    })();

    const selectedThread = threads.find(t => t.thread_id === selectedThreadId);
    const selectedEmails = (selectedThread?.emails || []).sort(
        (a, b) => (a.thread_position || 0) - (b.thread_position || 0)
    );

    const hasDraft = selectedEmails.some(e => e.status === "draft");

    return (
        <div className="min-h-screen flex flex-col relative z-0 bg-[#F7F7F2]">
            <header className="sticky top-0 z-50 bg-[#F7F7F2]/80 backdrop-blur-md">
                <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 h-10 flex items-center justify-between">
                    <Link href="/" className="flex items-center text-[#0F1016]/60 hover:text-[#0000EE] transition-colors bg-[#F2F2EC] hover:bg-[#0000EE]/5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                        <ArrowLeft className="w-3 h-3 mr-1.5" /> Dashboard
                    </Link>
                    <div className="font-sans font-bold text-[#0F1016] text-sm uppercase tracking-[0.2em]">Inbox</div>
                    <div></div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-[1920px] mx-auto flex" style={{ height: "calc(100vh - 100px)" }}>
                {/* Left pane: thread list */}
                <div className="w-[380px] flex-shrink-0 border-r border-[#0F1016]/5 flex flex-col">
                    {/* Search + filters */}
                    <div className="p-3 space-y-2 border-b border-[#0F1016]/5">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F1016]/30" />
                            <input
                                type="text"
                                placeholder="Search emails..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-[#F2F2EC] border border-transparent focus:border-[#0000EE]/30 rounded-full text-sm font-sans text-[#0F1016] placeholder:text-[#0F1016]/30 outline-none transition-colors"
                            />
                        </div>
                        <div className="flex gap-1.5">
                            {(["all", "unread", "drafts"] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                                        filter === f ? "bg-[#0000EE] text-white" : "bg-[#F2F2EC] text-[#0F1016]/50 hover:text-[#0000EE]"
                                    }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Thread list */}
                    <div className="flex-1 overflow-y-auto">
                        {displayThreads.map(t => {
                            const isSelected = t.thread_id === selectedThreadId;
                            const threadHasDraft = t.emails?.some(e => e.status === "draft");
                            return (
                                <div
                                    key={t.thread_id}
                                    onClick={() => setSelectedThreadId(t.thread_id)}
                                    className={`px-4 py-3 border-b border-[#0F1016]/5 cursor-pointer transition-colors ${
                                        isSelected ? "bg-[#0000EE]/5 border-l-2 border-l-[#0000EE]" : "hover:bg-[#F2F2EC]"
                                    }`}
                                >
                                    <div className="flex items-start gap-2">
                                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${t.is_read ? "bg-transparent" : "bg-[#0000EE]"}`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className={`text-sm font-sans truncate flex-1 ${!t.is_read ? "font-bold text-[#0F1016]" : "text-[#0F1016]/70"}`}>
                                                    {contactName(t.contact) || "Unknown"}
                                                </p>
                                                {threadHasDraft && <FileEdit className="w-3 h-3 text-violet-500 flex-shrink-0" />}
                                            </div>
                                            <p className="text-[13px] font-serif text-[#0F1016] truncate mt-0.5">{t.subject}</p>
                                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#0F1016]/40 font-sans">
                                                <span>{formatDate(t.last_activity_at)}</span>
                                                <span>{t.email_count} email{t.email_count !== 1 ? "s" : ""}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {displayThreads.length === 0 && threads.length > 0 && (
                            <p className="text-sm text-slate-400 italic text-center py-8">No threads match.</p>
                        )}
                        {threads.length === 0 && (
                            <p className="text-sm text-slate-400 italic text-center py-8">Loading...</p>
                        )}
                    </div>
                </div>

                {/* Right pane: email thread view */}
                <div className="flex-1 overflow-y-auto" ref={emailRef}>
                    {selectedThread ? (
                        <div className="max-w-4xl mx-auto p-6">
                            {/* Thread header */}
                            <div className="mb-6">
                                <h1 className="text-2xl font-serif font-medium text-[#0F1016] mb-2">
                                    {selectedThread.subject}
                                </h1>
                                <div className="flex items-center gap-3 text-sm font-sans text-[#0F1016]/50">
                                    {selectedThread.contact && (
                                        <Link href={`/contacts/${selectedThread.contact.id}`} className="flex items-center gap-1.5 hover:text-[#0000EE] transition-colors">
                                            <ContactBadge type={selectedThread.contact.type} />
                                            {contactName(selectedThread.contact)}
                                        </Link>
                                    )}
                                    <span>{selectedThread.email_count} email{selectedThread.email_count !== 1 ? "s" : ""}</span>
                                    {selectedThread.case_id && (
                                        <Link href={`/cases/${selectedThread.case_id}`} className="flex items-center gap-1 text-[#0000EE] hover:underline">
                                            <ExternalLink className="w-3 h-3" /> View case
                                        </Link>
                                    )}
                                    {hasDraft && (
                                        <span className="flex items-center gap-1 text-violet-600">
                                            <FileEdit className="w-3 h-3" /> Has draft reply
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Emails in thread */}
                            <div className="space-y-4">
                                {selectedEmails.map(email => (
                                    <InboxEmailCard key={email.id} email={email} onUpdate={updated => {
                                        setThreads(prev => prev.map(t => t.thread_id === selectedThreadId
                                            ? { ...t, emails: t.emails?.map(e => e.id === updated.id ? updated : e) }
                                            : t
                                        ));
                                    }} onDiscard={() => {
                                        setThreads(prev => prev.map(t => t.thread_id === selectedThreadId
                                            ? { ...t, emails: t.emails?.filter(e => e.id !== email.id), email_count: (t.email_count || 1) - 1 }
                                            : t
                                        ));
                                    }} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <Mail className="w-12 h-12 text-[#0F1016]/10 mx-auto mb-3" />
                                <p className="text-sm text-slate-400 italic">Select a thread to view</p>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
