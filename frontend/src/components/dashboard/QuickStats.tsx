"use client"

import Link from "next/link";
import { ListChecks, FileEdit, Mail, Users, Building2 } from "lucide-react";
import type { CrmCase } from "@/lib/crm";

function StatLink({ href, label, value, color, icon: Icon }: {
    href: string;
    label: string;
    value: number | null;
    color?: string;
    icon: React.ComponentType<{ className?: string }>;
}) {
    return (
        <Link href={href} className="bg-[#F2F2EC] rounded-[16px] p-3 flex items-center gap-3 hover:bg-[#0000EE]/5 transition-colors group">
            <Icon className={`w-5 h-5 ${color || "text-[#0F1016]/30"} group-hover:text-[#0000EE] transition-colors`} />
            <div className="flex-1">
                <span className="text-[10px] font-sans font-bold text-[#0F1016]/40 uppercase tracking-[0.15em]">
                    {label}
                </span>
            </div>
            <span className={`text-[24px] font-serif font-medium leading-none ${value === null ? "text-[#0F1016]/10" : color || "text-[#0F1016]"}`}>
                {value === null ? "–" : value}
            </span>
        </Link>
    );
}

export function QuickStats({ taskCount, draftCount, unreadCount, contactCount, cases, loaded }: {
    taskCount: number;
    draftCount: number;
    unreadCount: number;
    contactCount: number;
    cases: CrmCase[];
    loaded: boolean;
}) {
    const v = (n: number) => loaded ? n : null;

    // Per-property open case counts
    const propertyStats: Record<string, { id: number; name: string; open: number }> = {};
    for (const c of cases) {
        if (c.property?.id && c.status !== "closed" && !c.name.startsWith("Agent Shift")) {
            const pid = c.property.id;
            if (!propertyStats[pid]) {
                propertyStats[pid] = { id: pid, name: c.property.name, open: 0 };
            }
            propertyStats[pid].open++;
        }
    }
    const sortedProperties = Object.values(propertyStats).sort((a, b) => b.open - a.open);

    return (
        <div className="flex flex-col gap-2">
            <StatLink href="/tasks" label="Pending Tasks" value={v(taskCount)} color="text-[#0000EE]" icon={ListChecks} />
            <StatLink href="/inbox" label="Drafts to Review" value={v(draftCount)} color="text-violet-600" icon={FileEdit} />
            <StatLink href="/contacts" label="Contacts" value={v(contactCount)} icon={Users} />
            <StatLink href="/shifts" label="Awaiting Triage" value={v(unreadCount)} color="text-amber-500" icon={Mail} />

            {sortedProperties.length > 0 && (
                <div className="bg-[#F2F2EC] rounded-[16px] p-3 mt-1">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-sans font-bold text-[#0F1016]/40 uppercase tracking-[0.15em]">Open Cases by Property</span>
                        <Link href="/properties" className="text-[10px] font-sans font-bold text-[#0000EE] uppercase tracking-wider hover:underline">All</Link>
                    </div>
                    <div className="space-y-1">
                        {sortedProperties.map(p => (
                            <Link key={p.id} href={`/properties/${p.id}`} className="flex items-center justify-between py-1 hover:text-[#0000EE] transition-colors group">
                                <span className="flex items-center gap-1.5 text-[12px] font-sans text-[#0F1016]/60 group-hover:text-[#0000EE]">
                                    <Building2 className="w-3 h-3" />
                                    {p.name}
                                </span>
                                <span className="text-[12px] font-sans font-bold text-[#0F1016]/40">{p.open}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
