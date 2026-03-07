"use client"

import React from "react";
import { formatDistanceToNow } from "date-fns";
import { Activity } from "@/lib/data";
import { Mail, CheckCircle, Bot, AlertCircle } from "lucide-react";

export function ActivityCard({ activity }: { activity: Activity }) {
    const getIcon = () => {
        switch (activity.type) {
            case "email": return <Mail className="w-4 h-4 text-slate-500" />;
            case "system": return activity.status === "success" ? <CheckCircle className="w-4 h-4 text-[#0000EE]" /> : <AlertCircle className="w-4 h-4 text-rose-500" />;
            case "agent": return <Bot className="w-4 h-4 text-[#0000EE]" />;
        }
    };

    return (
        <div className="flex items-start gap-4 p-4 rounded-lg border border-[#0F1016]/10 bg-white hover:border-[#0F1016]/20 transition-colors cursor-default shadow-sm group">
            <div className="mt-1 p-2 rounded-lg bg-[#EDEDE9] border border-[#0F1016]/5 group-hover:bg-[#E5E5E0] transition-colors">
                {getIcon()}
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-sans font-bold text-[#0F1016] text-[14px] truncate">{activity.title}</p>
                <p className="font-serif text-[14px] text-slate-600 truncate mt-1">{activity.description}</p>
                <p className="text-[11px] text-slate-400 font-medium mt-1 uppercase tracking-wider">
                    {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                </p>
            </div>
        </div>
    );
}
