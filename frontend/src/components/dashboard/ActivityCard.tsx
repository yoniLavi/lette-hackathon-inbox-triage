"use client"

import React from "react";
import { formatDistanceToNow } from "date-fns";
import { Activity } from "@/lib/data";
import { MessageSquare, User, ShieldCheck } from "lucide-react";

export function ActivityCard({ activity }: { activity: Activity }) {
    const getIcon = () => {
        switch (activity.type) {
            case "email": return <MessageSquare className="w-3.5 h-3.5 text-[#0000EE]" />;
            case "agent": return <User className="w-3.5 h-3.5 text-emerald-500" />;
            case "system": return <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />;
            default: return <MessageSquare className="w-3.5 h-3.5 text-[#0F1016]/40" />;
        }
    };

    return (
        <div className="bg-[#F2F2EC] rounded-[18px] p-4 hover:translate-x-1 transition-all border border-transparent hover:border-black/5">
            <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm border border-black/5">
                    {getIcon()}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                        <h4 className="text-[14px] font-serif font-medium text-[#0F1016] leading-tight truncate">
                            {activity.description}
                        </h4>
                        <span className="text-[9px] font-sans font-bold text-[#0F1016]/40 uppercase tracking-widest whitespace-nowrap pt-0.5" suppressHydrationWarning>
                            {formatDistanceToNow(new Date(activity.timestamp))} ago
                        </span>
                    </div>
                    <p className="text-[11px] font-sans text-[#0F1016]/60 font-bold uppercase tracking-tight mt-0.5">
                        {activity.title}
                    </p>
                </div>
            </div>
        </div>
    );
}
