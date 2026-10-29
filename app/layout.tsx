import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: {
    default: "Sonora — Hear the Story of Art",
    template: "%s | Sonora",
  },
  description: "Scan an artwork and hear its story like a museum audio guide.",
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/logo.png", type: "image/png" },
    ],
    shortcut: "/logo.svg",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} style={{ backgroundColor: "#F5EDE0", color: "#5D2E1F" }}>
      <body className="min-h-full flex flex-col" style={{ backgroundColor: "#F5EDE0", color: "#5D2E1F" }}>
        <header className="border-b border-[#D4BFA6]/70 bg-[#F5EDE0]/95 shadow-[0_2px_14px_rgba(93,46,31,0.06)] backdrop-blur-sm">
          <nav className="mx-auto flex min-h-[76px] w-full max-w-5xl items-center justify-between px-4 sm:px-6" aria-label="Main navigation">
            <Link href="/" className="flex items-center gap-3 rounded-2xl px-2 py-1.5 transition hover:bg-[#EADCC8]/70" aria-label="Sonora home">
              <Image
                src="/logo.svg"
                alt="Sonora logo"
                width={42}
                height={42}
                priority
                className="size-10 rounded-xl object-contain"
              />
              <span className="font-display text-2xl font-bold italic tracking-tight text-[#B45309]">Sonora</span>
            </Link>
            <div className="flex items-center gap-1 rounded-2xl border border-[#D4BFA6] bg-[#FFF8F0]/80 p-1 shadow-sm">
              <Link href="/" className="rounded-xl px-4 py-2 text-sm font-semibold text-[#5D2E1F] transition hover:bg-[#EADCC8]" aria-label="Scan artwork">
                Scan
              </Link>
              <Link href="/history" className="rounded-xl bg-[#B45309] px-4 py-2 text-sm font-semibold text-[#FFF8F0] shadow-sm transition hover:bg-[#8F4008]" aria-label="View scan history">
                History
              </Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
