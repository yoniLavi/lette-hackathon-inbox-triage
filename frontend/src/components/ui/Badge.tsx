import { cn } from "@/lib/utils";
import React from "react";

type BadgeTier = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    tier: BadgeTier;
    children: React.ReactNode;
}

const tierStyles: Record<BadgeTier, string> = {
    CRITICAL: "bg-red-50 border-red-200 text-red-600",
    HIGH: "bg-amber-50 border-amber-200 text-amber-600",
    MEDIUM: "bg-primary/10 border-primary/20 text-primary",
    LOW: "bg-slate-50 border-slate-200 text-slate-600",
};

export function UrgencyBadge({ tier, className, children, ...props }: BadgeProps) {
    return (
        <div
            className={cn(
                "inline-flex items-center rounded-lg border px-3 py-1 text-[13px] font-sans font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-primary",
                tierStyles[tier],
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}
