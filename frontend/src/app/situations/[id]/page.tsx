"use client"

import React, { useState } from "react";
import { ArrowLeft, Edit2, Clock, CheckSquare, Zap, MapPin, User, FileText, Send, X, MoreVertical } from "lucide-react";
import Link from "next/link";
import { mockSituations } from "@/lib/data";
import { UrgencyBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { motion } from "framer-motion";

export default function SituationDetail({ params }: { params: { id: string } }) {
    const situation = mockSituations[0]; // mock fallback
    const [activeTab, setActiveTab] = useState("timeline");

    return (
        <div className="min-h-screen flex flex-col relative z-0 bg-[#F7F7F2]">
            {/* Warmth & Glow Layer */}
            <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#FF8A00] opacity-[0.03] blur-[120px] rounded-full" />
                <div className="absolute bottom-[20%] left-[-10%] w-[40%] h-[40%] bg-[#0000EE] opacity-[0.02] blur-[120px] rounded-full" />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/soft-wallpaper.png')] opacity-[0.1] mix-blend-overlay" />
            </div>

            <header className="sticky top-0 z-50 bg-[#F7F7F2]/80 backdrop-blur-md">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-10 flex items-center justify-between">
                    <Link href="/" className="flex items-center text-[#0F1016]/60 hover:text-[#0000EE] transition-colors bg-[#F2F2EC] hover:bg-[#0000EE]/5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                        <ArrowLeft className="w-3 h-3 mr-1.5" /> Back to Dashboard
                    </Link>
                    <div className="flex gap-3">
                        <Button variant="secondary" size="fixed" className="px-4 py-1.5 rounded-full shadow-sm text-sm">
                            Snooze
                        </Button>
                        <Button variant="secondary" size="fixed" className="px-4 py-1.5 rounded-full shadow-sm text-sm">
                            Edit Details
                        </Button>
                        <Button size="fixed" className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-4 py-1.5 rounded-full shadow-sm text-sm hover:-translate-y-0.5 transition-all">
                            Close Case
                        </Button>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8">

                    {/* Left Panel: Overview (7 columns = 58%) */}
                    <div className="lg:col-span-7 flex flex-col gap-6">

                        {/* Header Section */}
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <UrgencyBadge tier="CRITICAL">🔴 CRITICAL</UrgencyBadge>
                                        <span className="text-[10px] font-sans font-bold text-[#0F1016]/60 bg-[#F2F2EC] px-2 py-0.5 rounded uppercase tracking-wider">Maintenance Emergency</span>
                                        <span className="text-[10px] font-sans font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase tracking-wider border border-emerald-100/50">Status: Open</span>
                                    </div>
                                    <h1 className="text-2xl font-serif font-medium text-[#0F1016] tracking-tight leading-tight">{situation.title}</h1>
                                    <p className="text-[#0F1016]/60 flex items-center mt-1 text-sm font-medium">
                                        <MapPin className="w-3.5 h-3.5 mr-1.5 text-[#0F1016]/40" />
                                        Citynorth Quarter, Unit 4B
                                    </p>
                                </div>
                                <button className="flex items-center gap-1.5 text-[10px] bg-white text-[#0F1016] hover:bg-[#F2F2EC] font-bold uppercase tracking-widest px-4 py-2 rounded-full border border-[#0F1016]/5 transition-all shadow-sm">
                                    <User className="w-3.5 h-3.5" />
                                    Assign
                                </button>
                            </div>
                            <div className="flex gap-4 text-[10px] font-sans font-bold text-[#0F1016]/40 uppercase tracking-[0.2em] border-b border-[#0F1016]/5 pb-3 mt-4">
                                <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> Opened: 2h ago</span>
                                <span className="flex items-center"><Edit2 className="w-3 h-3 mr-1" /> Updated: 20 mins ago</span>
                            </div>
                        </motion.div>

                        {/* AI Summary */}
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                            <Card className="border-[#0000EE]/20 overflow-hidden shadow-sm relative bg-[#F2F2EC]">
                                <div className="absolute top-0 left-0 w-1 h-full bg-[#0000EE]"></div>
                                <div className="bg-[#0000EE]/5 border-b border-[#0000EE]/10 p-3 px-5 flex justify-between items-center">
                                    <h3 className="font-bold text-[#0000EE] flex items-center text-[10px] tracking-[0.2em] uppercase">
                                        <Zap className="w-4 h-4 mr-2 text-[#0000EE] fill-[#0000EE]" /> AI Summary & Rationale
                                    </h3>
                                    <button className="text-[10px] font-bold text-[#0F1016]/60 hover:text-[#0F1016] flex items-center bg-white px-2 py-1 rounded-full border border-[#0F1016]/5 uppercase tracking-wider">
                                        <Edit2 className="w-3 h-3 mr-1" /> Refine
                                    </button>
                                </div>
                                <div className="p-5 space-y-4">
                                    <p className="text-[#0F1016] leading-relaxed font-sans text-[15px]">
                                        Tenant Maria Santos reported a water leak from ceiling in Unit 4B at 7:15am. She sent a follow-up 2 hours later stating water is still flowing and damaging furniture. No contractor has been assigned yet.
                                    </p>

                                    <div className="bg-white/50 rounded-lg border border-[#0F1016]/5 p-4">
                                        <h4 className="text-[10px] font-bold text-rose-600 uppercase tracking-[0.2em] mb-2 flex items-center">
                                            <Zap className="w-3.5 h-3.5 mr-1" /> Why this is CRITICAL
                                        </h4>
                                        <ul className="space-y-1 text-sm text-[#0F1016]/80 list-inside list-disc pl-1 font-medium">
                                            <li>Emergency maintenance (habitability issue)</li>
                                            <li>Tenant contacted twice within 2 hours</li>
                                            <li>Property damage actively occurring</li>
                                            <li><strong className="text-[#0F1016]">Risk:</strong> No contractor response yet</li>
                                        </ul>
                                    </div>

                                    <div className="bg-white/50 rounded-lg border border-[#0F1016]/5 p-4 border-l-4 border-l-amber-400">
                                        <h4 className="text-[10px] font-bold text-amber-700 uppercase tracking-[0.2em] mb-2">
                                            💰 Estimated Exposure
                                        </h4>
                                        <ul className="space-y-1 text-[13px] text-[#0F1016]/80 list-inside list-disc pl-1 font-mono uppercase tracking-tight">
                                            <li>Emergency callout: €300-500</li>
                                            <li>Potential property damage: €1,000-2,500</li>
                                            <li>Tenant compensation risk if delayed</li>
                                        </ul>
                                    </div>

                                    <div className="flex gap-2 flex-wrap">
                                        <span className="bg-rose-100 text-rose-700 text-xs px-2.5 py-1 rounded-full font-medium flex items-center border border-rose-200">Emergency <button className="ml-1 hover:text-rose-900"><X className="w-3 h-3" /></button></span>
                                        <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full font-medium flex items-center border border-blue-200">Water <button className="ml-1 hover:text-blue-900"><X className="w-3 h-3" /></button></span>
                                        <span className="bg-amber-100 text-amber-700 text-xs px-2.5 py-1 rounded-full font-medium flex items-center border border-amber-200">Property Damage <button className="ml-1 hover:text-amber-900"><X className="w-3 h-3" /></button></span>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>

                        {/* Timeline */}
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                            <div className="flex justify-between items-center mb-4 mt-2">
                                <h3 className="text-lg font-serif font-medium text-[#0F1016] flex items-center">
                                    Communications <span className="ml-2 bg-[#F2F2EC] text-[#0F1016]/60 text-[10px] px-2 py-0.5 rounded-full font-bold">3</span>
                                </h3>
                                <button className="text-[10px] font-bold text-[#0000EE] hover:underline uppercase tracking-wider">
                                    Expand All
                                </button>
                            </div>

                            <div className="space-y-4">
                                <Card className="p-4 border-transparent shadow-sm border-l-4 border-l-[#0F1016]/20 bg-[#F2F2EC]">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-[#0000EE]/10 text-[#0000EE] w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs">
                                                MS
                                            </div>
                                            <div>
                                                <p className="font-bold text-[#0F1016] text-sm">Maria Santos <span className="text-[#0F1016]/40 font-normal">→ Management</span></p>
                                                <p className="text-[#0F1016]/80 text-sm font-medium">"Water still leaking - urgent!"</p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] text-[#0F1016]/40 font-bold uppercase tracking-wider">Today, 9:15 AM</span>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm text-slate-700 font-sans leading-relaxed">
                                        Hi, I emailed 2 hours ago about the water leak from my ceiling. It's still going and now my couch is soaked. Can someone please come immediately?
                                    </div>
                                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                                        <button className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors">Reply</button>
                                        <button className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors">Forward</button>
                                        <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-900 ml-auto flex items-center transition-colors">View in CRM <ArrowLeft className="w-3 h-3 ml-1 rotate-135" /></button>
                                    </div>
                                </Card>

                                <Card className="p-3 border-transparent shadow-sm flex items-center justify-between hover:bg-white/50 cursor-pointer transition-colors border-l-4 border-l-[#0F1016]/10 bg-[#F2F2EC]">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-[#0000EE]/5 text-[#0000EE]/40 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs italic">
                                            MS
                                        </div>
                                        <div>
                                            <p className="font-medium text-[#0F1016]/80 text-sm">Maria Santos <span className="text-[#0F1016]/40 font-normal">→ Management</span></p>
                                            <p className="text-[#0F1016]/60 text-sm italic">"Water leak in Unit 4B"</p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-[#0F1016]/40 font-bold uppercase tracking-wider bg-white/50 px-2 py-1 rounded">Today, 7:15 AM</span>
                                </Card>

                                <Card className="p-3 border-slate-200 shadow-sm flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors border-l-4 border-l-emerald-300">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-emerald-50 text-emerald-500 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-700 text-sm">Internal Note <span className="text-slate-500 font-normal">by System</span></p>
                                            <p className="text-slate-500 text-sm text-emerald-700">Situation prioritized by AI Triage</p>
                                        </div>
                                    </div>
                                    <span className="text-xs text-slate-400 font-mono bg-slate-100 px-2 py-1 rounded">Today, 7:20 AM</span>
                                </Card>
                            </div>
                        </motion.div>
                    </div>

                    {/* Right Panel: Actions & Context (5 columns = 42%) */}
                    <div className="lg:col-span-5 flex flex-col gap-6">

                        {/* Recommended Actions */}
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
                            <Card className="border-[#0000EE]/30 shadow-sm overflow-hidden border-2 relative bg-[#F2F2EC]">
                                <div className="bg-[#0000EE] p-3 px-5 flex justify-between items-center text-white">
                                    <h3 className="font-bold flex items-center text-[10px] tracking-[0.2em] uppercase">
                                        <Zap className="w-4 h-4 mr-2 text-white/70 fill-white" /> Recommended Actions
                                    </h3>
                                </div>
                                <div className="p-1">
                                    {/* Action 1 */}
                                    <div className="p-4 border-b border-[#0F1016]/5 hover:bg-white/30 transition-colors group">
                                        <div className="flex items-start gap-3">
                                            <input type="checkbox" className="mt-1 rounded border-[#0F1016]/20 text-[#0000EE] focus:ring-[#0000EE] w-4 h-4 cursor-pointer" />
                                            <div className="flex-1">
                                                <h4 className="font-bold text-[#0F1016] text-sm">Assign emergency plumber</h4>
                                                <div className="flex text-[10px] font-bold uppercase tracking-wider text-[#0F1016]/60 gap-3 mt-1.5 font-sans">
                                                    <span className="flex items-center text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">Deadline: ASAP (&lt;1h)</span>
                                                    <span className="flex items-center px-1.5 py-0.5 rounded bg-white border border-[#0F1016]/5">Owner: Maintenance</span>
                                                </div>
                                                <p className="text-sm text-[#0F1016]/80 mt-2 bg-white/50 border border-[#0F1016]/5 p-2 rounded relative italic">
                                                    Why: Habitability issue, water damage continuing. RTB requires emergency response within 24h.
                                                </p>
                                                <div className="mt-3 flex gap-2">
                                                    <Button size="sm" className="shadow-sm">Assign Contractor</Button>
                                                    <Button variant="secondary" size="sm" className="shadow-sm">Create Task</Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action 2 */}
                                    <div className="p-4 border-b border-[#0F1016]/5 hover:bg-white/30 transition-colors group">
                                        <div className="flex items-start gap-3">
                                            <input type="checkbox" className="mt-1 rounded border-[#0F1016]/20 text-[#0000EE] focus:ring-[#0000EE] w-4 h-4 cursor-pointer" />
                                            <div className="flex-1">
                                                <h4 className="font-bold text-[#0F1016] text-sm">Call tenant to confirm access</h4>
                                                <div className="flex text-[10px] font-bold uppercase tracking-wider text-[#0F1016]/60 gap-3 mt-1.5 font-sans">
                                                    <span className="px-1.5 py-0.5 rounded bg-white border border-[#0F1016]/5">Deadline: Before arrival</span>
                                                    <span className="px-1.5 py-0.5 rounded bg-white border border-[#0F1016]/5">Owner: PM</span>
                                                </div>
                                                <div className="mt-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button className="text-[10px] font-bold uppercase tracking-wider bg-white border border-[#0F1016]/5 hover:bg-[#F2F2EC] text-[#0F1016] px-3 py-1.5 rounded-full shadow-sm">Call Now</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Action 3 */}
                                    <div className="p-4 hover:bg-white/30 transition-colors">
                                        <div className="flex items-start gap-3">
                                            <input type="checkbox" className="mt-1 rounded border-[#0F1016]/20 text-[#0000EE] focus:ring-[#0000EE] w-4 h-4 cursor-pointer" />
                                            <div className="flex-1">
                                                <h4 className="font-bold text-[#0F1016] text-sm">Notify landlord of emergency repair</h4>
                                                <div className="flex text-[10px] font-bold uppercase tracking-wider text-[#0F1016]/60 gap-3 mt-1.5 font-sans">
                                                    <span className="px-1.5 py-0.5 rounded bg-white border border-[#0F1016]/5">Deadline: Today</span>
                                                    <span className="px-1.5 py-0.5 rounded bg-white border border-[#0F1016]/5">Owner: PM</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>

                        {/* Draft Response */}
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
                            <Card className="shadow-sm border-transparent bg-[#F2F2EC]">
                                <div className="border-b border-[#0F1016]/5 p-3 px-4 flex justify-between items-center bg-[#0F1016]/5 rounded-t-xl">
                                    <h3 className="font-bold text-[#0F1016] flex items-center text-[10px] tracking-[0.2em] uppercase">
                                        ✍️ Draft Response
                                    </h3>
                                    <div className="flex gap-2">
                                        <button className="p-1 hover:bg-[#0F1016]/10 rounded text-[#0F1016]/40"><MoreVertical className="w-4 h-4" /></button>
                                    </div>
                                </div>
                                <div className="p-4 border-b border-[#0F1016]/5 space-y-2 text-[13px]">
                                    <div className="flex font-medium"><span className="w-16 text-[#0F1016]/40 font-bold uppercase text-[10px] pt-0.5">To:</span> <span className="text-[#0F1016]">Maria Santos &lt;maria.s@email.com&gt;</span></div>
                                    <div className="flex font-medium"><span className="w-16 text-[#0F1016]/40 font-bold uppercase text-[10px] pt-0.5">Subject:</span> <span className="text-[#0F1016]">Re: Water leak in Unit 4B</span></div>
                                </div>
                                <div className="p-4 bg-white/50 font-sans text-sm text-[#0F1016]/80 leading-relaxed space-y-4 italic">
                                    <p>Dear Maria,</p>
                                    <p>Thank you for bringing this to our urgent attention. I sincerely apologize for the delay in response.</p>
                                    <p>I have immediately assigned an emergency plumber who will contact you within the next 30 minutes to arrange access. Please ensure someone is available to provide entry.</p>
                                    <p>Regarding the damage to your furniture, please document with photos and we will address compensation once the leak is resolved.</p>
                                    <div className="flex items-center text-[10px] font-bold text-[#0000EE] bg-[#0000EE]/5 p-2 rounded mt-4 border border-[#0000EE]/10 uppercase tracking-wider">
                                        <BotIcon className="w-3.5 h-3.5 mr-1.5" /> Generated by AI - Please review before sending
                                    </div>
                                </div>
                                <div className="p-3 bg-[#0F1016]/5 rounded-b-xl border-t border-[#0F1016]/5 flex justify-between items-center">
                                    <button className="text-[10px] font-bold text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded uppercase tracking-wider">Discard</button>
                                    <div className="flex gap-2">
                                        <Button variant="secondary" size="sm" className="rounded-full shadow-sm text-[10px] font-bold uppercase tracking-wider">Edit</Button>
                                        <Button size="sm" className="rounded-full shadow-sm text-[10px] font-bold uppercase tracking-wider">
                                            <Send className="w-4 h-4 mr-2" /> Send via CRM
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>

                        {/* Context */}
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
                            <Card className="shadow-sm border-transparent bg-[#F2F2EC]">
                                <div className="border-b border-[#0F1016]/5 p-3 px-4 bg-[#0F1016]/5 rounded-t-xl">
                                    <h3 className="font-bold text-[#0F1016] text-[10px] uppercase tracking-[0.2em] flex items-center">
                                        📋 Related Context
                                    </h3>
                                </div>
                                <div className="p-4 space-y-4">
                                    <div>
                                        <h4 className="text-[10px] font-bold text-[#0F1016]/40 uppercase tracking-[0.2em] mb-1">Property</h4>
                                        <p className="font-bold text-[#0F1016] text-sm">Citynorth Quarter</p>
                                        <p className="text-sm text-[#0F1016]/60 font-medium">204 units • Built 2019</p>
                                        <a href="#" className="text-[10px] font-bold text-[#0000EE] uppercase tracking-wider hover:underline mt-2 inline-block">View in CRM &rarr;</a>
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-bold text-[#0F1016]/40 uppercase tracking-[0.2em] mb-1 mt-2">Tenant History</h4>
                                        <ul className="text-sm text-[#0F1016]/80 space-y-2">
                                            <li className="flex items-center gap-2">• <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide">Current</span></li>
                                            <li className="font-medium">• Tenancy: 18 months</li>
                                            <li className="font-medium">• 3 previous requests resolved</li>
                                        </ul>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>

                    </div>
                </div>
            </main>
        </div>
    );
}

function BotIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M12 8V4H8" />
            <rect width="16" height="12" x="4" y="8" rx="2" />
            <path d="M2 14h2" />
            <path d="M20 14h2" />
            <path d="M15 13v2" />
            <path d="M9 13v2" />
        </svg>
    );
}
