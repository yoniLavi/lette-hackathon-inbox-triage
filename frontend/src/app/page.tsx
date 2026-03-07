"use client"

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { mockSituations, mockActivities } from "@/lib/data";
import { SituationCard } from "@/components/dashboard/SituationCard";
import { ActivityCard } from "@/components/dashboard/ActivityCard";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { AIAssistant } from "@/components/dashboard/AIAssistant";
import { ChevronDown, ChevronRight, Inbox, Bell, Settings, Search, User, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { motion } from "framer-motion";

export default function Dashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const scrollTriggered = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      // If user scrolls even a tiny bit from the top, snap to dashboard
      if (!scrollTriggered.current && window.scrollY > 20 && window.scrollY < 300) {
        scrollTriggered.current = true;
        dashboardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (window.scrollY === 0) {
        // Reset if they manually scroll back to the very top
        scrollTriggered.current = false;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const criticalSituations = mockSituations.filter(s => s.tier === "CRITICAL");
  const highSituations = mockSituations.filter(s => s.tier === "HIGH");
  const mediumSituations = mockSituations.filter(s => s.tier === "MEDIUM");
  const lowSituations = mockSituations.filter(s => s.tier === "LOW");

  return (
    <div className="min-h-screen flex flex-col relative z-0 bg-[#F7F7F2]">
      {/* Warmth & Glow Layer */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#FF8A00] opacity-[0.03] blur-[120px] rounded-full" />
        <div className="absolute bottom-[20%] left-[-10%] w-[40%] h-[40%] bg-[#0000EE] opacity-[0.02] blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/soft-wallpaper.png')] opacity-[0.1] mix-blend-overlay" />
      </div>

      {/* Premium Navigation - Integrated (Non-Floating) */}
      <nav className="w-full flex justify-center px-4 md:px-12 py-8">
        <div className="max-w-7xl w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#0F1016]">
              <path d="M12 2L4 7V17L12 22L20 17V7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-sans font-black text-[#0F1016] text-[22px] tracking-tight">Lette</span>
          </div>

          <div className="flex items-center gap-3">
            <Button className="h-9 px-5 rounded-full bg-[#0F1016] text-white hover:bg-black text-[12px] font-sans font-bold shadow-lg transition-all hidden md:flex">
              <Plus size={16} className="mr-2" />
              New Situation
            </Button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#0F1016]/10 hover:bg-[#0F1016]/5 transition-all text-[#0F1016] font-sans font-bold text-[14px]">
              <User size={18} />
              Portal
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 md:px-8 pb-16">
        <header className="min-h-[50vh] flex flex-col items-center justify-center text-center py-12">
          <div className="inline-flex items-center gap-2 bg-[#0F1016]/5 text-[#0F1016]/60 px-4 py-1.5 rounded-full text-[11px] font-sans font-bold uppercase tracking-[0.2em] mb-8 border border-[#0F1016]/10">
            Intelligence Operations
          </div>
          <h2 className="text-[10vw] md:text-[64px] leading-[0.95] font-serif font-medium text-[#0F1016] tracking-tight mb-6 max-w-3xl">
            Morning, Maria. <br /><span className="text-[#0F1016]/30">Your day at a glance.</span>
          </h2>
          <p className="font-sans text-[18px] text-[#0F1016]/60 max-w-xl leading-relaxed">
            AI agents have processed 42 new inquiries since you last logged in. 8 situations require your immediate intervention.
          </p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="mt-16 flex flex-col items-center gap-2 text-slate-400"
          >
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold">Scroll to focus</span>
            <div className="w-px h-12 bg-gradient-to-b from-slate-300 to-transparent" />
          </motion.div>
        </header>

        <div ref={dashboardRef} className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-4">

          {/* Left Column: Priority Queue (5 columns) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h3 className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">
                Critical Queue
                <span className="ml-4 h-px flex-1 bg-slate-200"></span>
                <span className="ml-4 text-[#EF4444]">{criticalSituations.length}</span>
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
              <h3 className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">
                High Priority
                <span className="ml-4 h-px flex-1 bg-slate-200"></span>
                <span className="ml-4 text-[#F59E0B]">{highSituations.length}</span>
              </h3>
              <div className="space-y-3">
                {highSituations.map(sit => <SituationCard key={sit.id} situation={sit} />)}
              </div>
            </motion.section>
          </div>

          {/* Middle Column: Recent Activity (4 columns) */}
          <div className="lg:col-span-4">
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
            >
              <h3 className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">
                Activity Stream
                <span className="ml-4 h-px flex-1 bg-slate-200"></span>
              </h3>
              <div className="space-y-3">
                {mockActivities.map(act => (
                  <ActivityCard key={act.id} activity={act} />
                ))}
              </div>
            </motion.section>
          </div>

          {/* Right Column: Quick Stats (3 columns) */}
          <div className="lg:col-span-3">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
            >
              <h3 className="flex items-center text-[12px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">
                Quick Insights
                <span className="ml-4 h-px flex-1 bg-slate-200"></span>
              </h3>
              <QuickStats />
            </motion.div>
          </div>
        </div>
      </main>
      <AIAssistant />
    </div>
  );
}
