import { DEFAULT_RPC_URL } from "@amanah/shared";

// Public env accessors. Next inlines NEXT_PUBLIC_* ONLY on static member access —
// each var is referenced by its literal name below (never process.env[dynamic]).
//
// SECURITY: this bundle ships to the browser. Only NEXT_PUBLIC_* values are read
// here — never a *_SECRET, signer, or deployer key. Do not add one.
//
// Values are read without throwing at import time (so `next build` succeeds without
// a populated .env). A missing apiUrl/privyAppId surfaces at runtime: Privy errors
// in the browser, and api calls fail non-fatally (see lib/api.ts).
export const ENV = {
  /** API base (no trailing slash, no /api prefix). */
  apiUrl: (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, ""),
  /** Privy app id — a PUBLIC identifier, not a secret. */
  privyAppId: process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "",
  /** Base Sepolia RPC; falls back to the public default. TLS only. */
  rpcUrl: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || DEFAULT_RPC_URL,
} as const;
