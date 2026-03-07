"use client"

import React from "react";
import { formatDistanceToNow } from "date-fns";
import { Situation } from "@/lib/data";
import { Button } from "@/components/ui/Button";
import { Sparkles, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

export function SituationCard({ situation }: { situation: Situation }) {
    const urgencyStyles = {
        CRITICAL: { dot: "bg-red-500" },
        HIGH: { dot: "bg-amber-500" },
        MEDIUM: { dot: "bg-[#0000EE]" },
        LOW: { dot: "bg-[#0F1016]/20" }
    };

    return (
        <motion.div
            layout
            className="group block"
        >
            <Link href={`/situations/${situation.id}`}>
                <div className="bg-[#F2F2EC] rounded-[20px] p-4 transition-all hover:translate-x-1 border border-transparent hover:border-black/5">
                    <div className="flex gap-3">
                        {/* Status Indicator Dot */}
                        <div className="pt-1.5">
                            <div className={`w-2 h-2 rounded-full ${urgencyStyles[situation.tier].dot}`} />
                        </div>

                        <div className="flex-1 space-y-2.5">
                            {/* Header Info */}
                            <div className="flex justify-between items-start">
                                <div className="space-y-0.5">
                                    <h3 className="text-[18px] font-serif font-medium text-[#0F1016] leading-tight group-hover:text-[#0000EE] transition-colors">
                                        {situation.title}
                                    </h3>
                                    <div className="flex items-center gap-2 text-[10px] font-sans font-bold text-[#0F1016]/40 uppercase tracking-[0.15em]">
                                        <span>{situation.property}</span>
                                        <span className="w-0.5 h-0.5 rounded-full bg-[#0F1016]/20" />
                                        <span suppressHydrationWarning>{formatDistanceToNow(new Date(situation.updatedAt), { addSuffix: true })}</span>
                                    </div>
                                </div>
                            </div>

                            {/* AI Summary Box - Tightened */}
                            <div className="bg-white/50 border border-white/40 p-3 rounded-[14px]">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Sparkles className="w-3 h-3 text-[#0000EE]" />
                                    <span className="text-[9px] font-sans font-bold text-[#0000EE] uppercase tracking-widest">Lette Summary</span>
                                </div>
                                <p className="text-[13px] font-serif text-[#0F1016] leading-snug">
                                    {situation.aiSummary}
                                </p>
                            </div>

                            {/* Footer - Tightened */}
                            <div className="flex items-center justify-between pt-0.5">
                                <div className="flex items-center gap-2">
                                    <div className="flex -space-x-1">
                                        {[1, 2].map((i) => (
                                            <div key={i} className="w-5 h-5 rounded-full border border-[#F2F2EC] bg-slate-200" />
                                        ))}
                                    </div>
                                    <span className="text-[10px] font-sans font-medium text-[#0F1016]/40">2 agents</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    className="h-7 px-3 text-[10px] font-bold uppercase tracking-widest hover:bg-[#0F1016] hover:text-white transition-all rounded-full"
                                >
                                    Focus
                                    <ChevronRight className="w-3 h-3 ml-1" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}
