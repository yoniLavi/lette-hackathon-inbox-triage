"use client"

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Building2, Mail } from "lucide-react";
import { getContacts, getProperties, contactName } from "@/lib/crm";
import type { CrmContact, CrmProperty } from "@/lib/crm";
import { usePageData, buildContactsContext } from "@/lib/page-context";
import { ContactBadge } from "@/components/ui/ContactBadge";
import { Card } from "@/components/ui/Card";

export default function ContactsPage() {
    const [contacts, setContacts] = useState<CrmContact[]>([]);
    const [properties, setProperties] = useState<Record<number, CrmProperty>>({});
    const [search, setSearch] = useState("");
    const { setData } = usePageData();
    const [typeFilter, setTypeFilter] = useState<string | null>(null);

    useEffect(() => {
        Promise.all([
            getContacts().catch(() => []),
            getProperties().catch(() => []),
        ]).then(([c, props]) => {
            setContacts(c);

            const pm: Record<number, CrmProperty> = {};
            for (const p of props) pm[p.id] = p;
            setProperties(pm);
            setData(buildContactsContext(c, pm));
        });
    }, []);

    const contactTypes = ["tenant", "landlord", "contractor", "prospect", "internal", "legal"];

    const filtered = contacts.filter(c => {
        if (typeFilter && c.type !== typeFilter) return false;
        if (search) {
            const q = search.toLowerCase();
            const name = (contactName(c) || "").toLowerCase();
            const email = c.email.toLowerCase();
            const company = (c.company || "").toLowerCase();
            return name.includes(q) || email.includes(q) || company.includes(q);
        }
        return true;
    });

    // Group by type
    const grouped: Record<string, CrmContact[]> = {};
    for (const c of filtered) {
        const t = c.type || "other";
        if (!grouped[t]) grouped[t] = [];
        grouped[t].push(c);
    }

    const typeOrder = [...contactTypes, "other"].filter(t => grouped[t]?.length);

    return (
        <div className="min-h-screen flex flex-col relative z-0 bg-[#F7F7F2]">
            <header className="sticky top-0 z-50 bg-[#F7F7F2]/80 backdrop-blur-md">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-10 flex items-center justify-between">
                    <Link href="/" className="flex items-center text-[#0F1016]/60 hover:text-[#0000EE] transition-colors bg-[#F2F2EC] hover:bg-[#0000EE]/5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                        <ArrowLeft className="w-3 h-3 mr-1.5" /> Dashboard
                    </Link>
                    <div className="font-sans font-bold text-[#0F1016] text-sm uppercase tracking-[0.2em]">Contacts</div>
                    <div></div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
                {/* Search and filters */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F1016]/30" />
                        <input
                            type="text"
                            placeholder="Search by name, email, or company..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-[#F2F2EC] border border-transparent focus:border-[#0000EE]/30 rounded-full text-sm font-sans text-[#0F1016] placeholder:text-[#0F1016]/30 outline-none transition-colors"
                        />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={() => setTypeFilter(null)}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                                !typeFilter ? "bg-[#0000EE] text-white" : "bg-[#F2F2EC] text-[#0F1016]/50 hover:text-[#0000EE]"
                            }`}
                        >
                            All ({contacts.length})
                        </button>
                        {contactTypes.map(type => {
                            const count = contacts.filter(c => c.type === type).length;
                            if (count === 0) return null;
                            return (
                                <button
                                    key={type}
                                    onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                                    className={`px-3 py-1.5 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                                        typeFilter === type ? "bg-[#0000EE] text-white" : "bg-[#F2F2EC] text-[#0F1016]/50 hover:text-[#0000EE]"
                                    }`}
                                >
                                    {type}s ({count})
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Contact list */}
                <div className="space-y-6">
                    {typeOrder.map(type => (
                        <section key={type}>
                            <h2 className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">
                                {type}s
                                <span className="ml-4 h-px flex-1 bg-slate-200"></span>
                                <span className="ml-4">{grouped[type].length}</span>
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {grouped[type].map(c => {
                                    const prop = c.property_id ? properties[c.property_id] : null;
                                    return (
                                        <Link key={c.id} href={`/contacts/${c.id}`}>
                                        <Card className="p-4 bg-[#F2F2EC] border-transparent hover:border-black/5 transition-all">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5">
                                                    <ContactBadge type={c.type} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-sans font-medium text-[#0F1016]">
                                                        {contactName(c) || c.email}
                                                    </p>
                                                    <p className="text-[11px] text-[#0F1016]/40 font-sans truncate flex items-center gap-1">
                                                        <Mail className="w-3 h-3 flex-shrink-0" />
                                                        {c.email}
                                                    </p>
                                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10px] text-[#0F1016]/40 font-sans">
                                                        {prop && (
                                                            <span className="flex items-center gap-0.5">
                                                                <Building2 className="w-3 h-3" />
                                                                {prop.name}
                                                            </span>
                                                        )}
                                                        {c.unit && <span>Unit {c.unit}</span>}
                                                        {c.company && <span>{c.company}</span>}
                                                        {c.role && <span>{c.role}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                        </Link>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                    {filtered.length === 0 && contacts.length > 0 && (
                        <p className="text-sm text-slate-400 italic text-center py-8">No contacts match your search.</p>
                    )}
                    {contacts.length === 0 && (
                        <p className="text-sm text-slate-400 italic text-center py-8">Loading contacts...</p>
                    )}
                </div>
            </main>
        </div>
    );
}
