import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Providers from "../components/Providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Recovery Agent - Automated B2B Receivables",
  description: "Automate your B2B invoice recovery with AI. Send smart reminders via WhatsApp, Email, and Voice.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-black text-zinc-950 dark:text-zinc-50">
        <Providers>
          <header className="sticky top-0 z-50 w-full border-b border-zinc-200/50 bg-white/70 backdrop-blur-md dark:border-white/10 dark:bg-black/60">
            <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-8">
              <div className="flex items-center gap-10">
                <a className="flex items-center space-x-3 font-bold tracking-tight text-xl" href="/">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                    <span className="text-white text-sm font-bold">R</span>
                  </div>
                  <span>Recovery Agent</span>
                </a>
                <nav className="hidden md:flex items-center space-x-8 text-base font-medium text-zinc-600 dark:text-zinc-400">
                  <a className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-50" href="#product">Product</a>
                  <a className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-50" href="#how-it-works">How It Works</a>
                  <a className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-50" href="/invoices">Invoices</a>
                  <a className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-50" href="/companies">Companies</a>
                </nav>
              </div>
              <div className="flex items-center gap-4">
                <a href="/companies" className="hidden md:inline-flex items-center justify-center px-6 py-2.5 text-base font-medium transition-colors bg-zinc-900 text-zinc-50 hover:bg-zinc-900/90 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50/90 rounded-full">
                  Get Started
                </a>
              </div>
            </div>
          </header>
          <main className="flex-1">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
