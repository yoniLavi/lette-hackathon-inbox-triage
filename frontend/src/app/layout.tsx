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
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#0000EE]/10 blur-[120px] rounded-full mix-blend-multiply"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#0F1016]/5 blur-[120px] rounded-full mix-blend-multiply"></div>
        </div>
        <div className="relative z-10 w-full h-full">
          {children}
        </div>
      </body>
    </html>
  );
}
