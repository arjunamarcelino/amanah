---
title: "Privy + wagmi embedded wallet in Next.js 15 App Router: build, prerender, and bundling"
date: 2026-10-22
category: integration-issues
problem_type: build_failure
component: apps/web
severity: blocking
status: resolved
symptoms:
  - "`next build` fails: `Module not found: Can't resolve '@x402/evm'` (then '@x402/svm/exact/client', '@x402/core/client' …) traced through @privy-io/wagmi → @wagmi/connectors → @base-org/account → @coinbase/cdp-sdk"
  - "`next build` warning: `Can't resolve '@react-native-async-storage/async-storage'` from @metamask/sdk"
  - "`next build` fails prerendering `/_not-found`: `Error: Cannot initialize the Privy provider with an invalid Privy app ID` when NEXT_PUBLIC_PRIVY_APP_ID is unset at build time"
  - "A wallet route (client component using wagmi hooks) crashes the export with `useConfig must be used within WagmiProvider` even with `export const dynamic = 'force-dynamic'`"
  - "Turbopack dev/build throws `TypeError: s is not iterable` from @privy-io/wagmi"
  - "Full ~500 kB wallet SDK risks loading on routes that never use a wallet"
tags: [nextjs, next15, app-router, privy, wagmi, viem, embedded-wallet, webpack, ignoreplugin, prerender, route-group, turbopack, base-sepolia, csp, bundle-size]
related:
  - PR: https://github.com/arjunamarcelino/amanah/pull/9
  - commit-providers: 1b26d16
  - commit-route-group: 5566b59
  - commit-headers: 8d4e1a8
  - commit-deps: 8ce0e71
  - files:
    - apps/web/next.config.mjs
    - apps/web/lib/wallet-providers.tsx
    - apps/web/lib/query-provider.tsx
    - apps/web/app/(wallet)/layout.tsx
    - apps/web/app/layout.tsx
---

# Privy + wagmi embedded wallet in Next.js 15 App Router

Wiring `@privy-io/react-auth` v3 + `@privy-io/wagmi` v4 + `wagmi` v2 + `viem` into a Next.js 15
App Router app (`apps/web`, embedded-EOA donor flow on Base Sepolia) hits a predictable
sequence of `next build` failures that have nothing to do with your code — they come from the
wallet-connector dependency graph and from Privy's provider initializing during static
prerender. This is the playbook, in the order you'll hit them.

Verified versions (Oct 2026): `@privy-io/react-auth@3.51`, `@privy-io/wagmi@4.0`, `wagmi@^2`,
`viem@2.57.x` (from the pnpm `catalog:`), `@tanstack/react-query@5`, Next `15.1.4`.

## 1. Wallet connectors statically import optional modules webpack can't resolve

`@privy-io/wagmi` re-exports the full `@wagmi/connectors` barrel (Coinbase/Base/MetaMask), which
**eagerly** imports optional payment/storage modules even though the embedded-wallet flow never
uses them. The build dies one module at a time:

```
Module not found: Can't resolve '@x402/evm'
  … @coinbase/cdp-sdk → @base-org/account → @wagmi/connectors/baseAccount → @privy-io/wagmi → ./lib/privy.tsx
```

Fixing `@x402/evm` alone just surfaces `@x402/svm/exact/client`, then `@x402/core/client` — don't
play whack-a-mole with per-package `resolve.alias`. Stub the **whole `@x402` scope** (and the
MetaMask `async-storage` optional dep) with one `IgnorePlugin`, plus the classic wagmi/WalletConnect
node-only externals:

```js
// apps/web/next.config.mjs
webpack: (config, { webpack }) => {
  config.plugins.push(
    new webpack.IgnorePlugin({ resourceRegExp: /^@x402\/|^@react-native-async-storage\// }),
  );
  config.externals.push("pino-pretty", "lokijs", "encoding");
  return config;
},
```

**Why it's safe:** the flow is embedded-wallet-only (no injected/Coinbase connector configured;
`useWallets().find(w => w.walletClientType === 'privy')`), so the x402 payment path is never
instantiated. Add a comment saying exactly that — if someone later adds a Coinbase/injected
connector, the stub would resolve to an empty module and fail opaquely.

## 2. PrivyProvider crashes static prerender when the app id is missing at build

`NEXT_PUBLIC_*` is inlined **at build time**. A CI build without `NEXT_PUBLIC_PRIVY_APP_ID`
inlines `""`, and `PrivyProvider` throws during the static generation of `/_not-found` (and any
route it wraps):

```
Error occurred prerendering page "/_not-found"
Error: Cannot initialize the Privy provider with an invalid Privy app ID
```

`export const dynamic = "force-dynamic"` on the wallet pages does **not** save you — Next still
prerenders the client-component shell, and a wallet hook then throws
`useConfig must be used within WagmiProvider`.

**Do not** paper over it by rendering a degraded tree that drops `PrivyProvider` but keeps the
children — every wallet page's first hook is `usePrivy()`, which throws without `PrivyProvider`,
so the pages white-screen while the home page "works" (a silent-misconfig trap). Instead, **fail
loud**: render a visible message and do not mount the children that call wallet hooks.

