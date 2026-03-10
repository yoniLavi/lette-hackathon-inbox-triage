"use client"

import Link from "next/link";
import { Filter, ChevronDown } from "lucide-react";

const StatCard = ({ label, value, color }: { label: string, value: string, color?: string }) => (
    <div className="bg-[#F2F2EC] rounded-[20px] p-4 flex flex-col items-center text-center">
        <span className={`text-[48px] font-serif font-medium leading-none mb-2 ${color || "text-[#0F1016]"}`}>
            {value}
        </span>
        <span className="text-[10px] font-sans font-bold text-[#0F1016]/60 uppercase tracking-[0.15em]">
            {label}
        </span>
    </div>
);

export function QuickStats({ taskCount, draftCount, closedCount }: { taskCount: number; draftCount: number; closedCount: number }) {
    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3">
                <StatCard label="Pending Tasks" value={String(taskCount).padStart(2, "0")} color="text-[#0000EE]" />
                <StatCard label="Drafts to Review" value={String(draftCount).padStart(2, "0")} color="text-violet-600" />
                <StatCard label="Resolved" value={String(closedCount).padStart(2, "0")} />
            </div>

            <div className="bg-[#F2F2EC] rounded-[20px] p-4">
                <h3 className="text-[10px] font-sans font-bold text-[#0F1016]/40 uppercase tracking-[0.2em] mb-3 flex items-center">
                    <Filter className="w-3 h-3 mr-2" /> Filters
                </h3>
                <div className="space-y-2">
                    {['All Properties', 'All Types'].map((filter) => (
                        <button key={filter} className="w-full flex justify-between items-center text-left text-[12px] font-sans font-medium text-[#0F1016] border-b border-black/5 pb-2 hover:border-black/20 transition-all">
                            {filter} <ChevronDown className="w-3 h-3 text-[#0F1016]/40" />
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-[#F2F2EC] rounded-[20px] p-4">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-[10px] font-sans font-bold text-[#0F1016]/40 uppercase tracking-[0.2em]">Properties</h3>
                    <Link href="/properties" className="text-[10px] font-sans font-bold text-[#0000EE] uppercase tracking-wider hover:underline">View All</Link>
                </div>
            </div>
        </div>
    );
}
