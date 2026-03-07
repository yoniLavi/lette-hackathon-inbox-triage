"use client"

import React from "react";
import Link from "next/link";
import { Filter, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";

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

export function QuickStats() {
    return (
        <div className="flex flex-col gap-4">
            {/* Overview - High Density Stat Cards */}
            <div className="grid grid-cols-1 gap-3">
                <StatCard
                    label="Emails Today"
                    value="42"
                />
                <StatCard
                    label="Action Needed"
                    value="08"
                    color="text-primary"
                />
                <StatCard
                    label="Resolved"
                    value="12"
                />
            </div>

            {/* Filters - High Density */}
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
                    <label className="flex items-center gap-2 text-[12px] font-sans font-medium text-[#0F1016] pt-1 cursor-pointer">
                        <input type="checkbox" className="rounded-full border-slate-300 text-[#0F1016] focus:ring-[#0F1016] w-3.5 h-3.5" />
                        Unassigned
                    </label>
                </div>
            </div>

            {/* Properties List - High Density */}
            <div className="bg-[#F2F2EC] rounded-[20px] p-4">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-[10px] font-sans font-bold text-[#0F1016]/40 uppercase tracking-[0.2em]">Properties</h3>
                    <Link href="/properties" className="text-[10px] font-sans font-bold text-primary uppercase tracking-wider hover:underline">View All</Link>
                </div>
                <ul className="space-y-2">
                    {[
                        { name: "Citynorth", crit: 2 },
                        { name: "Reds Works", crit: 0 },
                        { name: "Graylings", crit: 1 },
                    ].map((prop) => (
                        <li key={prop.name}>
                            <Link href="/properties" className="flex justify-between items-center text-[12px] font-sans font-medium text-[#0F1016] border-b border-black/5 pb-2 hover:border-black/20 transition-all group">
                                <span className="truncate group-hover:translate-x-1 transition-transform">{prop.name}</span>
                                {prop.crit > 0 && (
                                    <span className="bg-primary text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold relative overflow-hidden flex items-center justify-center">
                                        <div className="absolute inset-0 bg-striped opacity-20" />
                                        <span className="relative z-10">{prop.crit}</span>
                                    </span>
                                )}
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>

        </div>
    );
}
