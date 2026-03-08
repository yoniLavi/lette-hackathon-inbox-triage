"use client"

import React, { useEffect, useRef, useState } from "react";
import { getCases, getEmails, getEmailCount, getOpenTaskCount, getClosedCaseCount } from "@/lib/espo";
import type { CrmCase, CrmEmail } from "@/lib/espo";
import { SituationCard } from "@/components/dashboard/SituationCard";
import { ActivityCard } from "@/components/dashboard/ActivityCard";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { AIAssistant } from "@/components/dashboard/AIAssistant";
import { Plus, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
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
    const [emails, setEmails] = useState<CrmEmail[]>([]);
    const [stats, setStats] = useState({ emails: 0, tasks: 0, closed: 0 });

    useEffect(() => {
        Promise.all([
            getCases().catch(() => []),
            getEmails(5).catch(() => []),
            getEmailCount().catch(() => 0),
            getOpenTaskCount().catch(() => 0),
            getClosedCaseCount().catch(() => 0),
        ]).then(([c, e, emailCount, taskCount, closedCount]) => {
            setCases(c);
            setEmails(e);
            setStats({ emails: emailCount, tasks: taskCount, closed: closedCount });
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

    const criticalCases = cases.filter(c => priorityToTier(c.priority) === "CRITICAL");
    const highCases = cases.filter(c => priorityToTier(c.priority) === "HIGH");

    return (
        <div className="min-h-screen flex flex-col relative z-0 bg-[#F7F7F2]">
            <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#FF8A00] opacity-[0.03] blur-[120px] rounded-full" />
                <div className="absolute bottom-[20%] left-[-10%] w-[40%] h-[40%] bg-[#0000EE] opacity-[0.02] blur-[120px] rounded-full" />
            </div>

            <nav className="w-full flex justify-center px-4 md:px-12 py-8">
                <div className="max-w-7xl w-full flex items-center justify-between">
                    <Logo />
                    <div className="flex items-center gap-3">
                        <Button className="h-9 px-5 rounded-full bg-[#0F1016] text-white hover:bg-black text-[12px] font-sans font-bold shadow-lg transition-all hidden md:flex">
                            <Plus size={16} className="mr-2" />
                            New Situation
                        </Button>
                        <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#0F1016]/10 hover:bg-[#0F1016]/5 transition-all text-[#0F1016] font-sans font-bold text-[14px]">
                            <User size={18} />
                            Portal
                        </button>
                    </div>
                </div>
            </nav>

            <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 md:px-8 pb-16">
                <header className="min-h-[50vh] flex flex-col items-center justify-center text-center py-12">
                    <div className="inline-flex items-center gap-2 bg-[#0F1016]/5 text-[#0F1016]/60 px-4 py-1.5 rounded-full text-[11px] font-sans font-bold uppercase tracking-[0.2em] mb-8 border border-[#0F1016]/10">
                        Intelligence Operations
                    </div>
                    <h2 className="text-[10vw] md:text-[64px] leading-[0.95] font-serif font-medium text-[#0F1016] tracking-tight mb-6 max-w-3xl">
                        Morning, Maria. <br /><span className="text-[#0F1016]/30">Your day at a glance.</span>
                    </h2>
                    <p className="font-sans text-[18px] text-[#0F1016]/60 max-w-xl leading-relaxed">
                        {cases.length > 0
                            ? `${stats.emails} emails in the system. ${cases.length} open situations, ${stats.tasks} actions pending.`
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

                <div ref={dashboardRef} className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-4">
                    <div className="lg:col-span-5 flex flex-col gap-4">
                        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                            <h3 className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">
                                Critical Queue
                                <span className="ml-4 h-px flex-1 bg-slate-200"></span>
                                <span className="ml-4 text-[#EF4444]">{criticalCases.length}</span>
                            </h3>
                            <div className="space-y-3">
                                {criticalCases.map(c => <SituationCard key={c.id} crmCase={c} tier="CRITICAL" />)}
                                {criticalCases.length === 0 && <p className="text-sm text-slate-400 italic">No critical situations</p>}
                            </div>
                        </motion.section>

                        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                            <h3 className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">
                                High Priority
                                <span className="ml-4 h-px flex-1 bg-slate-200"></span>
                                <span className="ml-4 text-[#F59E0B]">{highCases.length}</span>
                            </h3>
                            <div className="space-y-3">
                                {highCases.map(c => <SituationCard key={c.id} crmCase={c} tier="HIGH" />)}
                                {highCases.length === 0 && <p className="text-sm text-slate-400 italic">No high-priority situations</p>}
                            </div>
                        </motion.section>
                    </div>

                    <div className="lg:col-span-4">
                        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
                            <h3 className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">
                                Recent Emails
                                <span className="ml-4 h-px flex-1 bg-slate-200"></span>
                            </h3>
                            <div className="space-y-3">
                                {emails.map(email => (
                                    <ActivityCard key={email.id} activity={{
                                        id: email.id,
                                        type: "email",
                                        title: `${email.from_address || "Unknown"}`,
                                        description: email.subject,
                                        timestamp: new Date(email.date_sent),
                                    }} body={email.body_plain || email.body} />
                                ))}
                                {emails.length === 0 && <p className="text-sm text-slate-400 italic">No recent emails</p>}
                            </div>
                        </motion.section>
                    </div>

                    <div className="lg:col-span-3">
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
                            <h3 className="flex items-center text-[12px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">
                                Quick Insights
                                <span className="ml-4 h-px flex-1 bg-slate-200"></span>
                            </h3>
                            <QuickStats emailCount={stats.emails} taskCount={stats.tasks} closedCount={stats.closed} />
                        </motion.div>
                    </div>
                </div>
            </main>
            <AIAssistant />
        </div>
    );
}
