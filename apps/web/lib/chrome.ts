// Single source of truth for per-route chrome: what the header's left slot shows, whether the
// footer renders, and whether the route mounts the wallet (so the header suppresses "Sign in"
// and the page shows its own account control). SiteHeader and SiteFooter both derive from
// `chromeFor` — route knowledge lives here, not scattered across components.

export type ChromeLeft =
  | { kind: "search" }
  | { kind: "back"; href: string; label: string }
  | { kind: "none" };

export type Chrome = {
  left: ChromeLeft;
  /** Render the shared footer? Hidden on focused flows (mint/donate). */
  footer: boolean;
  /** Wallet route: mounts WalletProviders in-page; header drops its "Sign in" link. */
  wallet: boolean;
};

const BACK_TO_CAMPAIGNS: ChromeLeft = { kind: "back", href: "/", label: "Back to campaigns" };

export function chromeFor(pathname: string | null | undefined): Chrome {
  const p = pathname ?? "/";
  // /donate/<id> → back to that campaign's detail; focused; wallet.
  if (p === "/donate" || p.startsWith("/donate/")) {
    const id = p.split("/")[2] ?? "";
    return { left: { kind: "back", href: `/f/${id}`, label: "Fundraiser" }, footer: false, wallet: true };
  }
  // /mint → back to discover; focused; wallet.
  if (p === "/mint" || p.startsWith("/mint/")) {
    return { left: BACK_TO_CAMPAIGNS, footer: false, wallet: true };
  }
  // detail + ledger → back to discover; footer kept; no wallet.
  if (p.startsWith("/f/") || p === "/ledger" || p.startsWith("/ledger/")) {
    return { left: BACK_TO_CAMPAIGNS, footer: true, wallet: false };
  }
  // discover + anything else → search.
  return { left: { kind: "search" }, footer: true, wallet: false };
}
