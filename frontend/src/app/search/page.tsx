"use client"

import { useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ContactBadge } from "@/components/ui/ContactBadge";
import { searchEmails, senderDisplay } from "@/lib/crm";
import type { CrmEmail } from "@/lib/crm";
import { usePageData, buildSearchContext } from "@/lib/page-context";
import { formatDistanceToNow } from "date-fns";

export default function SearchPage() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<CrmEmail[]>([]);
    const [searched, setSearched] = useState(false);
    const [loading, setLoading] = useState(false);
    const { setData } = usePageData();

    const handleSearch = useCallback(async (q: string) => {
        if (!q.trim()) return;
        setLoading(true);
        try {
            const emails = await searchEmails(q.trim());
            setResults(emails);
            setData(buildSearchContext(q.trim(), emails));
        } catch {
            setResults([]);
        } finally {
            setSearched(true);
            setLoading(false);
        }
    }, []);

    return (
        <div className="min-h-screen flex flex-col relative z-0 bg-[#F7F7F2]">
            <header className="sticky top-0 z-50 bg-[#F7F7F2]/80 backdrop-blur-md">
                <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 h-10 flex items-center justify-between">
                    <Link href="/" className="flex items-center text-[#0F1016]/60 hover:text-[#0000EE] transition-colors bg-[#F2F2EC] hover:bg-[#0000EE]/5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                        <ArrowLeft className="w-3 h-3 mr-1.5" /> Dashboard
                    </Link>
                    <div className="font-sans font-bold text-[#0F1016] text-sm uppercase tracking-[0.2em]">Search</div>
                    <div></div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-[1000px] mx-auto p-4 sm:p-6 lg:p-8">
                {/* Search Bar */}
                <div className="mb-8">
                    <form
                        onSubmit={(e) => { e.preventDefault(); handleSearch(query); }}
                        className="relative group max-w-2xl mx-auto shadow-sm"
                    >
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0000EE]" />
                        <input
                            type="text"
                            placeholder="Search emails by keyword..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            autoFocus
                            className="w-full pl-12 pr-4 py-4 rounded-[20px] border border-[#0F1016]/10 bg-[#F2F2EC] focus:ring-4 focus:ring-[#0000EE]/10 focus:border-[#0000EE]/50 transition-all font-sans text-lg font-bold text-[#0F1016] outline-none"
                        />
                        {loading && (
                            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0000EE] animate-spin" />
                        )}
                    </form>
                </div>

                {/* Results */}
                {searched && (
                    <div className="space-y-4">
                        <h2 className="text-[10px] font-sans font-bold text-[#0F1016]/40 uppercase tracking-[0.2em]">
                            {results.length} result{results.length !== 1 ? "s" : ""}
                        </h2>
                        {results.map(email => {
                            const sender = senderDisplay(email);
                            const bodySnippet = (email.body_plain || email.body || "").replace(/<[^>]*>/g, '').slice(0, 200);
                            const inner = (
                                <Card className={`p-4 bg-[#F2F2EC] border-transparent transition-shadow ${email.case_id ? "hover:shadow-md hover:translate-x-1 cursor-pointer" : ""}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-[#0F1016] text-sm">{sender}</p>
                                            {email.contact && <ContactBadge type={email.contact.type} />}
                                        </div>
                                        <span className="text-[10px] text-[#0F1016]/40 font-bold uppercase tracking-wider shrink-0" suppressHydrationWarning>
                                            {formatDistanceToNow(new Date(email.date_sent), { addSuffix: true })}
                                        </span>
                                    </div>
                                    <p className="text-sm font-serif font-medium text-[#0F1016] mb-1">{email.subject}</p>
                                    {bodySnippet && (
                                        <p className="text-xs text-[#0F1016]/60 font-sans line-clamp-2">{bodySnippet}</p>
                                    )}
                                </Card>
                            );
                            return email.case_id ? (
                                <Link key={email.id} href={`/situations/${email.case_id}`}>{inner}</Link>
                            ) : (
                                <div key={email.id}>{inner}</div>
                            );
                        })}
                        {results.length === 0 && (
                            <p className="text-sm text-slate-400 italic text-center py-8">No emails found matching &ldquo;{query}&rdquo;</p>
                        )}
                    </div>
                )}

                {!searched && (
                    <p className="text-sm text-[#0F1016]/40 font-sans text-center py-8">Enter a search term to find emails across all cases and threads.</p>
                )}
            </main>
        </div>
    );
}
