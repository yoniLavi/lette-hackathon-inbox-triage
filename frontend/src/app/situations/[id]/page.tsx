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
        <div className="min-h-screen flex flex-col relative z-0">
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center text-slate-500 hover:text-indigo-600 transition-colors bg-slate-100 hover:bg-indigo-50 px-3 py-1.5 rounded-full text-sm font-medium border border-slate-200">
                        <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Dashboard
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
                                        <span className="text-sm text-slate-500 font-medium bg-slate-200 px-2 py-0.5 rounded-md">Maintenance Emergency</span>
                                        <span className="text-sm text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 italic">Status: Open</span>
                                    </div>
                                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-tight">{situation.title}</h1>
                                    <p className="text-slate-600 flex items-center mt-2 font-medium">
                                        <MapPin className="w-4 h-4 mr-1.5 text-slate-400" />
                                        Citynorth Quarter, Unit 4B
                                    </p>
                                </div>
                                <button className="flex items-center gap-1.5 text-sm bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold px-4 py-2 rounded-lg border border-indigo-200 transition-colors shadow-sm transition-transform active:scale-95">
                                    <User className="w-4 h-4" />
                                    Assign...
                                </button>
                            </div>
                            <div className="flex gap-4 text-xs font-mono text-slate-500 border-b border-slate-200 pb-4 mt-4">
                                <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> Opened: 2h ago</span>
                                <span className="flex items-center"><Edit2 className="w-3.5 h-3.5 mr-1" /> Updated: 20 mins ago</span>
                            </div>
                        </motion.div>

                        {/* AI Summary */}
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                            <Card className="border-indigo-200 overflow-hidden shadow-sm relative">
                                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                                <div className="bg-indigo-50/50 border-b border-indigo-100 p-3 px-5 flex justify-between items-center">
                                    <h3 className="font-bold text-indigo-900 flex items-center text-sm tracking-wider uppercase">
                                        <Zap className="w-4 h-4 mr-2 text-indigo-500 fill-indigo-500" /> AI Summary & Rationale
                                    </h3>
                                    <button className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center bg-white px-2 py-1 rounded border border-indigo-200">
                                        <Edit2 className="w-3 h-3 mr-1" /> Refine
                                    </button>
                                </div>
                                <div className="p-5 space-y-4">
                                    <p className="text-slate-800 leading-relaxed font-sans text-[15px]">
                                        Tenant Maria Santos reported a water leak from ceiling in Unit 4B at 7:15am. She sent a follow-up 2 hours later stating water is still flowing and damaging furniture. No contractor has been assigned yet.
                                    </p>

                                    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                                        <h4 className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-2 flex items-center">
                                            <Zap className="w-3.5 h-3.5 mr-1" /> Why this is CRITICAL
                                        </h4>
                                        <ul className="space-y-1 text-sm text-slate-700 list-inside list-disc pl-1">
                                            <li>Emergency maintenance (habitability issue)</li>
                                            <li>Tenant contacted twice within 2 hours</li>
                                            <li>Property damage actively occurring</li>
                                            <li><strong className="text-slate-900">Risk:</strong> No contractor response yet</li>
                                        </ul>
                                    </div>

                                    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)] border-l-4 border-l-amber-400">
                                        <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">
                                            💰 Estimated Exposure
                                        </h4>
                                        <ul className="space-y-1 text-sm text-slate-700 list-inside list-disc pl-1 font-mono text-[13px]">
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
                                <h3 className="text-lg font-bold text-slate-900 flex items-center">
                                    Communications <span className="ml-2 bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full">3</span>
                                </h3>
                                <button className="text-sm text-indigo-600 hover:text-indigo-800 font-medium bg-indigo-50 px-3 py-1 rounded-full transition-colors">
                                    Expand All
                                </button>
                            </div>

                            <div className="space-y-4">
                                <Card className="p-4 border-slate-200 shadow-sm border-l-4 border-l-slate-400">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                                                MS
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-900 text-sm">Maria Santos <span className="text-slate-500 font-normal">→ Management</span></p>
                                                <p className="text-slate-600 text-sm font-medium">"Water still leaking - urgent!"</p>
                                            </div>
                                        </div>
                                        <span className="text-xs text-slate-400 font-mono">Today, 9:15 AM</span>
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

                                <Card className="p-3 border-slate-200 shadow-sm flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors border-l-4 border-l-slate-300">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-indigo-50 text-indigo-400 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                                            MS
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-700 text-sm">Maria Santos <span className="text-slate-500 font-normal">→ Management</span></p>
                                            <p className="text-slate-500 text-sm">"Water leak in Unit 4B"</p>
                                        </div>
                                    </div>
                                    <span className="text-xs text-slate-400 font-mono bg-slate-100 px-2 py-1 rounded">Today, 7:15 AM</span>
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
                            <Card className="border-indigo-200 shadow-sm overflow-hidden border-2 relative">
                                <div className="bg-indigo-600 p-3 px-5 flex justify-between items-center text-white">
                                    <h3 className="font-bold flex items-center text-sm tracking-wider uppercase">
                                        <Zap className="w-4 h-4 mr-2 text-indigo-300 fill-indigo-300" /> Recommended Actions
                                    </h3>
                                </div>
                                <div className="p-1">
                                    {/* Action 1 */}
                                    <div className="p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                                        <div className="flex items-start gap-3">
                                            <input type="checkbox" className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" />
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-slate-900 text-sm">1. Assign emergency plumber</h4>
                                                <div className="flex text-xs text-slate-500 gap-3 mt-1.5 font-mono">
                                                    <span className="flex items-center text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">Deadline: ASAP (&lt;1h)</span>
                                                    <span className="flex items-center px-1.5 py-0.5 rounded bg-slate-100">Owner: Maintenance</span>
                                                </div>
                                                <p className="text-sm text-slate-600 mt-2 bg-white border border-slate-100 p-2 rounded relative">
                                                    Why: Habitability issue, water damage continuing. RTB requires emergency response within 24h.
                                                </p>
                                                <div className="mt-3 flex gap-2">
                                                    <Button size="sm" className="shadow">Assign Contractor</Button>
                                                    <Button variant="secondary" size="sm">Create Task</Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action 2 */}
                                    <div className="p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                        <div className="flex items-start gap-3">
                                            <input type="checkbox" className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" />
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-slate-900 text-sm">2. Call tenant to confirm access</h4>
                                                <div className="flex text-xs text-slate-500 gap-3 mt-1.5 font-mono">
                                                    <span className="px-1.5 py-0.5 rounded bg-slate-100">Deadline: Before arrival</span>
                                                    <span className="px-1.5 py-0.5 rounded bg-slate-100">Owner: PM</span>
                                                </div>
                                                <div className="mt-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button className="text-xs bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-md font-medium">Call Now</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Action 3 */}
                                    <div className="p-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex items-start gap-3">
                                            <input type="checkbox" className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" />
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-slate-900 text-sm">3. Notify landlord of emergency repair</h4>
                                                <div className="flex text-xs text-slate-500 gap-3 mt-1.5 font-mono">
                                                    <span className="px-1.5 py-0.5 rounded bg-slate-100">Deadline: Today</span>
                                                    <span className="px-1.5 py-0.5 rounded bg-slate-100">Owner: PM</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>

                        {/* Draft Response */}
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
                            <Card className="shadow-sm border-slate-200">
                                <div className="border-b border-slate-100 p-3 px-4 flex justify-between items-center bg-slate-50 rounded-t-xl">
                                    <h3 className="font-bold text-slate-800 flex items-center text-sm uppercase tracking-wider">
                                        ✍️ Draft Response
                                    </h3>
                                    <div className="flex gap-2">
                                        <button className="p-1 hover:bg-slate-200 rounded text-slate-500"><MoreVertical className="w-4 h-4" /></button>
                                    </div>
                                </div>
                                <div className="p-4 border-b border-slate-100 space-y-2 text-sm">
                                    <div className="flex"><span className="w-16 text-slate-400">To:</span> <span className="font-medium text-slate-900">Maria Santos &lt;maria.s@email.com&gt;</span></div>
                                    <div className="flex"><span className="w-16 text-slate-400">Subject:</span> <span className="font-medium text-slate-900">Re: Water leak in Unit 4B</span></div>
                                </div>
                                <div className="p-4 bg-white font-sans text-sm text-slate-800 leading-relaxed space-y-4">
                                    <p>Dear Maria,</p>
                                    <p>Thank you for bringing this to our urgent attention. I sincerely apologize for the delay in response.</p>
                                    <p>I have immediately assigned an emergency plumber who will contact you within the next 30 minutes to arrange access. Please ensure someone is available to provide entry.</p>
                                    <p>Regarding the damage to your furniture, please document with photos and we will address compensation once the leak is resolved.</p>
                                    <div className="flex items-center text-xs text-indigo-500 bg-indigo-50 p-2 rounded mt-4 border border-indigo-100">
                                        <BotIcon className="w-3.5 h-3.5 mr-1.5" /> Generated by AI - Please review before sending
                                    </div>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-b-xl border-t border-slate-200 flex justify-between items-center">
                                    <button className="text-sm font-semibold text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded transition-colors">Discard</button>
                                    <div className="flex gap-2">
                                        <Button variant="secondary" size="sm" className="rounded-lg shadow-sm">Edit</Button>
                                        <Button size="sm" className="rounded-lg shadow-sm">
                                            <Send className="w-4 h-4 mr-2" /> Send via CRM
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>

                        {/* Context */}
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
                            <Card className="shadow-sm border-slate-200">
                                <div className="border-b border-slate-100 p-3 px-4 bg-slate-50 rounded-t-xl">
                                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center">
                                        📋 Related Context
                                    </h3>
                                </div>
                                <div className="p-4 space-y-4">
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Property</h4>
                                        <p className="font-medium text-slate-900 text-sm">Citynorth Quarter</p>
                                        <p className="text-sm text-slate-500">204 units • Built 2019</p>
                                        <a href="#" className="text-xs text-indigo-600 hover:underline mt-1 inline-block">View in CRM &rarr;</a>
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 mt-2">Tenant History</h4>
                                        <ul className="text-sm text-slate-700 space-y-1">
                                            <li>• <span className="text-emerald-600 font-medium">Rent is current, no arrears</span></li>
                                            <li>• Tenancy duration: 18 months</li>
                                            <li>• 3 previous requests (all resolved)</li>
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
