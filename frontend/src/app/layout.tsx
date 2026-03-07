import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { Lora, JetBrains_Mono } from "next/font/google";
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
  title: "PropTech Email Triage Dashboard",
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
        <div className="relative z-10 w-full h-full">
          {children}
        </div>
      </body>
    </html>
  );
}
