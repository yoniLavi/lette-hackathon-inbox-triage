"use client"

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Play, Clock, CheckCircle2, XCircle, Mail, ChevronDown, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getShifts, getShift, getUnreadThreads, contactName } from "@/lib/crm";
import type { CrmShift, CrmThread } from "@/lib/crm";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8001";

function formatDuration(startedAt: string, completedAt: string | null): string {
    if (!completedAt) return "running...";
    const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins}m ${remSecs}s`;
}

function ElapsedTimer({ startedAt }: { startedAt: string }) {
    const [elapsed, setElapsed] = useState("");
    useEffect(() => {
        const update = () => {
            const secs = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
            const mins = Math.floor(secs / 60);
            const rem = secs % 60;
            setElapsed(mins > 0 ? `${mins}m ${rem}s` : `${rem}s`);
        };
        update();
        const id = setInterval(update, 1000);
        return () => clearInterval(id);
    }, [startedAt]);
    return <span className="text-xs text-blue-500/70 font-sans font-mono">{elapsed}</span>;
}

function formatTime(iso: string): string {
    return new Date(iso).toLocaleString("en-IE", {
        month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        in_progress: "bg-blue-50 text-blue-600 border-blue-200",
        completed: "bg-emerald-50 text-emerald-600 border-emerald-200",
        failed: "bg-red-50 text-red-600 border-red-200",
    };
    const icons: Record<string, React.ReactNode> = {
        in_progress: <Clock className="w-3 h-3 mr-1 animate-pulse" />,
        completed: <CheckCircle2 className="w-3 h-3 mr-1" />,
        failed: <XCircle className="w-3 h-3 mr-1" />,
    };
    return (
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-sans font-bold uppercase tracking-wider ${styles[status] || styles.failed}`}>
            {icons[status]}{status.replace("_", " ")}
        </span>
    );
}

