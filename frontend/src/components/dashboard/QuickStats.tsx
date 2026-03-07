"use client"

import React from "react";
import Link from "next/link";
import { Filter, ChevronDown, CheckSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function QuickStats() {
    return (
        <div className="space-y-6">
            {/* Overview */}
            <div className="bg-white rounded-lg border border-[#0F1016]/10 shadow-sm p-5">
                <h3 className="text-xs font-sans font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">Overview</h3>
                <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-600 font-medium">Emails Today</span>
                        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-full">42</span>
                    </div>
                    <div className="flex justify-between items-center text-[14px]">
                        <span className="text-slate-600 font-sans font-medium">Open Situations</span>
                        <span className="font-bold text-[#0000EE] bg-[#0000EE]/5 border border-[#0000EE]/20 px-2 py-0.5 rounded-full">23</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-amber-700 font-medium flex items-center"><CheckSquare className="w-3.5 h-3.5 mr-1" /> Action Required Today</span>
                        <span className="font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">8</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg border border-[#0F1016]/10 shadow-sm p-5">
                <h3 className="text-xs font-sans font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2 flex items-center">
                    <Filter className="w-3.5 h-3.5 mr-1.5" /> Filters
                </h3>
                <div className="space-y-3">
                    <button className="w-full flex justify-between items-center text-left text-[14px] text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 px-3 py-2 rounded-lg transition-colors">
                        All Properties <ChevronDown className="w-4 h-4 text-slate-400" />
                    </button>
                    <button className="w-full flex justify-between items-center text-left text-[14px] text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 px-3 py-2 rounded-lg transition-colors">
                        All Types <ChevronDown className="w-4 h-4 text-slate-400" />
                    </button>
                    <button className="w-full flex justify-between items-center text-left text-[14px] text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 px-3 py-2 rounded-lg transition-colors">
                        All Urgency <ChevronDown className="w-4 h-4 text-slate-400" />
                    </button>
                    <label className="flex items-center gap-2 text-[14px] text-slate-700 p-1 cursor-pointer hover:bg-slate-50 rounded px-2 transition-colors">
                        <input type="checkbox" className="rounded border-slate-300 text-[#0000EE] focus:ring-[#0000EE] w-4 h-4" />
                        Unassigned only
                    </label>
                </div>
            </div>

            {/* Properties List */}
            <div className="bg-white rounded-lg border border-[#0F1016]/10 shadow-sm p-5">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 className="text-xs font-sans font-bold text-slate-400 uppercase tracking-wider">Properties</h3>
                    <Link href="/properties" className="text-xs text-[#0000EE] hover:text-[#0000CC] font-medium">View All</Link>
                </div>
                <ul className="space-y-3">
                    {[
                        { name: "Citynorth Quarter", crit: 2, high: 5 },
                        { name: "Reds Works", crit: 0, high: 3 },
                        { name: "Graylings", crit: 1, high: 2 },
                        { name: "Ilah Residences", crit: 0, high: 1 },
                        { name: "Thornbury Village", crit: 0, high: 2 },
                    ].map((prop) => (
                        <li key={prop.name}>
                            <Link href="/properties" className="flex justify-between items-center text-[14px] group cursor-pointer p-1 -mx-1 hover:bg-slate-50 rounded">
                                <span className="font-sans font-medium text-slate-700 group-hover:text-[#0000EE] transition-colors">{prop.name}</span>
                                <div className="flex gap-1.5">
                                    <span className={`text-xs px-1.5 rounded bg-slate-100 border ${prop.crit > 0 ? "border-red-200 text-red-700 font-bold" : "border-slate-200 text-slate-400"}`}>
                                        {prop.crit} 🔴
                                    </span>
                                    <span className={`text-xs px-1.5 rounded bg-slate-100 border ${prop.high > 0 ? "border-amber-200 text-amber-700 font-bold" : "border-slate-200 text-slate-400"}`}>
                                        {prop.high} 🟡
                                    </span>
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>

            <Button className="w-full mt-4" size="lg">
                <Plus className="w-5 h-5 mr-2" />
                New Situation
            </Button>
        </div>
    );
}
