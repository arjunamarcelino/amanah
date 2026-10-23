import Image from "next/image";
import Link from "next/link";

// App footer, mirroring the landing site's footer (wordmark + tagline + copyright) with a
// small row of in-app links added. Rendered by the (main) layout, so it sits under every
// donor-facing page.
const LINKS = [
  { href: "/", label: "Discover" },
  { href: "/ledger", label: "Ledger" },
  { href: "/mint", label: "Mint Test Tokens" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-[38rem]">
          <Image
            src="/amanah-logo.png"
            alt="Amanah"
            width={267}
            height={100}
            className="h-7 w-auto"
          />
          <p className="mt-3 text-sm text-muted-foreground">
            Give once. Protect many. Lose nothing to the middle.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-foreground-soft transition-colors hover:text-primary"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="mx-auto mt-8 max-w-6xl px-4 sm:px-6">
        <p className="text-xs text-muted-foreground">© 2026 Amanah · Live on Base Sepolia</p>
      </div>
    </footer>
  );
}