function ShiftCard({ shift, defaultExpanded }: { shift: CrmShift; defaultExpanded?: boolean }) {
    const [expanded, setExpanded] = useState(defaultExpanded || false);
    const isRunning = shift.status === "in_progress";

    return (
        <Card className="bg-[#F2F2EC] border-transparent overflow-hidden">
            <button
                onClick={() => !isRunning && setExpanded(!expanded)}
                className={`w-full text-left p-4 flex items-center gap-3 transition-colors ${isRunning ? "cursor-default" : "hover:bg-[#EDEDE7]"}`}
            >
                {!isRunning && (
                    expanded
                        ? <ChevronDown className="w-4 h-4 text-[#0F1016]/40 flex-shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-[#0F1016]/40 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={shift.status} />
                        <span className="text-xs text-[#0F1016]/50 font-sans">
                            {formatTime(shift.started_at)}
                        </span>
                        {isRunning
                            ? <ElapsedTimer startedAt={shift.started_at} />
                            : <span className="text-xs text-[#0F1016]/40 font-sans">
                                {formatDuration(shift.started_at, shift.completed_at)}
                            </span>
                        }
                    </div>
                    {isRunning ? (
                        <div className="mt-1.5">
                            <p className="text-xs text-blue-600/70 font-sans italic animate-pulse">
                                {shift.summary || "Starting shift..."}
                            </p>
                            {(shift.threads_processed > 0 || shift.emails_processed > 0) && (
                                <div className="flex gap-3 mt-1 text-[11px] text-[#0F1016]/40 font-sans">
                                    <span>{shift.threads_processed} thread{shift.threads_processed !== 1 ? "s" : ""} read</span>
                                    <span>{shift.emails_processed} email{shift.emails_processed !== 1 ? "s" : ""} read</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex gap-4 mt-1 text-xs text-[#0F1016]/60 font-sans">
                            <span>{shift.threads_processed} threads</span>
                            <span>{shift.emails_processed} emails</span>
                            {shift.drafts_created > 0 && <span>{shift.drafts_created} drafts</span>}
                            {shift.tasks_created > 0 && <span>{shift.tasks_created} tasks</span>}
                            {shift.cost_usd != null && <span className="text-[#0F1016]/40">${shift.cost_usd.toFixed(2)}</span>}
                        </div>
                    )}
                </div>
            </button>

            {!isRunning && expanded && (
                <div className="px-4 pb-4 border-t border-[#0F1016]/5">
                    {shift.summary && (
                        <pre className="mt-3 text-xs text-[#0F1016]/70 font-sans whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto">
                            {shift.summary}
                        </pre>
                    )}
                    {shift.case_id && (
                        <div className="mt-3">
                            <Link
                                href={`/situations/${shift.case_id}`}
                                className="text-xs text-[#0000EE] hover:underline font-sans font-bold"
                            >
                                View shift journal &rarr;
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
}

export default function ShiftsPage() {
    const [shifts, setShifts] = useState<CrmShift[]>([]);
    const [backlogThreads, setBacklogThreads] = useState<CrmThread[]>([]);
    const [backlogTotal, setBacklogTotal] = useState(0);
    const [activeShiftId, setActiveShiftId] = useState<number | null>(null);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const loadData = useCallback(async () => {
        const [shiftsData, backlog] = await Promise.all([
            getShifts().catch(() => []),
            getUnreadThreads().catch(() => ({ threads: [], total: 0 })),
        ]);
        setShifts(shiftsData);
        setBacklogThreads(backlog.threads);
        setBacklogTotal(backlog.total);

        // Detect in-progress shift
        const running = shiftsData.find((s: CrmShift) => s.status === "in_progress");
        if (running) {
            setActiveShiftId(running.id);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Poll for active shift progress
    useEffect(() => {
        if (!activeShiftId) {
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
            return;
        }

        pollRef.current = setInterval(async () => {
            try {
                const shift = await getShift(activeShiftId);
                if (shift.status !== "in_progress") {
                    setActiveShiftId(null);
                    await loadData(); // refresh everything
                } else {
                    // Update the in-progress shift in the list
                    setShifts(prev => prev.map(s => s.id === activeShiftId ? shift : s));
                }
            } catch {
                // ignore polling errors
            }
        }, 3000);

        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };
    }, [activeShiftId, loadData]);

    const startShift = async () => {
        setStarting(true);
        setError(null);
        try {
            const resp = await fetch(`${AGENT_URL}/shift`, { method: "POST" });
            if (resp.status === 409) {
                setError("Agent is busy with another request.");
                setStarting(false);
                return;
            }
            if (!resp.ok) {
                setError(`Failed to start shift: ${resp.statusText}`);
                setStarting(false);
                return;
            }
            const data = await resp.json();
            setActiveShiftId(data.shift_id);
            // Add a placeholder shift to the list
            const newShift: CrmShift = {
                id: data.shift_id,
                started_at: new Date().toISOString(),
                completed_at: null,
                status: "in_progress",
                threads_processed: 0,
                emails_processed: 0,
                drafts_created: 0,
                tasks_created: 0,
                summary: null,
                cost_usd: null,
                case_id: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            setShifts(prev => [newShift, ...prev]);
        } catch (e) {
            setError(`Failed to start shift: ${e}`);
        } finally {
            setStarting(false);
        }
    };

    const isRunning = activeShiftId !== null;

    return (
        <div className="min-h-screen flex flex-col relative z-0 bg-[#F7F7F2]">
            <header className="sticky top-0 z-50 bg-[#F7F7F2]/80 backdrop-blur-md">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-10 flex items-center justify-between">
                    <Link href="/" className="flex items-center text-[#0F1016]/60 hover:text-[#0000EE] transition-colors bg-[#F2F2EC] hover:bg-[#0000EE]/5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                        <ArrowLeft className="w-3 h-3 mr-1.5" /> Dashboard
                    </Link>
                    <div className="font-sans font-bold text-[#0F1016] text-sm uppercase tracking-[0.2em]">Shifts</div>
                    <div></div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-[1200px] mx-auto p-4 sm:p-6 lg:p-8">
                {/* Trigger section */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-serif font-medium text-[#0F1016]">AI Shifts</h1>
                        <p className="text-sm text-[#0F1016]/50 font-sans mt-1">
                            Batch email triage by the AI agent
                        </p>
                    </div>
                    <button
                        onClick={startShift}
                        disabled={isRunning || starting}
                        className={`
                            inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-sans font-bold
                            transition-all duration-200
                            ${isRunning || starting
                                ? "bg-[#0F1016]/10 text-[#0F1016]/40 cursor-not-allowed"
                                : "bg-[#0000EE] text-white hover:bg-[#0000CC] shadow-md hover:shadow-lg"
                            }
                        `}
                    >
                        {isRunning ? (
                            <>
                                <Clock className="w-4 h-4 animate-pulse" />
                                Shift Running...
                            </>
                        ) : starting ? (
                            <>
                                <Clock className="w-4 h-4 animate-spin" />
                                Starting...
                            </>
                        ) : (
                            <>
                                <Play className="w-4 h-4" />
                                Start Shift
                            </>
                        )}
                    </button>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-sans">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Shift history */}
                    <div className="lg:col-span-2">
                        <h2 className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">
                            Shift History
                            <span className="ml-4 h-px flex-1 bg-slate-200"></span>
                            <span className="ml-4 text-[#0000EE]">{shifts.length}</span>
                        </h2>
                        <div className="space-y-3">
                            {shifts.map((s, i) => (
                                <ShiftCard key={s.id} shift={s} defaultExpanded={i === 0 || s.status === "in_progress"} />
                            ))}
                            {shifts.length === 0 && (
                                <Card className="bg-[#F2F2EC] border-transparent p-8 text-center">
                                    <p className="text-sm text-[#0F1016]/50 font-sans">
                                        No shifts yet. Click &quot;Start Shift&quot; to run your first AI triage session.
                                    </p>
                                </Card>
                            )}
                        </div>
                    </div>

                    {/* Backlog */}
                    <div>
                        <h2 className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">
                            Email Backlog
                            <span className="ml-4 h-px flex-1 bg-slate-200"></span>
                            <span className="ml-4 text-[#FF8A00]">{backlogTotal}</span>
                        </h2>

                        <Card className="bg-[#F2F2EC] border-transparent p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Mail className="w-4 h-4 text-[#FF8A00]" />
                                <span className="text-sm font-sans font-bold text-[#0F1016]">
                                    {backlogTotal} unprocessed thread{backlogTotal !== 1 ? "s" : ""}
                                </span>
                            </div>

                            {backlogThreads.length > 0 ? (
                                <div className="space-y-2">
                                    {backlogThreads.slice(0, 15).map(thread => (
                                        <div key={thread.id} className="flex items-start gap-2 text-xs font-sans">
                                            <span className="text-[#0F1016]/30 mt-0.5 flex-shrink-0">&bull;</span>
                                            <div className="min-w-0">
                                                <div className="text-[#0F1016]/80 truncate">{thread.subject}</div>
                                                <div className="text-[#0F1016]/40">
                                                    {thread.contact ? contactName(thread.contact) : "Unknown"} &middot; {thread.email_count} email{thread.email_count !== 1 ? "s" : ""}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {backlogTotal > 15 && (
                                        <p className="text-[11px] text-[#0F1016]/40 font-sans italic pt-1">
                                            + {backlogTotal - 15} more threads
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-[#0F1016]/40 font-sans italic">
                                    All caught up! No unprocessed threads.
                                </p>
                            )}
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}
