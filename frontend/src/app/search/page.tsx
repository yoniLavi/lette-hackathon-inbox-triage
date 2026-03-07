"use client"

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Filter, ChevronDown, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { UrgencyBadge } from "@/components/ui/Badge";
import { mockSituations } from "@/lib/data";

export default function SearchPage() {
    const [query, setQuery] = useState("Maria Santos");

    return (
        <div className="min-h-screen flex flex-col relative z-0 bg-[#F7F7F2]">
            <header className="sticky top-0 z-50 bg-[#F7F7F2]/80 backdrop-blur-md border-b border-[#0F1016]/5 pt-4 pb-2">
                <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
                    <Link href="/" className="flex items-center text-[#0F1016]/60 hover:text-primary transition-all bg-[#F2F2EC] hover:bg-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border border-[#0F1016]/5 shadow-sm">
                        <ArrowLeft className="w-3 h-3 mr-2" /> Dashboard
                    </Link>
                    <Logo />
                    <div className="w-[100px]"></div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-[1000px] mx-auto p-4 sm:p-6 lg:p-8">

                {/* Search Bar section */}
                <div className="mb-8">
                    <div className="relative group max-w-2xl mx-auto shadow-lg rounded-[24px] overflow-hidden bg-white">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary" />
                        <input
                            type="text"
                            placeholder="Search properties, tenants, contractors..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            autoFocus
                            className="w-full pl-14 pr-12 py-5 border-transparent focus:ring-0 outline-none font-serif text-xl text-[#0F1016] placeholder:text-[#0F1016]/20 bg-transparent"
                        />
                        <button className="absolute right-3 top-1/2 -translate-y-1/2 bg-primary text-white p-2.5 rounded-full hover:bg-primary/90 transition-all shadow-md relative overflow-hidden">
                            <div className="absolute inset-0 bg-striped opacity-20" />
                            <Filter className="w-5 h-5 relative" />
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
                    <Link href={`/situations/${mockSituations[0].id}`}>
                        <Card className="p-0 hover:shadow-md transition-shadow group cursor-pointer border-transparent hover:border-r-slate-300 relative overflow-hidden flex">
                            <div className="w-1.5 self-stretch bg-red-500 relative overflow-hidden shrink-0">
                                <div className="absolute inset-0 bg-striped opacity-20" />
                            </div>
                            <div className="p-4 flex-1">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xl">🚨</span>
                                            <h3 className="font-serif text-xl font-medium text-[#0F1016] group-hover:text-primary transition-colors">Water Leak - Unit 4B</h3>
                                            <span className="text-sm text-[#0F1016]/40">at Citynorth Quarter</span>
                                        </div>
                                        <div className="flex gap-4 text-sm text-slate-500 font-medium mt-2">
                                            <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 opacity-40" /> Maria Santos</span>
                                            <span className="opacity-60 italic">Opened 2h ago</span>
                                        </div>
                                    </div>
                                    <UrgencyBadge tier="CRITICAL">CRITICAL</UrgencyBadge>
                                </div>
                            </div>
                        </Card>
                    </Link>

                    {/* Past Result 1 */}
                    <Card className="p-0 hover:shadow-md transition-shadow group cursor-pointer border-transparent opacity-80 hover:opacity-100 relative overflow-hidden flex">
                        <div className="w-1.5 self-stretch bg-emerald-500 relative overflow-hidden shrink-0">
                            <div className="absolute inset-0 bg-striped opacity-20" />
                        </div>
                        <div className="p-4 flex-1">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-emerald-500"><CheckCircle2 className="w-5 h-5" /></span>
                                        <h3 className="font-serif text-lg font-medium text-slate-700 group-hover:text-primary transition-colors line-through decoration-slate-300">Heating Issue - Unit 4B</h3>
                                        <span className="text-sm text-slate-500">at Citynorth Quarter</span>
                                    </div>
                                    <div className="flex gap-4 text-sm text-slate-500 font-medium mt-2">
                                        <span className="flex items-center gap-1.5 font-medium"><User className="w-3.5 h-3.5 opacity-40" /> Maria Santos</span>
                                        <span className="text-emerald-600 font-bold uppercase text-[10px] tracking-wider">Closed Dec 2025</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Past Result 2 */}
                    <Card className="p-0 hover:shadow-md transition-shadow group cursor-pointer border-transparent opacity-80 hover:opacity-100 relative overflow-hidden flex">
                        <div className="w-1.5 self-stretch bg-emerald-500 relative overflow-hidden shrink-0">
                            <div className="absolute inset-0 bg-striped opacity-20" />
                        </div>
                        <div className="p-4 flex-1">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-emerald-500"><CheckCircle2 className="w-5 h-5" /></span>
                                        <h3 className="font-serif text-lg font-medium text-slate-700 group-hover:text-primary transition-colors line-through decoration-slate-300">Lease Renewal - Unit 4B</h3>
                                        <span className="text-sm text-slate-500">at Citynorth Quarter</span>
                                    </div>
                                    <div className="flex gap-4 text-sm text-slate-600 font-medium mt-2">
                                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">Tenant: Maria Santos</span>
                                        <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Closed Aug 2025</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                </div>
            </main>
        </div>
    );
}
