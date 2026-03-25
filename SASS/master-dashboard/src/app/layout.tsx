import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { LayoutDashboard, Users, Activity } from "lucide-react";
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
  title: "Master Controller | TIFL SaaS",
  description: "SaaS Management and Provisioning Dashboard",
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
      <body className="min-h-full flex flex-col bg-gray-50/50">
        <header className="bg-white border-b border-gray-100 py-3 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-1.5 rounded-lg shadow-inner">
                <Activity size={20} className="text-white" />
              </div>
              <span className="text-sm font-black text-gray-900 tracking-tight">TIFL<span className="text-indigo-600 ml-1">MASTER</span></span>
            </div>
            
            <nav className="flex items-center gap-1 bg-gray-50/80 p-1 rounded-xl border border-gray-100">
              <Link href="/" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all hover:bg-white hover:text-indigo-600 text-gray-500">
                <LayoutDashboard size={14} />
                Setup Wizard
              </Link>
              <Link href="/tenants" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all hover:bg-white hover:text-indigo-600 text-gray-500">
                <Users size={14} />
                Manage Tenants
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              <div className="h-6 w-px bg-gray-200 mx-1"></div>
              <div className="bg-green-50 text-green-700 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md border border-green-100 flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                Systems Online
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
      </body>
    </html>
  );
}
