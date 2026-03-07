"use client"

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Filter, ChevronDown, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { UrgencyBadge } from "@/components/ui/Badge";

export default function SearchPage() {
    const [query, setQuery] = useState("Maria Santos");

    return (
        <div className="min-h-screen flex flex-col relative z-0">
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
                <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center text-slate-500 hover:text-[#0000EE] transition-colors bg-slate-100 hover:bg-[#0000EE]/5 px-3 py-1.5 rounded-lg text-[14px] font-sans font-bold border border-slate-200">
                        <ArrowLeft className="w-4 h-4 mr-1.5" /> Dashboard
                    </Link>
                    <div className="font-semibold text-slate-800 tracking-tight">GLOBAL SEARCH</div>
                    <div></div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-[1000px] mx-auto p-4 sm:p-6 lg:p-8">

                {/* Search Bar section */}
                <div className="mb-8">
                    <div className="relative group max-w-2xl mx-auto shadow-sm">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0000EE]" />
                        <input
                            type="text"
                            placeholder="Search properties, tenants, contractors..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            autoFocus
                            className="w-full pl-12 pr-4 py-4 rounded-lg border border-[#0F1016]/10 bg-white focus:ring-4 focus:ring-[#0000EE]/10 focus:border-[#0000EE]/50 transition-all font-sans text-lg font-bold text-[#0F1016] outline-none shadow-sm"
                        />
                        <button className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-100 hover:bg-slate-200 p-2 rounded-lg text-slate-500 transition-colors">
                            <Filter className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Results Header */}
                <div className="flex justify-between items-end mb-6">
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                        Results <span className="text-slate-400 font-medium text-lg ml-1">(3)</span>
                    </h2>
                    <div className="flex gap-2">
                        <button className="flex items-center gap-2 text-sm bg-white border border-slate-200 px-3 py-1.5 rounded-lg font-medium shadow-sm hover:bg-slate-50 transition-colors">
                            Any Status <ChevronDown className="w-4 h-4" />
                        </button>
                        <button className="flex items-center gap-2 text-sm bg-white border border-slate-200 px-3 py-1.5 rounded-lg font-medium shadow-sm hover:bg-slate-50 transition-colors">
                            Any Property <ChevronDown className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Results List */}
                <div className="space-y-4">

                    {/* Active Result */}
                    <Link href="/">

                        <Card className="p-4 hover:shadow-md transition-shadow group cursor-pointer border-l-4 border-l-red-500 hover:border-r-slate-300">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xl">🚨</span>
                                        <h3 className="font-sans text-lg font-bold text-[#0F1016] group-hover:text-[#0000EE] transition-colors">Water Leak - Unit 4B</h3>
                                        <span className="text-sm text-slate-500">at Citynorth Quarter</span>
                                    </div>
                                    <div className="flex gap-4 text-sm text-slate-600 font-medium mt-2">
                                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">Tenant: Maria Santos</span>
                                        <span className="text-slate-400">Opened 2h ago</span>
                                    </div>
                                </div>
                                <UrgencyBadge tier="CRITICAL">CRITICAL</UrgencyBadge>
                            </div>
                        </Card>
                    </Link>

                    {/* Past Result 1 */}
                    <Card className="p-4 hover:shadow-md transition-shadow group cursor-pointer border-l-4 border-l-emerald-500 opacity-80 hover:opacity-100">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-emerald-500"><CheckCircle2 className="w-5 h-5" /></span>
                                    <h3 className="font-sans text-lg font-bold text-slate-700 group-hover:text-[#0000EE] transition-colors line-through decoration-slate-300">Heating Issue - Unit 4B</h3>
                                    <span className="text-sm text-slate-500">at Citynorth Quarter</span>
                                </div>
                                <div className="flex gap-4 text-sm text-slate-600 font-medium mt-2">
                                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">Tenant: Maria Santos</span>
                                    <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Closed Dec 2025</span>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Past Result 2 */}
                    <Card className="p-4 hover:shadow-md transition-shadow group cursor-pointer border-l-4 border-l-emerald-500 opacity-80 hover:opacity-100">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-emerald-500"><CheckCircle2 className="w-5 h-5" /></span>
                                    <h3 className="font-sans text-lg font-bold text-slate-700 group-hover:text-[#0000EE] transition-colors line-through decoration-slate-300">Lease Renewal - Unit 4B</h3>
                                    <span className="text-sm text-slate-500">at Citynorth Quarter</span>
                                </div>
                                <div className="flex gap-4 text-sm text-slate-600 font-medium mt-2">
                                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">Tenant: Maria Santos</span>
                                    <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Closed Aug 2025</span>
                                </div>
                            </div>
                        </div>
                    </Card>

                </div>
            </main>
        </div>
    );
}
