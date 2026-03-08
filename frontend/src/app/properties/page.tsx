"use client"

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getProperties } from "@/lib/espo";
import type { CrmProperty } from "@/lib/espo";

export default function PropertiesView() {
    const [properties, setProperties] = useState<CrmProperty[]>([]);

    useEffect(() => {
        getProperties().catch(() => []).then(setProperties);
    }, []);

    return (
        <div className="min-h-screen flex flex-col relative z-0 bg-[#F7F7F2]">
            <header className="sticky top-0 z-50 bg-[#F7F7F2]/80 backdrop-blur-md">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-10 flex items-center justify-between">
                    <Link href="/" className="flex items-center text-[#0F1016]/60 hover:text-[#0000EE] transition-colors bg-[#F2F2EC] hover:bg-[#0000EE]/5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                        <ArrowLeft className="w-3 h-3 mr-1.5" /> Dashboard
                    </Link>
                    <div className="font-sans font-bold text-[#0F1016] text-sm uppercase tracking-[0.2em]">Properties</div>
                    <div></div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {properties.map(prop => (
                        <Card key={prop.id} className="p-6 hover:shadow-md transition-shadow relative overflow-hidden group bg-[#F2F2EC] border-transparent">
                            <div className="absolute top-0 left-0 w-1 h-full bg-slate-200 group-hover:bg-[#0000EE] transition-colors"></div>
                            <div>
                                <h2 className="text-xl font-serif font-medium text-[#0F1016] flex items-center">
                                    <Building2 className="w-5 h-5 mr-2 text-[#0F1016]/40" />
                                    {prop.name}
                                </h2>
                                <div className="flex gap-3 mt-1 text-xs text-[#0F1016]/60 font-sans">
                                    <span>{prop.type}</span>
                                    <span>{prop.units} units</span>
                                    <span>{prop.manager}</span>
                                </div>
                                {prop.description && (
                                    <p className="text-sm text-[#0F1016]/60 mt-2 font-sans whitespace-pre-line">{prop.description}</p>
                                )}
                            </div>
                        </Card>
                    ))}
                    {properties.length === 0 && (
                        <p className="text-sm text-slate-400 italic col-span-full">Loading properties...</p>
                    )}
                </div>
            </main>
        </div>
    );
}
