"use client";

import { type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSearch } from "@/lib/search";
import { WalletMenu } from "@/components/WalletMenu";

// Shared chrome for the donor app (mounted by the (main) layout). Mirrors the landing
// header's language but stripped down to three slots: Search (left), brand (center), and the
// auth/wallet control (right). No mega-menus — this is the app, not the marketing site.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-6 md:h-[4.5rem]">
        {/* ── Left: search ──────────────────────────────────────────────────── */}
        <div className="justify-self-start">
          <SearchBox />
        </div>

        {/* ── Center: brand ─────────────────────────────────────────────────── */}
        <Link
          href="/"
          aria-label="Amanah — discover campaigns"
          className="justify-self-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Image
            src="/amanah-logo.png"
            alt="Amanah"
            width={267}
            height={100}
            priority
            className="h-7 w-auto md:h-8"
          />
        </Link>

        {/* ── Right: wallet / sign in ───────────────────────────────────────── */}
        <div className="justify-self-end">
          <WalletMenu />
        </div>
      </div>
    </header>
  );
}

function SearchBox() {
  const { query, setQuery } = useSearch();
  const router = useRouter();
  const pathname = usePathname();

  // Enter routes to Discover so results always land somewhere they render; on Discover the
  // grid is already filtering live as the user types.
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pathname !== "/") router.push("/");
  }

  return (
    <form role="search" onSubmit={onSubmit} className="relative w-full max-w-[9rem] sm:max-w-xs">
      <SearchIcon />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search"
        aria-label="Search campaigns"
        className="h-10 w-full rounded-full border border-input bg-background pl-9 pr-3 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </form>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="pointer-events-none absolute left-3 top-1/2 size-[1.1rem] -translate-y-1/2 text-muted-foreground"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
