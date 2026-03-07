interface LogoProps {
    className?: string;
}

export function Logo({ className = "" }: LogoProps) {
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/lette-logo.svg" alt="Lette" className={className} height={24} />
    );
}
