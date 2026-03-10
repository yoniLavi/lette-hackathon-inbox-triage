"use client"

const typeStyles: Record<string, string> = {
    tenant: "bg-blue-50 border-blue-200 text-blue-700",
    landlord: "bg-purple-50 border-purple-200 text-purple-700",
    contractor: "bg-orange-50 border-orange-200 text-orange-700",
    prospect: "bg-emerald-50 border-emerald-200 text-emerald-700",
    internal: "bg-slate-50 border-slate-200 text-slate-700",
    legal: "bg-red-50 border-red-200 text-red-700",
};

export function ContactBadge({ type }: { type: string }) {
    const style = typeStyles[type] || typeStyles.internal;
    return (
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-sans font-bold uppercase tracking-wider ${style}`}>
            {type}
        </span>
    );
}
