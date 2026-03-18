"use client"

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getCases, getCounts, getDraftCount, getUnreadThreads } from "@/lib/crm";
import type { CrmCase } from "@/lib/crm";
import { caseActionStatus } from "@/lib/crm";
import { usePageData, buildDashboardContext } from "@/lib/page-context";
import { SituationCard } from "@/components/dashboard/SituationCard";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { motion } from "framer-motion";

// Map CRM priority to urgency tier
function priorityToTier(priority: string): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
    switch (priority) {
        case "critical": return "CRITICAL";
        case "high": return "HIGH";
        case "medium": return "MEDIUM";
        case "low": return "LOW";
        default: return "MEDIUM";
    }
}

export default function Dashboard() {
    const dashboardRef = useRef<HTMLDivElement>(null);
    const scrollTriggered = useRef(false);
    const [cases, setCases] = useState<CrmCase[]>([]);
    const [stats, setStats] = useState({ tasks: 0, drafts: 0, closed: 0 });
    const [unreadCount, setUnreadCount] = useState(0);
    const { setData } = usePageData();

    useEffect(() => {
        Promise.all([
            getCases("emails,tasks,property").catch(() => []),
            getCounts().catch(() => ({ emails: 0, open_tasks: 0, closed_cases: 0 })),
            getDraftCount().catch(() => 0),
            getUnreadThreads().catch(() => ({ threads: [], total: 0 })),
        ]).then(([c, counts, draftCount, unread]) => {
            setCases(c);
            setUnreadCount(unread.total);
            const s = { tasks: counts.open_tasks, drafts: draftCount, closed: counts.closed_cases };
            setStats(s);
            setData(buildDashboardContext(c, s));
        });
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            if (!scrollTriggered.current && window.scrollY > 20 && window.scrollY < 300) {
                scrollTriggered.current = true;
                dashboardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            } else if (window.scrollY === 0) {
                scrollTriggered.current = false;
            }
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Filter out internal shift journal cases
    const visibleCases = cases.filter(c => !c.name.startsWith("Agent Shift"));

    // Unified work queue: non-closed, non-done cases sorted by action type then priority
    const actionOrder = { triage: 0, draft: 1, pending: 2, done: 3 };
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const workQueue = visibleCases
        .filter(c => c.status !== "closed")
        .filter(c => caseActionStatus(c).style !== "done")
        .sort((a, b) => {
            const actionDiff = actionOrder[caseActionStatus(a).style] - actionOrder[caseActionStatus(b).style];
            if (actionDiff !== 0) return actionDiff;
            return (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2) - (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2);
        });

    const openCaseCount = cases.filter(c => c.status !== "closed").length;

    return (
        <div className="min-h-screen flex flex-col relative z-0 bg-[#F7F7F2]">
            <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#FF8A00] opacity-[0.03] blur-[120px] rounded-full" />
                <div className="absolute bottom-[20%] left-[-10%] w-[40%] h-[40%] bg-[#0000EE] opacity-[0.02] blur-[120px] rounded-full" />
            </div>

            <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 md:px-8 pb-16">
                <header className="min-h-[50vh] flex flex-col items-center justify-center text-center py-12">
                    <h2 className="text-[10vw] md:text-[64px] leading-[0.95] font-serif font-medium text-[#0F1016] tracking-tight mb-6 max-w-3xl">
                        Morning, Maria. <br /><span className="text-[#0F1016]/30">Your day at a glance.</span>
                    </h2>
                    <p className="font-sans text-[18px] text-[#0F1016]/60 max-w-xl leading-relaxed">
                        {cases.length > 0
                            ? `${openCaseCount} open situation${openCaseCount !== 1 ? "s" : ""}, ${stats.tasks} action${stats.tasks !== 1 ? "s" : ""} pending${stats.drafts > 0 ? `, ${stats.drafts} draft${stats.drafts !== 1 ? "s" : ""} to review` : ""}.`
                            : "Loading your dashboard..."}
                    </p>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1, duration: 1 }}
                        className="mt-16 flex flex-col items-center gap-2 text-slate-400"
                    >
                        <span className="text-[10px] uppercase tracking-[0.3em] font-bold">Scroll to focus</span>
                        <div className="w-px h-12 bg-gradient-to-b from-slate-300 to-transparent" />
                    </motion.div>
                </header>

                {unreadCount > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-4"
                    >
                        <Link href="/shifts" className="block bg-[#0000EE]/5 hover:bg-[#0000EE]/10 border border-[#0000EE]/15 rounded-[16px] px-6 py-4 transition-colors group">
                            <div className="flex items-center justify-between">
                                <p className="font-sans text-[14px] text-[#0F1016]/70">
                                    <span className="font-bold text-[#0000EE]">{unreadCount}</span> unprocessed email thread{unreadCount !== 1 ? "s" : ""} awaiting triage
                                </p>
                                <span className="text-[12px] font-sans font-bold uppercase tracking-[0.15em] text-[#0000EE]/60 group-hover:text-[#0000EE] transition-colors">
                                    Manage Shifts →
                                </span>
                            </div>
                        </Link>
                    </motion.div>
                )}

                <div ref={dashboardRef} className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-4">
                    <div className="lg:col-span-8">
                        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                            <h3 className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">
                                Work Queue
                                <span className="ml-4 h-px flex-1 bg-slate-200"></span>
                                <span className="ml-4 text-[#0000EE]">{workQueue.length}</span>
                            </h3>
                            <div className="space-y-3">
                                {workQueue.map(c => (
                                    <SituationCard key={c.id} crmCase={c} tier={priorityToTier(c.priority)} />
                                ))}
                                {workQueue.length === 0 && cases.length > 0 && (
                                    <div className="bg-[#F2F2EC] rounded-[20px] p-6 text-center">
                                        <p className="text-sm text-[#0F1016]/60 font-sans">All caught up! No cases need your attention right now.</p>
                                    </div>
                                )}
                                {cases.length === 0 && <p className="text-sm text-slate-400 italic">Loading...</p>}
                            </div>
                        </motion.section>
                    </div>

                    <div className="lg:col-span-4">
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
                            <h3 className="flex items-center text-[12px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">
                                Quick Insights
                                <span className="ml-4 h-px flex-1 bg-slate-200"></span>
                            </h3>
                            <QuickStats taskCount={stats.tasks} draftCount={stats.drafts} closedCount={stats.closed} />
                        </motion.div>
                    </div>
                </div>
            </main>
        </div>
    );
}
