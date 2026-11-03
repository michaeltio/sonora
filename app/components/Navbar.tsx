"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

function linkClass(active: boolean) {
  return active
    ? "rounded-xl bg-[#B45309] px-4 py-2 text-sm font-semibold text-[#FFF8F0] shadow-sm transition hover:bg-[#8F4008]"
    : "rounded-xl px-4 py-2 text-sm font-semibold text-[#5D2E1F] transition hover:bg-[#EADCC8]";
}

export default function Navbar() {
  const pathname = usePathname();
  const onScan = pathname === "/";
  const onExamples = pathname === "/examples" || pathname.startsWith("/examples/");
  const onKb = pathname === "/kb" || pathname.startsWith("/kb/");
  const showKb = process.env.NEXT_PUBLIC_SHOW_KB === "1";

  return (
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
          <Link href="/" aria-current={onScan ? "page" : undefined} className={linkClass(onScan)} aria-label="Scan artwork">
            Scan
          </Link>
          <Link href="/examples" aria-current={onExamples ? "page" : undefined} className={linkClass(onExamples)} aria-label="View examples">
            Examples
          </Link>
          {showKb && (
            <Link href="/kb" aria-current={onKb ? "page" : undefined} className={linkClass(onKb)} aria-label="Knowledge base input">
              KB
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
