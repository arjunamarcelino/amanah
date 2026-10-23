"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@amanah/ui/button";
import { cn } from "@amanah/ui/lib/utils";
import {
  leftMenus,
  rightMenus,
  headerLinks,
  type MegaMenu,
  type NavItem,
} from "@/lib/nav";

/**
 * GoFundMe-style marketing header: left nav (Search, Donate▾, Fundraise▾), a centered
 * brand lockup, and right nav (About▾, Sign in, Start a campaign). The three ▾ items open
 * hover/focus mega-menus on desktop; on touch/mobile a hamburger opens an accordion drawer.
 *
 * Client component: it owns the open-menu state (hover + keyboard) and the mobile drawer.
 */
export function SiteHeader() {
  // Only one desktop mega-menu is open at a time (keyed by menu.label).
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Escape closes whatever is open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto grid h-16 max-w-[75rem] grid-cols-[1fr_auto_1fr] items-center px-[clamp(1.25rem,5vw,3rem)] md:h-[4.75rem]">
        {/* ── Left: desktop nav / mobile hamburger ──────────────────────────── */}
        <div className="flex items-center justify-self-start">
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="-ml-2 inline-flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted md:hidden"
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>

          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            <a href={headerLinks.search} className={triggerClass(false)}>
              <SearchIcon />
              <span>Search</span>
            </a>
            {leftMenus.map((menu) => (
              <DesktopMenu
                key={menu.label}
                menu={menu}
                align="left"
                open={openMenu === menu.label}
                onOpen={() => setOpenMenu(menu.label)}
                onClose={() => setOpenMenu((cur) => (cur === menu.label ? null : cur))}
              />
            ))}
          </nav>
        </div>

        {/* ── Center: brand lockup ──────────────────────────────────────────── */}
        <Link
          href="/"
          aria-label="Amanah — home"
          className="justify-self-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setMobileOpen(false)}
        >
          <Wordmark className="h-8 w-auto md:h-10" />
        </Link>

        {/* ── Right: desktop nav / mobile CTA ───────────────────────────────── */}
        <div className="flex items-center gap-2 justify-self-end">
          <nav aria-label="Secondary" className="hidden items-center gap-1 md:flex">
            {rightMenus.map((menu) => (
              <DesktopMenu
                key={menu.label}
                menu={menu}
                align="right"
                open={openMenu === menu.label}
                onOpen={() => setOpenMenu(menu.label)}
                onClose={() => setOpenMenu((cur) => (cur === menu.label ? null : cur))}
              />
            ))}
            <a href={headerLinks.signIn} className={triggerClass(false)}>
              Sign In
            </a>
          </nav>

          <Button
            asChild
            variant="outline"
            className="rounded-full border-foreground/20 font-semibold shadow-none hover:border-foreground/30"
          >
            <a href={headerLinks.startCampaign}>Start a Campaign</a>
          </Button>
        </div>
      </div>

      {/* ── Mobile drawer ───────────────────────────────────────────────────── */}
      {mobileOpen ? <MobileDrawer onNavigate={() => setMobileOpen(false)} /> : null}
    </header>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Desktop mega-menu
   ──────────────────────────────────────────────────────────────────────────── */

function DesktopMenu({
  menu,
  align,
  open,
  onOpen,
  onClose,
}: {
  menu: MegaMenu;
  align: "left" | "right";
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const panelId = `menu-${menu.label.toLowerCase()}`;
  return (
    <div
      className="relative"
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
      onFocus={onOpen}
      onBlur={(e) => {
        // Close only when focus leaves the whole menu subtree (not when moving between links).
        if (!e.currentTarget.contains(e.relatedTarget as Node)) onClose();
      }}
    >
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? onClose() : onOpen())}
        className={triggerClass(open)}
      >
        <span>{menu.label}</span>
        <Chevron open={open} />
      </button>

      {open ? (
        // pt-3 bridges the gap so the pointer can travel from trigger to panel without closing.
        <div
          id={panelId}
          className={cn(
            "absolute top-full z-30 pt-3",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          <MegaPanel menu={menu} />
        </div>
      ) : null}
    </div>
  );
}

function MegaPanel({
  menu,
  onNavigate,
}: {
  menu: MegaMenu;
  onNavigate?: () => void;
}) {
  const withDescription = menu.icon !== "about";
  return (
    <div className="w-[min(40rem,calc(100vw-2rem))] rounded-2xl border border-border/70 bg-popover p-6 shadow-xl shadow-foreground/5">
      <div className="flex items-center gap-3 border-b border-border/60 pb-4">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
          <MenuIconGlyph icon={menu.icon} />
        </span>
        <p className="font-serif text-lg font-medium tracking-tight text-foreground">
          {menu.heading}
        </p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-5">
        {menu.items.map((item) => (
          <HeaderLink
            key={item.label}
            item={item}
            showDescription={withDescription}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Mobile drawer
   ──────────────────────────────────────────────────────────────────────────── */

function MobileDrawer({ onNavigate }: { onNavigate: () => void }) {
  const [section, setSection] = useState<string | null>(null);
  const menus = [...leftMenus, ...rightMenus];

  return (
    <div className="border-t border-border/70 bg-background md:hidden">
      <nav
        aria-label="Mobile"
        className="mx-auto flex max-w-[75rem] flex-col gap-1 px-[clamp(1.25rem,5vw,3rem)] py-4"
      >
        <a
          href={headerLinks.search}
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-lg px-2 py-3 text-base font-medium text-foreground hover:bg-muted"
        >
          <SearchIcon />
          Search
        </a>

        {menus.map((menu) => {
          const open = section === menu.label;
          return (
            <div key={menu.label} className="border-t border-border/50 first:border-t-0">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setSection(open ? null : menu.label)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-3 text-base font-medium text-foreground hover:bg-muted"
              >
                <span>{menu.label}</span>
                <Chevron open={open} />
              </button>
              {open ? (
                <div className="flex flex-col gap-1 pb-2 pl-2">
                  {menu.items.map((item) => (
                    <HeaderLink
                      key={item.label}
                      item={item}
                      showDescription={false}
                      onNavigate={onNavigate}
                      className="rounded-lg px-3 py-2.5 hover:bg-muted"
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}

        <a
          href={headerLinks.signIn}
          onClick={onNavigate}
          className="mt-2 border-t border-border/50 px-2 py-3 text-base font-medium text-foreground hover:bg-muted"
        >
          Sign In
        </a>
        <Button
          asChild
          variant="outline"
          className="mt-2 w-full rounded-full border-foreground/20 font-semibold shadow-none"
        >
          <a href={headerLinks.startCampaign} onClick={onNavigate}>
            Start a Campaign
          </a>
        </Button>
      </nav>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Shared link + styling
   ──────────────────────────────────────────────────────────────────────────── */

function HeaderLink({
  item,
  showDescription,
  onNavigate,
  className,
}: {
  item: NavItem;
  showDescription: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const body = (
    <>
      <span className="block text-[0.95rem] font-medium text-foreground transition-colors group-hover/link:text-primary">
        {item.label}
      </span>
      {showDescription && item.description ? (
        <span className="mt-0.5 block text-sm text-muted-foreground">{item.description}</span>
      ) : null}
    </>
  );
  const classes = cn("group/link block", className);

  // External = dApp; use a plain anchor. Internal = hash-scroll on this page; next/link.
  return item.external ? (
    <a href={item.href} onClick={onNavigate} className={classes}>
      {body}
    </a>
  ) : (
    <Link href={item.href} onClick={onNavigate} className={classes}>
      {body}
    </Link>
  );
}

function triggerClass(active: boolean) {
  return cn(
    "inline-flex items-center gap-1 rounded-full px-3 py-2 text-[0.95rem] font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active && "bg-muted",
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Inline icons (no icon dependency in the landing app)
   ──────────────────────────────────────────────────────────────────────────── */

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-[1.15rem]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/** Panel-header glyphs — heart-in-hand (Donate), megaphone (Fundraise), info (About). */
function MenuIconGlyph({ icon }: { icon: MegaMenu["icon"] }) {
  const common = {
    "aria-hidden": true,
    viewBox: "0 0 24 24",
    className: "size-5",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (icon === "donate") {
    return (
      <svg {...common}>
        <path d="M3 14a2 2 0 0 1 2-2h3l2.3 1.5a2 2 0 0 0 2.2 0L17 10a1.6 1.6 0 1 1 2 2.5l-5 4a3 3 0 0 1-3 .5l-3-1" />
        <path d="M14.5 3.5a2.1 2.1 0 0 0-2.5.4l-.5.5-.5-.5A2.1 2.1 0 1 0 8 7.3l3.5 3.2 3.5-3.2a2.1 2.1 0 0 0-.5-3.8Z" />
      </svg>
    );
  }
  if (icon === "fundraise") {
    return (
      <svg {...common}>
        <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z" />
        <path d="M15.5 8.5a3 3 0 0 1 0 7" />
        <path d="M18 5.5a7 7 0 0 1 0 13" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
}
