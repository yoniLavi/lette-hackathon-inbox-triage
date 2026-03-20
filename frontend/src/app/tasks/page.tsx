"use client"

import { useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { ArrowLeft, Search, CheckCircle2, Circle, Clock, ExternalLink, Send } from "lucide-react";
import { getTasks, getContacts, getProperties, getCases, getTaskNotes, createNote, contactName, updateTask } from "@/lib/crm";
import type { CrmTask, CrmContact, CrmProperty, CrmCase, CrmNote } from "@/lib/crm";
import { usePageData, buildTasksContext } from "@/lib/page-context";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "";
    try { return format(new Date(dateStr), "MMM d, yyyy"); } catch { return ""; }
}

const priorityStyles: Record<string, string> = {
    urgent: "text-red-600 bg-red-50 border-red-200",
    normal: "text-amber-600 bg-amber-50 border-amber-200",
    low: "text-slate-500 bg-slate-50 border-slate-200",
};

const statusOptions = [
    { value: "not_started", label: "Not Started", icon: Circle, color: "text-slate-400" },
    { value: "in_progress", label: "In Progress", icon: Clock, color: "text-amber-500" },
    { value: "completed", label: "Completed", icon: CheckCircle2, color: "text-emerald-500" },
];

export default function TasksPage() {
    const [tasks, setTasks] = useState<CrmTask[]>([]);
    const [contacts, setContacts] = useState<Record<number, CrmContact>>({});
    const [properties, setProperties] = useState<Record<number, CrmProperty>>({});
    const [cases, setCases] = useState<Record<number, CrmCase>>({});
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [search, setSearch] = useState("");
    const { setData } = usePageData();
    const [filter, setFilter] = useState<"all" | "pending" | "completed">("pending");

    // Task detail state
    const [notes, setNotes] = useState<CrmNote[]>([]);
    const [newComment, setNewComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [statusUpdating, setStatusUpdating] = useState(false);

    useEffect(() => {
        Promise.all([
            getTasks(200).catch(() => []),
            getContacts().catch(() => []),
            getProperties().catch(() => []),
            getCases().catch(() => []),
        ]).then(([t, c, p, cs]) => {
            setTasks(t);
            if (t.length > 0) setSelectedId(t[0].id);

            const cm: Record<number, CrmContact> = {};
            for (const ct of c) cm[ct.id] = ct;
            setContacts(cm);

            const pm: Record<number, CrmProperty> = {};
            for (const pr of p) pm[pr.id] = pr;
            setProperties(pm);

            const csm: Record<number, CrmCase> = {};
            for (const ca of cs as CrmCase[]) csm[ca.id] = ca;
            setCases(csm);
            setData(buildTasksContext(t, csm));
        });
    }, []);

    // Load notes when selected task changes
    useEffect(() => {
        if (!selectedId) { setNotes([]); return; }
        getTaskNotes(selectedId).then(setNotes).catch(() => setNotes([]));
    }, [selectedId]);

    const filtered = tasks.filter(t => {
        if (filter === "pending") return t.status !== "completed";
        if (filter === "completed") return t.status === "completed";
        return true;
    }).filter(t => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const caseObj = t.case_id ? cases[t.case_id] : null;
        return t.name.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q) || (caseObj?.name || "").toLowerCase().includes(q);
    });

    const selected = tasks.find(t => t.id === selectedId);
    const selectedCase = selected?.case_id ? cases[selected.case_id] : null;
    const selectedContact = selected?.contact_id ? contacts[selected.contact_id] : null;
    const selectedProperty = selectedCase?.property_id ? properties[selectedCase.property_id] : null;

    const pendingCount = tasks.filter(t => t.status !== "completed").length;
    const completedCount = tasks.filter(t => t.status === "completed").length;

    const handleStatusChange = async (newStatus: string) => {
        if (!selected || statusUpdating) return;
        setStatusUpdating(true);
        try {
            await updateTask(selected.id, { status: newStatus });
            setTasks(prev => prev.map(t => t.id === selected.id ? { ...t, status: newStatus } : t));
        } catch (e) {
            console.error("Failed to update task:", e);
        } finally {
            setStatusUpdating(false);
        }
    };

    const handleAddComment = async () => {
        if (!selected || !newComment.trim() || submitting) return;
        setSubmitting(true);
        try {
            const note = await createNote({ content: newComment.trim(), task_id: selected.id });
            setNotes(prev => [...prev, note]);
            setNewComment("");
        } catch (e) {
            console.error("Failed to add comment:", e);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col relative z-0 bg-[#F7F7F2]">
            <header className="sticky top-0 z-50 bg-[#F7F7F2]/80 backdrop-blur-md">
                <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 h-10 flex items-center justify-between">
                    <Link href="/" className="flex items-center text-[#0F1016]/60 hover:text-[#0000EE] transition-colors bg-[#F2F2EC] hover:bg-[#0000EE]/5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                        <ArrowLeft className="w-3 h-3 mr-1.5" /> Dashboard
                    </Link>
                    <div className="font-sans font-bold text-[#0F1016] text-sm uppercase tracking-[0.2em]">Tasks</div>
                    <div></div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-[1920px] mx-auto flex" style={{ height: "calc(100vh - 100px)" }}>
                {/* Left pane: task list */}
                <div className="w-[380px] flex-shrink-0 border-r border-[#0F1016]/5 flex flex-col">
                    <div className="p-3 space-y-2 border-b border-[#0F1016]/5">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F1016]/30" />
                            <input
                                type="text"
                                placeholder="Search tasks..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-[#F2F2EC] border border-transparent focus:border-[#0000EE]/30 rounded-full text-sm font-sans text-[#0F1016] placeholder:text-[#0F1016]/30 outline-none transition-colors"
                            />
                        </div>
                        <div className="flex gap-1.5">
                            {([["all", `All (${tasks.length})`], ["pending", `Pending (${pendingCount})`], ["completed", `Done (${completedCount})`]] as const).map(([f, label]) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider transition-colors cursor-pointer ${filter === f ? "bg-[#0000EE] text-white" : "bg-[#F2F2EC] text-[#0F1016]/50 hover:text-[#0000EE]"}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {filtered.map(t => {
                            const isSelected = t.id === selectedId;
                            const caseObj = t.case_id ? cases[t.case_id] : null;
                            const isCompleted = t.status === "completed";
                            const StatusIcon = statusOptions.find(s => s.value === t.status)?.icon || Circle;
                            const statusColor = statusOptions.find(s => s.value === t.status)?.color || "text-slate-400";
                            return (
                                <div
                                    key={t.id}
                                    onClick={() => setSelectedId(t.id)}
                                    className={`px-4 py-3 border-b border-[#0F1016]/5 cursor-pointer transition-colors ${
                                        isSelected ? "bg-[#0000EE]/5 border-l-2 border-l-[#0000EE]" : "hover:bg-[#F2F2EC]"
                                    }`}
                                >
                                    <div className="flex items-start gap-2">
                                        <StatusIcon className={`w-4 h-4 mt-0.5 ${statusColor}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-sans truncate ${isCompleted ? "text-[#0F1016]/40 line-through" : "text-[#0F1016] font-medium"}`}>
                                                {t.name}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#0F1016]/40 font-sans">
                                                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${priorityStyles[t.priority] || priorityStyles.normal}`}>
                                                    {t.priority}
                                                </span>
                                                {caseObj && <span className="truncate">{caseObj.name}</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {filtered.length === 0 && tasks.length > 0 && (
                            <p className="text-sm text-slate-400 italic text-center py-8">No tasks match.</p>
                        )}
                        {tasks.length === 0 && (
                            <p className="text-sm text-slate-400 italic text-center py-8">Loading...</p>
                        )}
                    </div>
                </div>

                {/* Right pane: task detail */}
                <div className="flex-1 overflow-y-auto">
                    {selected ? (
                        <div className="max-w-3xl mx-auto p-6">
                            {/* Header */}
                            <div className="mb-6">
                                <h1 className={`text-2xl font-serif font-medium mb-3 ${selected.status === "completed" ? "text-[#0F1016]/40 line-through" : "text-[#0F1016]"}`}>
                                    {selected.name}
                                </h1>

                                <div className="flex flex-wrap items-center gap-3 text-sm font-sans text-[#0F1016]/50">
                                    {/* Status dropdown */}
                                    <select
                                        value={selected.status}
                                        onChange={e => handleStatusChange(e.target.value)}
                                        disabled={statusUpdating}
                                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border outline-none cursor-pointer transition-colors ${
                                            selected.status === "completed" ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                                            : selected.status === "in_progress" ? "bg-amber-50 text-amber-600 border-amber-200"
                                            : "bg-slate-50 text-slate-500 border-slate-200"
                                        }`}
                                    >
                                        {statusOptions.map(s => (
                                            <option key={s.value} value={s.value}>{s.label}</option>
                                        ))}
                                    </select>

                                    <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${priorityStyles[selected.priority] || priorityStyles.normal}`}>
                                        {selected.priority}
                                    </span>
                                    {selected.date_end && (
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5" /> Due {formatDate(selected.date_end)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Links */}
                            <div className="flex flex-wrap gap-3 mb-6">
                                {selectedCase && (
                                    <Link href={`/cases/${selectedCase.id}`} className="flex items-center gap-1.5 text-sm text-[#0000EE] hover:underline font-sans">
                                        <ExternalLink className="w-3.5 h-3.5" /> {selectedCase.name}
                                    </Link>
                                )}
                                {selectedContact && (
                                    <Link href={`/contacts/${selectedContact.id}`} className="text-sm text-[#0F1016]/50 hover:text-[#0000EE] font-sans transition-colors">
                                        Assigned to: {contactName(selectedContact)}
                                    </Link>
                                )}
                                {selectedProperty && (
                                    <Link href={`/properties/${selectedProperty.id}`} className="text-sm text-[#0F1016]/50 hover:text-[#0000EE] font-sans transition-colors">
                                        {selectedProperty.name}
                                    </Link>
                                )}
                            </div>

                            {/* Description */}
                            {selected.description && (
                                <Card className="p-5 bg-[#F2F2EC] border-transparent mb-6">
                                    <div className="prose prose-sm max-w-none text-[#0F1016] font-sans">
                                        <ReactMarkdown>{selected.description}</ReactMarkdown>
                                    </div>
                                </Card>
                            )}

                            {/* Comments */}
                            <section>
                                <h2 className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">
                                    Comments
                                    <span className="ml-4 h-px flex-1 bg-slate-200"></span>
                                    {notes.length > 0 && <span className="ml-4">{notes.length}</span>}
                                </h2>

                                {notes.length > 0 && (
                                    <div className="space-y-2 mb-4">
                                        {notes.map(n => (
                                            <Card key={n.id} className="p-3 bg-[#F2F2EC] border-transparent">
                                                <p className="text-sm font-sans text-[#0F1016] whitespace-pre-line">{n.content}</p>
                                                <p className="text-[10px] text-[#0F1016]/30 font-sans mt-1.5">
                                                    {formatDate(n.created_at)}
                                                </p>
                                            </Card>
                                        ))}
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Add a comment..."
                                        value={newComment}
                                        onChange={e => setNewComment(e.target.value)}
                                        onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleAddComment()}
                                        className="flex-1 px-4 py-2 bg-[#F2F2EC] border border-transparent focus:border-[#0000EE]/30 rounded-full text-sm font-sans text-[#0F1016] placeholder:text-[#0F1016]/30 outline-none transition-colors"
                                    />
                                    <Button
                                        size="sm"
                                        className="rounded-full text-[10px] font-bold uppercase tracking-wider"
                                        onClick={handleAddComment}
                                        disabled={!newComment.trim() || submitting}
                                    >
                                        <Send className="w-3 h-3 mr-1" /> {submitting ? "..." : "Save"}
                                    </Button>
                                </div>
                            </section>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <CheckCircle2 className="w-12 h-12 text-[#0F1016]/10 mx-auto mb-3" />
                                <p className="text-sm text-slate-400 italic">Select a task to view details</p>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
