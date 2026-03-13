import Link from "next/link";

interface LogoProps {
    className?: string;
}

export function Logo({ className = "" }: LogoProps) {
    return (
        <Link href="/" className={`flex items-center gap-3 no-underline ${className}`}>
            <div className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/lette-logo.svg" alt="Lette" className="h-6" height={24} />
                <span
                    className="absolute z-10 bg-[#0000EE] text-white text-[5.5px] font-sans font-black uppercase tracking-wider px-1.5 py-[2px] rounded-full leading-none -rotate-6 shadow-sm whitespace-nowrap"
                    style={{ bottom: "-4px", right: "-6px" }}
                >
                    Hackathon
                </span>
            </div>
            <div className="flex flex-col">
                <span className="text-[15px] font-sans font-bold tracking-tight text-[#0F1016] leading-tight">
                    Give(a)Lette
                </span>
                <span className="text-[9px] font-sans font-bold uppercase tracking-[0.15em] text-[#0F1016]/40 leading-tight">
                    Give(a)Go Hackathon 2026
                </span>
            </div>
        </Link>
    );
}
