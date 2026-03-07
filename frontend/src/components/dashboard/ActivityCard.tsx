"use client"

import React, { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Activity } from "@/lib/data";
import { MessageSquare, User, ShieldCheck, ChevronDown } from "lucide-react";

export function ActivityCard({ activity, body }: { activity: Activity; body?: string }) {
    const [expanded, setExpanded] = useState(false);
    const hasBody = !!body?.trim();

    const getIcon = () => {
        switch (activity.type) {
            case "email": return <MessageSquare className="w-3.5 h-3.5 text-primary" />;
            case "agent": return <User className="w-3.5 h-3.5 text-emerald-500" />;
            case "system": return <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />;
            default: return <MessageSquare className="w-3.5 h-3.5 text-[#0F1016]/40" />;
        }
    };

    return (
        <div
            className={`bg-[#F2F2EC] rounded-[18px] p-4 transition-all border border-transparent hover:border-black/5 ${hasBody ? "cursor-pointer hover:translate-x-1" : "hover:translate-x-1"}`}
            onClick={() => hasBody && setExpanded(!expanded)}
        >
            <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm border border-black/5">
                    {getIcon()}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                        <h4 className="text-[14px] font-serif font-medium text-[#0F1016] leading-tight truncate">
                            {activity.description}
                        </h4>
                        <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[9px] font-sans font-bold text-[#0F1016]/40 uppercase tracking-widest whitespace-nowrap pt-0.5" suppressHydrationWarning>
                                {formatDistanceToNow(new Date(activity.timestamp))} ago
                            </span>
                            {hasBody && (
                                <ChevronDown className={`w-3 h-3 text-[#0F1016]/30 transition-transform ${expanded ? "rotate-180" : ""}`} />
                            )}
                        </div>
                    </div>
                    <p className="text-[11px] font-sans text-[#0F1016]/60 font-bold uppercase tracking-tight mt-0.5">
                        {activity.title}
                    </p>
                </div>
            </div>
            {expanded && body && (
                <div className="mt-3 ml-11 text-sm text-[#0F1016]/80 font-sans leading-relaxed bg-white/60 border border-[#0F1016]/5 rounded-lg p-3 whitespace-pre-line">
                    {body.replace(/<[^>]*>/g, '')}
                </div>
            )}
        </div>
    );
}
