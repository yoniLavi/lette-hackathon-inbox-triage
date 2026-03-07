"use client"

import React from "react";
import Link from "next/link";
import { mockSituations, mockActivities } from "@/lib/data";
import { SituationCard } from "@/components/dashboard/SituationCard";
import { ActivityCard } from "@/components/dashboard/ActivityCard";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { Search, Bell, Settings, UserCircle, Inbox } from "lucide-react";
import { motion } from "framer-motion";

export default function Dashboard() {
  const criticalSituations = mockSituations.filter(s => s.tier === "CRITICAL");
  const highSituations = mockSituations.filter(s => s.tier === "HIGH");
  const mediumSituations = mockSituations.filter(s => s.tier === "MEDIUM");
  const lowSituations = mockSituations.filter(s => s.tier === "LOW");

  return (
    <div className="min-h-screen flex flex-col relative z-0">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#0000EE] p-2 rounded-lg text-white shadow-md">
              <Inbox className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-sans font-bold text-[#0F1016] tracking-tight hidden sm:block">AgentTriage UI</h1>
          </div>
          <div className="flex-1 max-w-lg mx-6">
            <Link href="/search" className="block relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0000EE] rounded-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-[#0000EE] transition-colors" />
              <div
                className="w-full pl-10 pr-4 py-2 rounded-full border border-slate-200 bg-slate-50 group-hover:bg-white group-hover:ring-2 group-hover:ring-[#0000EE]/20 group-hover:border-[#0000EE] transition-all text-sm text-slate-500 shadow-sm group-hover:shadow flex items-center cursor-text"
              >
                Search properties, tenants, cases...
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative text-slate-500 hover:text-slate-800 transition-colors p-2 hover:bg-slate-100 rounded-full">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>
            <button className="text-slate-500 hover:text-slate-800 transition-colors p-2 hover:bg-slate-100 rounded-full">
              <Settings className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1"></div>
            <button className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors bg-white hover:bg-slate-50 border border-slate-200 rounded-full px-1.5 py-1.5 pr-4 shadow-sm">
              <UserCircle className="w-6 h-6 text-slate-400" />
              Maria PM
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="text-[64px] leading-none font-sans font-bold text-[#0F1016] tracking-tight">Morning, Maria</h2>
            <p className="text-slate-500 font-serif text-[14px] mt-4">Here's what needs your attention today.</p>
          </div>
          <p className="text-sm font-medium text-slate-400 font-mono tracking-wider tabular-nums">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8">

          {/* Left Column: Priority Queue (5 columns out of 12 = ~41%) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h3 className="flex items-center text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">
                <span className="bg-red-100 text-red-700 w-5 h-5 flex items-center justify-center rounded-full mr-2">🔴</span>
                Critical Queue
                <span className="ml-auto bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs">{criticalSituations.length}</span>
              </h3>
              <div className="space-y-3">
                {criticalSituations.map(sit => <SituationCard key={sit.id} situation={sit} />)}
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="flex items-center text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">
                <span className="bg-amber-100 text-amber-700 w-5 h-5 flex items-center justify-center rounded-full mr-2">🟡</span>
                High Urgency
                <span className="ml-auto bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs">{highSituations.length}</span>
              </h3>
              <div className="space-y-3">
                {highSituations.map(sit => <SituationCard key={sit.id} situation={sit} />)}
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h3 className="flex items-center text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">
                <span className="bg-blue-100 text-blue-700 w-5 h-5 flex items-center justify-center rounded-full mr-2">🔵</span>
                Medium Urgency
                <span className="ml-auto bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs">{mediumSituations.length}</span>
              </h3>
              <div className="space-y-3">
                {mediumSituations.map(sit => <SituationCard key={sit.id} situation={sit} />)}
              </div>
            </motion.section>

            <section className="opacity-80">
              <h3 className="flex items-center text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">
                <span className="bg-gray-200 text-gray-700 w-5 h-5 flex items-center justify-center rounded-full mr-2">⚪</span>
                Low Priority
                <span className="ml-auto bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs">{lowSituations.length}</span>
              </h3>
              <div className="space-y-3">
                {lowSituations.map(sit => <SituationCard key={sit.id} situation={sit} />)}
              </div>
            </section>
          </div>

          {/* Middle Column: Recent Activity (4 columns out of 12 = ~33%) */}
          <div className="lg:col-span-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-slate-50/50 rounded-2xl border border-slate-200 p-1"
            >
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center mb-5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></div>
                  Recent Activity
                </h3>
                <div className="space-y-3 relative before:absolute before:inset-y-2 before:-left-3 before:w-px before:bg-gradient-to-b before:from-slate-200 before:via-slate-200 before:to-transparent ml-3 pl-3">
                  {mockActivities.map(act => (
                    <div key={act.id} className="relative">
                      <div className="absolute top-4 -left-3.5 w-[3px] h-[3px] rounded-full bg-slate-400 shadow-sm border border-white"></div>
                      <ActivityCard activity={act} />
                    </div>
                  ))}
                </div>
                <button className="w-full mt-4 text-[14px] text-[#0000EE] font-medium hover:text-[#0000CC] transition-colors py-2 flex items-center justify-center bg-[#0000EE]/5 hover:bg-[#0000EE]/10 rounded-lg">
                  View full activity log
                </button>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Quick Stats & Filters (3 columns out of 12 = 25%) */}
          <div className="lg:col-span-3">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
              className="sticky top-24"
            >
              <QuickStats />
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
