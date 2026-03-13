import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { Lora, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { PageDataProvider } from "@/lib/page-context";
import { AIAssistant } from "@/components/dashboard/AIAssistant";
import { Logo } from "@/components/ui/Logo";
import "./globals.css";

const tiemposFallback = Lora({
  variable: "--font-tiempos",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Give(a)Lette",
  description: "AI triage system dashboard for property management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${tiemposFallback.variable} ${jetbrainsMono.variable} font-serif`}>
      <body className="relative w-full h-full overflow-x-hidden antialiased selection:bg-primary/20 selection:text-primary min-h-screen text-[14px]">
        {/* Soft Futurism Orbs mapped to new accent/primary colors */}
        <div className="fixed inset-0 -z-10 bg-[#EDEDE9]" />
        <PageDataProvider>
        <nav className="relative z-20 w-full flex justify-center px-4 md:px-12 py-4">
          <div className="max-w-7xl w-full flex items-center gap-8">
            <Logo />
            <div className="flex items-center gap-4">
              <Link href="/" className="text-xs font-sans font-bold uppercase tracking-[0.15em] text-[#0F1016]/40 hover:text-[#0000EE] transition-colors">Dashboard</Link>
              <Link href="/properties" className="text-xs font-sans font-bold uppercase tracking-[0.15em] text-[#0F1016]/40 hover:text-[#0000EE] transition-colors">Properties</Link>
              <Link href="/shifts" className="text-xs font-sans font-bold uppercase tracking-[0.15em] text-[#0F1016]/40 hover:text-[#0000EE] transition-colors">Shifts</Link>
            </div>
          </div>
        </nav>
        <div className="relative z-10 w-full h-full">
          {children}
        </div>
        <AIAssistant />
        </PageDataProvider>
      </body>
    </html>
  );
}
