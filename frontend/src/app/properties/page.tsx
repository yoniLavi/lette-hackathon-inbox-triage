"use client"

import React from "react";
import Link from "next/link";
import { ArrowLeft, Building2, ChevronDown, MoreHorizontal, Filter } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { SituationCard } from "@/components/dashboard/SituationCard";
import { mockSituations } from "@/lib/data";

export default function PropertiesView() {
    const properties = [
        { name: "Citynorth Quarter", units: 204, address: "South Circular Road, Dublin 8", crit: 2, high: 5, med: 3, low: 0, occupancy: "98% (200/204)", avgResponse: "4.2 hours", maintenance: 7 },
        { name: "Reds Works", units: 312, address: "Main Street, Dublin 2", crit: 0, high: 3, med: 2, low: 1, occupancy: "94% (293/312)", avgResponse: "5.1 hours", maintenance: 4 }
    ];

    return (
        <div className="min-h-screen flex flex-col relative z-0">
            <header className="sticky top-0 z-50 bg-[#F7F7F2]/80 backdrop-blur-md border-b border-[#0F1016]/5">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                    <Link href="/" className="flex items-center text-[#0F1016]/60 hover:text-primary transition-all bg-[#F2F2EC] hover:bg-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest border border-[#0F1016]/5 shadow-sm">
                        <ArrowLeft className="w-3 h-3 mr-2" /> Dashboard
                    </Link>
                    <Logo />
                    <div className="w-[100px]"></div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {properties.map(p => (
                        <Card key={p.name} className="p-6 hover:shadow-lg transition-all relative overflow-hidden group bg-[#F2F2EC] border-transparent rounded-[24px]">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#0F1016]/10 group-hover:bg-primary transition-all relative overflow-hidden">
                                <div className="absolute inset-0 bg-striped opacity-20" />
                            </div>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 flex items-center">
                                        <Building2 className="w-5 h-5 mr-2 text-slate-400" />
                                        {p.name}
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1">{p.units} units • {p.address}</p>
                                </div>
                                <button className="text-slate-400 hover:text-slate-600"><MoreHorizontal className="w-5 h-5" /></button>
                            </div>

                            <div className="flex gap-4 mt-6 border-b border-slate-100 pb-4">
                                <div className="text-center bg-white/50 rounded-[16px] py-3 px-5 border border-white/40">
                                    <span className="block text-2xl font-serif font-medium text-red-600">{p.crit} 🔴</span>
                                    <span className="text-[9px] font-sans font-bold uppercase tracking-widest text-red-600/60">Critical</span>
                                </div>
                                <div className="text-center bg-white/50 rounded-[16px] py-3 px-5 border border-white/40">
                                    <span className="block text-2xl font-serif font-medium text-amber-600">{p.high} 🟡</span>
                                    <span className="text-[9px] font-sans font-bold uppercase tracking-widest text-amber-600/60">High</span>
                                </div>
                                <div className="text-center bg-primary/5 rounded-[16px] py-3 px-5 border border-primary/20 relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-striped opacity-10" />
                                    <span className="block text-2xl font-serif font-medium text-primary relative">{p.med} 🔵</span>
                                    <span className="text-[9px] font-sans font-bold uppercase tracking-widest text-primary/60 relative">Medium</span>
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Occupancy</p>
                                    <p className="font-medium text-slate-800">{p.occupancy}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Avg Response</p>
                                    <p className="font-medium text-slate-800">{p.avgResponse}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Open Maintenance</p>
                                    <p className="font-medium text-slate-800">{p.maintenance}</p>
                                </div>
                            </div>

                            <Button className="w-full mt-6 py-3">
                                View Details
                            </Button>
                        </Card>
                    ))}
                </div>

                {/* Selected Property Details Simulation */}
                <div className="mt-12">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Citynorth Quarter <span className="text-slate-400 font-medium text-lg ml-2">204 units</span></h2>
                        </div>
                        <button className="flex items-center gap-2 text-sm bg-white border border-slate-200 px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-slate-50 transition-colors">
                            <Filter className="w-4 h-4 ml-1" />
                            Filter <ChevronDown className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                                <span className="bg-red-100 text-red-700 w-5 h-5 flex items-center justify-center rounded-full mr-2">🔴</span>
                                Critical (2)
                            </h3>
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                                {mockSituations.filter(s => s.tier === "CRITICAL").map(sit => <SituationCard key={sit.id} situation={sit} />)}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center mt-8">
                                <span className="bg-amber-100 text-amber-700 w-5 h-5 flex items-center justify-center rounded-full mr-2">🟡</span>
                                High (5)
                            </h3>
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                                {mockSituations.filter(s => s.tier === "HIGH").map(sit => <SituationCard key={sit.id} situation={{ ...sit, id: sit.id + "alt" }} />)}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
