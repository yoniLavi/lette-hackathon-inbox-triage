"use client"

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Play, Clock, CheckCircle2, XCircle, Mail, ChevronDown, ChevronRight, AlertTriangle, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getShifts, getShift, getUnreadThreads, getCasesCreatedDuring, getCasesUpdatedDuring, contactName } from "@/lib/crm";
import type { CrmShift, CrmThread, CrmCase } from "@/lib/crm";
import { SituationCard } from "@/components/dashboard/SituationCard";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8001";

function formatDuration(startedAt: string, completedAt: string | null, status?: string): string {
    if (!completedAt) {
        if (status === "failed") return "interrupted";
        if (status === "completed") return "";
        return "running...";
    }
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

function priorityToTier(priority: string): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
    switch (priority?.toLowerCase()) {
        case "critical": return "CRITICAL";
        case "high": return "HIGH";
        case "low": return "LOW";
        default: return "MEDIUM";
    }
}

function ShiftCard({ shift, defaultExpanded }: { shift: CrmShift; defaultExpanded?: boolean }) {
    const [expanded, setExpanded] = useState(defaultExpanded || false);
    const [casesExpanded, setCasesExpanded] = useState(false);
    const [updatedExpanded, setUpdatedExpanded] = useState(false);
    const [createdCases, setCreatedCases] = useState<CrmCase[]>([]);
    const [updatedCases, setUpdatedCases] = useState<CrmCase[]>([]);
    const [casesLoaded, setCasesLoaded] = useState(false);
    const isRunning = shift.status === "in_progress";
    const isFailed = shift.status === "failed";

    const fetchCases = useCallback(async () => {
        const after = shift.started_at;
        const before = shift.completed_at || new Date().toISOString();
        const isRealCase = (c: CrmCase) => !c.name.startsWith("Agent Shift");
        const [created, updated] = await Promise.all([
            getCasesCreatedDuring(after, before).catch(() => []),
            getCasesUpdatedDuring(after, before).catch(() => []),
        ]);
        const filteredCreated = created.filter(isRealCase);
        // Updated = modified during shift but NOT created during shift
        const createdIds = new Set(created.map(c => c.id));
        const filteredUpdated = updated.filter(c => isRealCase(c) && !createdIds.has(c.id));
        setCreatedCases(filteredCreated);
        setUpdatedCases(filteredUpdated);
        setCasesLoaded(true);
    }, [shift.started_at, shift.completed_at, shift.case_id]);

    // Fetch cases when expanded or running
    useEffect(() => {
        if ((!expanded && !isRunning) || casesLoaded) return;
        fetchCases();
    }, [expanded, isRunning, casesLoaded, fetchCases]);

    // Re-fetch cases periodically during active shift
    useEffect(() => {
        if (!isRunning) return;
        const interval = setInterval(fetchCases, 5000);
        return () => clearInterval(interval);
    }, [isRunning, fetchCases]);

    return (
        <Card className={`border-transparent overflow-hidden ${isFailed ? "bg-red-50/80" : "bg-[#F2F2EC]"}`}>
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
                                {formatDuration(shift.started_at, shift.completed_at, shift.status)}
                            </span>
                        }
                    </div>
                    {isRunning ? (
                        <div className="mt-1.5">
                            <p className="text-xs text-blue-600/70 font-sans italic animate-pulse">
                                {shift.summary || ((shift.notes?.length ?? 0) > 0 ? "Processing emails..." : "Starting shift...")}
                            </p>
                            {(shift.notes?.length ?? 0) > 0 && (
                                <div className="flex gap-3 mt-1 text-[11px] text-[#0F1016]/40 font-sans">
                                    <span>{shift.notes!.length} thread{shift.notes!.length !== 1 ? "s" : ""} processed</span>
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

            {/* Cases created/updated during this shift */}
            {(createdCases.length > 0 || updatedCases.length > 0) && (isRunning || expanded) && (
                <div className="px-4 pb-3 border-t border-[#0F1016]/5">
                    {createdCases.length > 0 && (
                        <>
                            <button
                                onClick={() => setCasesExpanded(!casesExpanded)}
                                className="flex items-center gap-1.5 mt-3 mb-2 text-[10px] font-sans font-bold uppercase tracking-[0.15em] text-[#0F1016]/50 hover:text-[#0000EE] transition-colors"
                            >
                                {casesExpanded
                                    ? <ChevronDown className="w-3 h-3" />
                                    : <ChevronRight className="w-3 h-3" />
                                }
                                {createdCases.length} case{createdCases.length !== 1 ? "s" : ""} created
                            </button>
                            {casesExpanded && (
                                <div className="space-y-2">
                                    {createdCases.map(c => (
                                        <SituationCard key={c.id} crmCase={c} tier={priorityToTier(c.priority)} />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                    {updatedCases.length > 0 && (
                        <>
                            <button
                                onClick={() => setUpdatedExpanded(!updatedExpanded)}
                                className="flex items-center gap-1.5 mt-3 mb-2 text-[10px] font-sans font-bold uppercase tracking-[0.15em] text-[#0F1016]/50 hover:text-[#0000EE] transition-colors"
                            >
                                {updatedExpanded
                                    ? <ChevronDown className="w-3 h-3" />
                                    : <ChevronRight className="w-3 h-3" />
                                }
                                {updatedCases.length} case{updatedCases.length !== 1 ? "s" : ""} updated
                            </button>
                            {updatedExpanded && (
                                <div className="space-y-2">
                                    {updatedCases.map(c => (
                                        <SituationCard key={c.id} crmCase={c} tier={priorityToTier(c.priority)} />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {!isRunning && expanded && (
                <div className={`px-4 pb-4 ${(createdCases.length > 0 || updatedCases.length > 0) ? "" : "border-t border-[#0F1016]/5"}`}>
                    {shift.summary && (
                        <pre className="mt-3 text-xs text-[#0F1016]/70 font-sans whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto">
                            {shift.summary}
                        </pre>
                    )}
                    {(shift.notes?.length ?? 0) > 0 && (
                        <details className="mt-3">
                            <summary className="text-[10px] font-sans font-bold uppercase tracking-[0.15em] text-[#0F1016]/50 cursor-pointer hover:text-[#0000EE] transition-colors">
                                {shift.notes!.length} journal entr{shift.notes!.length !== 1 ? "ies" : "y"}
                            </summary>
                            <div className="mt-2 space-y-2 max-h-[400px] overflow-y-auto">
                                {shift.notes!.map(note => (
                                    <div key={note.id} className="text-xs font-sans text-[#0F1016]/70 bg-white/50 rounded-lg p-2.5">
                                        <span className="text-[10px] text-[#0F1016]/40">{formatTime(note.created_at)}</span>
                                        <p className="mt-0.5 whitespace-pre-wrap">{note.content}</p>
                                    </div>
                                ))}
                            </div>
                        </details>
                    )}
                </div>
            )}
        </Card>
    );
}

type WorkerStatus = "online" | "busy" | "offline" | "error" | "unresponsive";

function WorkerIndicator({ status, onRestart }: { status: WorkerStatus; onRestart: () => void }) {
    const config: Record<WorkerStatus, { icon: React.ReactNode; label: string; color: string }> = {
        online: { icon: <Wifi className="w-3 h-3" />, label: "Worker Online", color: "text-emerald-500" },
        busy: { icon: <Clock className="w-3 h-3 animate-pulse" />, label: "Worker Busy", color: "text-blue-500" },
        offline: { icon: <WifiOff className="w-3 h-3" />, label: "Worker Offline", color: "text-red-500" },
        unresponsive: { icon: <AlertTriangle className="w-3 h-3" />, label: "Worker Unresponsive", color: "text-amber-500" },
        error: { icon: <AlertTriangle className="w-3 h-3" />, label: "Worker Error", color: "text-amber-500" },
    };
    const c = config[status];
    return (
        <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-sans font-bold uppercase tracking-wider ${c.color}`}>
                {c.icon} {c.label}
            </span>
            {(status === "offline" || status === "error" || status === "unresponsive") && (
                <button
                    onClick={onRestart}
                    className="inline-flex items-center gap-1 text-[11px] font-sans font-bold text-[#0000EE] hover:text-[#0000CC] uppercase tracking-wider"
                >
                    <RefreshCw className="w-3 h-3" /> Restart
                </button>
            )}
        </div>
    );
}

export default function ShiftsPage() {
    const [shifts, setShifts] = useState<CrmShift[]>([]);
    const [backlogThreads, setBacklogThreads] = useState<CrmThread[]>([]);
    const [backlogTotal, setBacklogTotal] = useState(0);
    const [activeShiftId, setActiveShiftId] = useState<number | null>(null);
    const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

    const [loaded, setLoaded] = useState(false);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [workerStatus, setWorkerStatus] = useState<WorkerStatus>("online");
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const healthRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const loadData = useCallback(async () => {
        const [shiftsData, backlog] = await Promise.all([
            getShifts().catch(() => []),
            getUnreadThreads().catch(() => ({ threads: [], total: 0 })),
        ]);
        setShifts(shiftsData);
        setBacklogThreads(backlog.threads);
        setBacklogTotal(backlog.total);

        // Sync active shift state with CRM
        const running = shiftsData.find((s: CrmShift) => s.status === "in_progress");
        setActiveShiftId(running ? running.id : null);
        // Clear stale taskId if no shift is running
        if (!running) setActiveTaskId(null);
        setLoaded(true);
    }, []);

    // Check worker health — cross-references agent status with CRM shift state
    const checkWorkerHealth = useCallback(async () => {
        try {
            const resp = await fetch(`${AGENT_URL}/session/status`, { signal: AbortSignal.timeout(5000) });
            if (!resp.ok) {
                setWorkerStatus("error");
                return;
            }
            const data = await resp.json() as { busy: boolean; taskId: string | null };
            if (data.busy) {
                setWorkerStatus("busy");
                if (data.taskId) setActiveTaskId(data.taskId);
                return;
            }
            // Agent says idle — check for stuck CRM shifts
            const hasStuckShift = shifts.some(s => s.status === "in_progress");
            if (hasStuckShift) {
                setWorkerStatus("unresponsive");
            } else {
                setWorkerStatus("online");
            }
        } catch {
            setWorkerStatus("offline");
        }
    }, [shifts]);

    useEffect(() => {
        loadData();
        checkWorkerHealth();
        healthRef.current = setInterval(checkWorkerHealth, 10000);
        return () => { if (healthRef.current) clearInterval(healthRef.current); };
    }, [loadData, checkWorkerHealth]);

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
            // Check task status — worker may finish without updating CRM shift record
            if (activeTaskId) {
                try {
                    const taskResp = await fetch(`${AGENT_URL}/v1/status/${activeTaskId}`);
                    const task = await taskResp.json() as { status: string; result?: string };
                    if (task.status === "failed") {
                        setError(`Shift failed: ${task.result || "unknown error"}`);
                        setActiveShiftId(null);
                        setActiveTaskId(null);
                        await loadData();
                        await checkWorkerHealth();
                        return;
                    }
                    if (task.status === "completed") {
                        setActiveShiftId(null);
                        setActiveTaskId(null);
                        await loadData();
                        await checkWorkerHealth();
                        return;
                    }
                } catch { /* task status unavailable, continue to CRM poll */ }
            }
            try {
                const shift = await getShift(activeShiftId, "notes");
                if (shift.status !== "in_progress") {
                    setActiveShiftId(null);
                    setActiveTaskId(null);
                    await loadData();
                    await checkWorkerHealth();
                } else {
                    setShifts(prev => prev.map(s => s.id === activeShiftId ? shift : s));
                }
            } catch {
                // CRM polling error — don't clear shift state, just skip this tick
            }
        }, 3000);

        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };
    }, [activeShiftId, activeTaskId, loadData, checkWorkerHealth]);

    const restartWorker = async () => {
        setError(null);
        try {
            const resp = await fetch(`${AGENT_URL}/session/restart`, { method: "POST" });
            if (resp.ok) {
                setWorkerStatus("online");
                await loadData();
            }
        } catch {
            setError("Failed to restart worker");
        }
    };

    const startShift = async () => {
        setStarting(true);
        setError(null);
        try {
            const resp = await fetch(`${AGENT_URL}/v1/wake/worker`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: "/shift" }),
            });
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
            const data = await resp.json() as { taskId: string; shiftId?: number };
            // The wake endpoint creates the shift record and returns both taskId and shiftId.
            let shiftId: number | null = data.shiftId ?? null;
            if (!shiftId) {
                // Fallback: poll CRM for shift record with task failure detection
                for (let i = 0; i < 15; i++) {
                    await new Promise(r => setTimeout(r, 2000));
                    try {
                        const taskResp = await fetch(`${AGENT_URL}/v1/status/${data.taskId}`);
                        const task = await taskResp.json() as { status: string; result?: string };
                        if (task.status === "failed") {
                            setError(`Shift failed: ${task.result || "unknown error"}`);
                            setStarting(false);
                            return;
                        }
                    } catch { /* task status unavailable, continue */ }
                    try {
                        const shifts = await getShifts({ status: "in_progress", limit: "1" });
                        if (shifts.length > 0) { shiftId = shifts[0].id; break; }
                    } catch { /* CRM unavailable, retry */ }
                }
            }
            if (!shiftId) {
                setError("Shift failed to start — no shift record was created. Check clawling logs.");
                setStarting(false);
                return;
            }
            setActiveShiftId(shiftId);
            setActiveTaskId(data.taskId);
            setWorkerStatus("busy");
            await loadData();
        } catch (e) {
            setError(`Failed to start shift: ${e}`);
        } finally {
            setStarting(false);
        }
    };

    const isRunning = activeShiftId !== null;
    const activeShift = shifts.find(s => s.id === activeShiftId);
    const activeThreadId = activeShift?.current_thread_id ?? null;

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
                        <div className="flex items-center gap-3 mt-1">
                            <p className="text-sm text-[#0F1016]/50 font-sans">
                                Batch email triage by the AI agent
                            </p>
                            <WorkerIndicator status={workerStatus} onRestart={restartWorker} />
                        </div>
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

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_60ch] gap-8">
                    {/* Shift history */}
                    <div>
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
                                    <p className="text-sm text-[#0F1016]/50 font-sans italic">
                                        {loaded ? "No shifts yet. Start a shift to run your first AI triage session." : "Loading..."}
                                    </p>
                                </Card>
                            )}
                        </div>
                    </div>

                    {/* Backlog */}
                    <div className="min-w-0">
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
                                <div className="space-y-1 max-h-[70vh] overflow-y-auto overflow-x-hidden">
                                    {backlogThreads.map(thread => {
                                        const isActive = activeThreadId === thread.id;
                                        return (
                                            <div key={thread.id} className={`flex items-start gap-2 text-xs font-sans rounded-lg px-2 py-1.5 -mx-2 transition-colors ${isActive ? "bg-blue-100 border border-blue-300" : ""}`}>
                                                {isActive
                                                    ? <Clock className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0 animate-pulse" />
                                                    : <span className="text-[#0F1016]/30 mt-0.5 flex-shrink-0">&bull;</span>
                                                }
                                                <div className="min-w-0 flex-1">
                                                    <div className={`break-words ${isActive ? "text-blue-700 font-bold" : "text-[#0F1016]/80"}`}>{thread.subject}</div>
                                                    <div className={`flex items-center gap-1.5 ${isActive ? "text-blue-500/60" : "text-[#0F1016]/40"}`}>
                                                        <span>{thread.contact ? contactName(thread.contact) : "Unknown"}</span>
                                                        <span>&middot;</span>
                                                        <span>{thread.email_count} email{thread.email_count !== 1 ? "s" : ""}</span>
                                                        <span>&middot;</span>
                                                        <span>{formatTime(thread.last_activity_at)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
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