```tsx
// apps/web/lib/wallet-providers.tsx  ("use client")
export function WalletProviders({ children }: { children: ReactNode }) {
  if (!ENV.privyAppId) return <WalletMisconfigured />; // visible, no usePrivy() below it
  return (
    <PrivyProvider appId={ENV.privyAppId} config={privyConfig}>
      <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
    </PrivyProvider>
  );
}
```

## 3. The route-group pattern: QueryClient at root, Privy/wagmi only on wallet routes

Don't put the wallet providers in the **root** layout. Two reasons: (a) it mounts Privy on every
route (including a wallet-free browse page) — with the degraded branch above it also means the
root layout decides wallet availability for the whole app; (b) it's cleaner to let only the
routes that need wallets pull them in.

```
app/
  layout.tsx            → <QueryProvider> only (react-query; browse needs it)
  page.tsx              → browse (react-query, no wallet)
  (wallet)/
    layout.tsx          → <WalletProviders> (Privy → wagmi); URLs unchanged
    mint/page.tsx
    donate/[campaignId]/page.tsx
```

Split the providers into **separate files** (`lib/query-provider.tsx`, `lib/wallet-providers.tsx`)
so importing the root `QueryProvider` doesn't transitively pull the wallet SDK into the browse
bundle (module imports are eager). Provider nesting ends up `QueryClient (root) → Privy → wagmi`
(wagmi innermost) — correct, because `@privy-io/wagmi`'s `WagmiProvider` only needs both contexts
*above* it, not a specific Privy-vs-QueryClient order. Create the `QueryClient` once via
`useState(() => new QueryClient(...))`, never at module scope.

## 4. Keep dev/build on webpack — Turbopack breaks @privy-io/wagmi

`next dev --turbopack` / `--turbopack` builds throw `TypeError: s is not iterable` from
`@privy-io/wagmi` (vercel/next.js#81724). Leave the scripts as bare `next dev` / `next build`
(webpack). Bonus: the §1 webpack config only applies under webpack anyway.

## 5. Config details that matter

- Import `createConfig` **and** `WagmiProvider` from `@privy-io/wagmi` (NOT from `wagmi`) — the
  Privy versions sync the embedded connector + `reconnectOnMount`.
- Embedded EOA config is **nested** in v3: `embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } }` (the flat `{ createOnLogin }` is pre-v3 and fails to type-check).
- `defaultChain` must be included in `supportedChains` or Privy throws.
- `ConnectedWallet.chainId` is **CAIP-2** (`"eip155:84532"`), not a number — parse before comparing to `CHAIN_ID`.

## Related gotchas surfaced in the same work

- **`turbo run build typecheck` races on `.next/types`.** A Next app's `typecheck` (`tsc --noEmit`)
  includes `.next/types/**`, which `next build` regenerates. Running both in **one** turbo
  invocation fails with `TS6053: File '.next/types/.../page.ts' not found`. Run `typecheck`
  **separately** from `build` (or after it). `build lint test` together is race-free.
- **vitest doesn't read tsconfig `paths`.** The `@/*` alias resolves in `tsc`/Next but not in
  vitest — add `resolve: { alias: { "@": <root> } }` to `vitest.config.ts` or tests fail with
  `Failed to load url @/lib/...`.
- **`viem` catalog pin.** Privy's peer wants an exact `viem@2.57.x`; the repo's `catalog: ^2.21.0`
  resolves to a compatible 2.57.x. The peer-mismatch **warning** is cosmetic — don't pin around
  it; just confirm one physical install (`pnpm why viem` for the app's direct dep).

## Prevention / checklist for the next wallet-enabled Next app in this repo

- [ ] `IgnorePlugin(/^@x402\/|^@react-native-async-storage\//)` + externals in `next.config.mjs`; comment the embedded-only assumption.
- [ ] Providers split: `QueryProvider` (root) vs `WalletProviders` (a `(wallet)` route group); separate files so the browse bundle stays wallet-free.
- [ ] `WalletProviders` fails loud (visible message) when `NEXT_PUBLIC_PRIVY_APP_ID` is missing — never a silent degraded tree that still renders `usePrivy()` children.
- [ ] No `--turbopack` in dev/build scripts.
- [ ] `embeddedWallets.ethereum.createOnLogin`; `defaultChain ∈ supportedChains`; parse CAIP-2 chainId.
- [ ] Run `typecheck` separately from `build` in CI; add the `@/` alias to `vitest.config.ts`.

## Cross-references

- [Next.js 15 static export: fonts, metadata, headers](../build-errors/nextjs-static-export-fonts-metadata-and-headers.md) — sibling `apps/landing`; `next/font/local` + `NEXT_PUBLIC_*` build-time inlining apply here too.
- [CJS NestJS consuming ESM workspace package](../build-errors/cjs-nestjs-consuming-esm-workspace-package.md) — the same `viem`/`zod` single-install (`catalog:`) discipline.
- [Turbo monorepo CI: forge + ESLint flat config](../build-errors/turbo-monorepo-ci-forge-and-eslint-flat-config.md) — per-package build/lint/typecheck wiring.
