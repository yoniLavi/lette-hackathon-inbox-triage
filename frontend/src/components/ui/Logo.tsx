import React from "react";

interface LogoProps {
    className?: string;
    iconOnly?: boolean;
}

export function Logo({ className = "", iconOnly = false }: LogoProps) {
    return (
        <div className={`flex items-center gap-2.5 text-[#0F1016] ${className}`}>
            {/* 6-pointed Asterisk Icon */}
            <div className="relative w-7 h-7 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                    {/* Petal 1 & 4 (Vertical) */}
                    <rect x="42" y="10" width="16" height="80" rx="8" fill="currentColor" />
                    {/* Petal 2 & 5 (Diagonal \ ) */}
                    <rect
                        x="42" y="10" width="16" height="80" rx="8" fill="currentColor"
                        style={{ transform: 'rotate(60deg)', transformOrigin: 'center' }}
                    />
                    {/* Petal 3 & 6 (Diagonal / ) */}
                    <rect
                        x="42" y="10" width="16" height="80" rx="8" fill="currentColor"
                        style={{ transform: 'rotate(-60deg)', transformOrigin: 'center' }}
                    />
                </svg>
            </div>

            {!iconOnly && (
                <span className="font-sans font-black text-inherit text-[22px] tracking-tight">
                    Lette
                </span>
            )}
        </div>
    );
}
