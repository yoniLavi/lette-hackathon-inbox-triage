"use client"

import React, { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Situation } from "@/lib/data";
import { UrgencyBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Clock, MessageSquare, AlertTriangle, ArrowRight, MoreHorizontal, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export function SituationCard({ situation }: { situation: Situation }) {
    const [isHovered, setIsHovered] = useState(false);

    // Type icon mapping
    const getTypeIcon = () => {
        if (situation.type.includes("Emergency")) return "🚨";
        if (situation.type.includes("Compliance")) return "✅";
        if (situation.type.includes("Renewal")) return "📋";
        return "🔧";
    };

    return (
        <motion.div
            layout
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="group relative"
        >
            <Link href={`/situations/${situation.id}`}>
                <Card
                    className={`p-4 cursor-pointer overflow-hidden border-l-4 ${situation.tier === "CRITICAL" ? "border-l-red-500" :
                        situation.tier === "HIGH" ? "border-l-amber-500" :
                            situation.tier === "MEDIUM" ? "border-l-blue-500" : "border-l-slate-400"
                        } hover:border-r-slate-300 block`}
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xl" aria-hidden="true">{getTypeIcon()}</span>
                            <h3 className="font-sans font-bold text-slate-800 line-clamp-1 group-hover:text-[#0000EE] transition-colors">{situation.title}</h3>
                        </div>

                        <UrgencyBadge tier={situation.tier}>
                            {situation.tier}
                        </UrgencyBadge>
                    </div>

                    <div className="text-sm text-slate-500 mb-3 space-y-1">
                        <div className="flex justify-between items-center">
                            <span>{situation.property}{situation.unit ? ` • ${situation.unit}` : ""}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDistanceToNow(situation.updatedAt, { addSuffix: true })}
                            </span>
                            {situation.emailsCount > 0 && (
                                <span className="flex items-center gap-1">
                                    <MessageSquare className="w-3 h-3" />
                                    {situation.emailsCount} emails
                                </span>
                            )}
                            {situation.financialExposure && (
                                <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-1.5 rounded">
                                    💰 €{situation.financialExposure.toLocaleString()}
                                </span>
                            )}
                        </div>
                    </div>

                    <AnimatePresence>
                        {isHovered && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="pt-3 border-t border-slate-200 text-sm text-slate-600 flex flex-col gap-2">
                                    <div className="bg-[#0000EE]/5 p-2 rounded-lg border border-[#0000EE]/10 leading-relaxed font-mono text-[13px]">
                                        <span className="font-semibold text-[#0000EE] font-sans mr-2">AI Summary:</span>
                                        {situation.aiSummary}
                                    </div>
                                    <div className="flex justify-between items-center mt-1">
                                        <div className="flex gap-2" onClick={(e) => e.preventDefault()}>
                                            <Button variant="secondary" size="sm" className="px-2.5 py-1.5 rounded-lg flex items-center">
                                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                                Resolve
                                            </Button>
                                            <Button variant="secondary" size="sm" className="px-2.5 py-1.5 rounded-lg flex items-center">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </Button>
                                        </div>
                                        <Button size="sm" className="px-3 py-1.5 rounded-lg flex items-center">
                                            View Details
                                            <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Card>
            </Link>
        </motion.div>
    );
}
