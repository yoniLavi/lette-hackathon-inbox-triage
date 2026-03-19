"use client"

import { useState, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import ReactMarkdown from "react-markdown";
import type { CrmCase, UrgencyTier } from "@/lib/crm";
import { caseActionStatus } from "@/lib/crm";
import { Button } from "@/components/ui/Button";
import { ChevronRight, ChevronDown, MapPin, FileEdit, AlertCircle, CheckCircle2, ListChecks } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

const actionStyles = {
    draft: { icon: FileEdit, color: "text-violet-600", bg: "bg-violet-50 border-violet-200" },
    pending: { icon: ListChecks, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
    triage: { icon: AlertCircle, color: "text-rose-600", bg: "bg-rose-50 border-rose-200" },
    done: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
};

export function SituationCard({ crmCase, tier }: { crmCase: CrmCase; tier: UrgencyTier }) {
    const [expanded, setExpanded] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    const urgencyStyles = {
        CRITICAL: { dot: "bg-red-500" },
        HIGH: { dot: "bg-amber-500" },
        MEDIUM: { dot: "bg-[#0000EE]" },
        LOW: { dot: "bg-[#0F1016]/20" }
    };

    // Listen for ai-expand events (from AI scrollTo action)
    useEffect(() => {
        const el = cardRef.current;
        if (!el) return;
        const handler = () => setExpanded(true);
        el.addEventListener("ai-expand", handler);
        return () => el.removeEventListener("ai-expand", handler);
    }, []);

    const action = caseActionStatus(crmCase);
    const ActionIcon = actionStyles[action.style].icon;
    const propertyName = crmCase.property?.name;

    const toggleExpand = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setExpanded(!expanded);
    };

    return (
        <motion.div layout className="group block">
            <div ref={cardRef} data-ai-target={`case-${crmCase.id}`} className="bg-[#F2F2EC] rounded-[20px] p-4 transition-all border border-transparent hover:border-black/5">
                <div className="flex gap-3">
                    <div className="pt-1.5">
                        <div className={`w-2 h-2 rounded-full ${urgencyStyles[tier].dot}`} />
                    </div>

                    <div className="flex-1 space-y-2">
                        <div className="flex justify-between items-start">
                            <div className="space-y-0.5 flex-1">
                                <h3 className="text-[18px] font-serif font-medium text-[#0F1016] leading-tight group-hover:text-[#0000EE] transition-colors">
                                    <Link href={`/situations/${crmCase.id}`} className="hover:underline">
                                        {crmCase.name}
                                    </Link>
                                </h3>
                                <div className="flex items-center gap-2 text-[10px] font-sans font-bold text-[#0F1016]/40 uppercase tracking-[0.15em]">
                                    {propertyName && (
                                        <>
                                            <span className="flex items-center">
                                                <MapPin className="w-2.5 h-2.5 mr-0.5" />
                                                {propertyName}
                                            </span>
                                            <span className="text-[#0F1016]/20">·</span>
                                        </>
                                    )}
                                    <span suppressHydrationWarning>{formatDistanceToNow(new Date(crmCase.updated_at), { addSuffix: true })}</span>
                                    <span className="text-[#0F1016]/20">·</span>
                                    <span className={`inline-flex items-center gap-1 ${actionStyles[action.style].color}`}>
                                        <ActionIcon className="w-2.5 h-2.5" />
                                        {action.text}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {crmCase.description && (
                            <div
                                className="bg-white/50 border border-white/40 p-3 rounded-[14px] cursor-pointer"
                                onClick={toggleExpand}
                            >
                                <div className={`text-[13px] font-serif text-[#0F1016] leading-snug prose prose-sm max-w-none ${!expanded ? "line-clamp-1 [&>*]:inline" : ""}`}>
                                    <ReactMarkdown>{crmCase.description}</ReactMarkdown>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-0.5">
                            {crmCase.description && (
                                <button onClick={toggleExpand} className="flex items-center gap-1 text-[10px] font-sans font-bold text-[#0F1016]/30 uppercase tracking-widest hover:text-[#0000EE] transition-colors cursor-pointer">
                                    <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "" : "-rotate-90"}`} />
                                    {expanded ? "Less" : "More"}
                                </button>
                            )}
                            <Link href={`/situations/${crmCase.id}`} className="ml-auto">
                                <Button
                                    variant="ghost"
                                    className="h-7 px-3 text-[10px] font-bold uppercase tracking-widest hover:bg-[#0F1016] hover:text-white transition-all rounded-full"
                                >
                                    Focus
                                    <ChevronRight className="w-3 h-3 ml-1" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
