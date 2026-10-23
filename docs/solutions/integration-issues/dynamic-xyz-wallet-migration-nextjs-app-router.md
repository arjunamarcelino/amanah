---
title: "Migrating the donor wallet from Privy to Dynamic.xyz (Next.js 15 App Router, wagmi kept)"
date: 2026-10-23
category: integration-issues
problem_type: migration
component: apps/web
severity: non-blocking
status: resolved
symptoms:
  - "Switching wallet infra from Privy to Dynamic.xyz without rewriting the tx/read/switch code"
  - "Need email/social + embedded wallets AND external wallets (MetaMask/WalletConnect) on Base Sepolia"
  - "Which parts are SDK code vs Dynamic Dashboard config"
tags: [dynamic, dynamic-labs, wallet, wagmi, nextjs, app-router, base-sepolia, embedded-wallet, external-wallet, migration, privy, csp]
related:
  - supersedes: docs/solutions/integration-issues/privy-wagmi-nextjs15-app-router-build-and-prerender.md
  - supersedes2: docs/solutions/integration-issues/privy-embedded-wallet-testnet-chain-config.md
  - files:
    - apps/web/lib/wallet-providers.tsx
    - apps/web/lib/wagmi.ts
    - apps/web/lib/hooks/useDonorWallet.ts
    - apps/web/components/LoginGate.tsx
    - apps/web/lib/env.ts
    - apps/web/next.config.mjs
---

# Migrating the donor wallet from Privy to Dynamic.xyz

`apps/web`'s donor flow moved from Privy (embedded-only) to Dynamic.xyz (email/social +
embedded **and** external wallets), targeting Base Sepolia (84532). The win: **keep every
wagmi call site unchanged** by bridging Dynamic into wagmi with `DynamicWagmiConnector`.

## Key decision: use the React SDK family + DynamicWagmiConnector

Dynamic ships two SDK families — do not mix them:
- **React SDK** `@dynamic-labs/*` (`DynamicContextProvider`, `DynamicWidget`, `DynamicWagmiConnector`) — keeps wagmi hooks working. **Use this.** All `@dynamic-labs/*` must be the same version (here `5.12.2`).
- Headless client SDK `@dynamic-labs-sdk/*` (`createDynamicClient`, `switchActiveNetwork`, …) — imperative, no wagmi bridge. Not used.

Packages: `@dynamic-labs/sdk-react-core`, `@dynamic-labs/ethereum` (`EthereumWalletConnectors` — covers email/social/embedded + external EVM), `@dynamic-labs/wagmi-connector`. Removed: `@privy-io/{react-auth,wagmi,chains}`.

## Provider tree (inverse nesting vs Privy)

Privy was `PrivyProvider → WagmiProvider(@privy-io/wagmi)`. Dynamic is:

```tsx
// apps/web/lib/wallet-providers.tsx (mounted only in the (wallet) route group)
<DynamicContextProvider
  theme="light"
  settings={{
    environmentId: ENV.dynamicEnvironmentId,
    walletConnectors: [EthereumWalletConnectors],
    overrides: { evmNetworks },          // pin Base Sepolia + custom RPC (Dynamic side)
  }}
>
  <WagmiProvider config={wagmiConfig}>   // stock `wagmi`, NOT @privy-io/wagmi
    <DynamicWagmiConnector>{children}</DynamicWagmiConnector>  // innermost
  </WagmiProvider>
</DynamicContextProvider>
```

`wagmiConfig` is a stock `createConfig({ chains: [baseSepolia], multiInjectedProviderDiscovery: false, transports })` — **no `connectors` array** (Dynamic injects them), and `multiInjectedProviderDiscovery: false` is **required** (Dynamic runs its own discovery). The root `QueryClientProvider` already wraps everything, so no nested one is needed.

Chain/RPC is set in **two** places that must agree: wagmi `transports` AND Dynamic
`overrides.evmNetworks` (array form replaces the dashboard network list). For the `evmNetworks`
entry, `networkId` MUST equal `chainId` and `nativeCurrency.decimals` MUST be 18.

## Hook mapping (wagmi stays, only lifecycle hooks change)

| Privy | Dynamic |
|---|---|
| `usePrivy().ready` | `useDynamicContext().sdkHasLoaded` |
| `usePrivy().authenticated` | `useIsLoggedIn()` |
| `usePrivy().login()` | `useDynamicContext().setShowAuthFlow(true)` |
| `usePrivy().logout()` | `useDynamicContext().handleLogOut()` |
| `useWallets()` embedded addr | wagmi `useAccount().address` (via DynamicWagmiConnector) |
| Privy CAIP-2 `chainId` + `caipToChainId` | wagmi `useAccount().chainId` (numeric — **CAIP helper deleted**) |
| `useBalance`, `useSwitchChain`, `useWriteContract`, `usePublicClient` | **unchanged** |

`useDonorWallet` keeps its exact `DonorWalletState` discriminated union; only its internals
changed. Because the address now comes from wagmi's active account, the flow transparently
supports **external** wallets, not just the embedded one. `LoginGate`'s unauthenticated arm
renders Dynamic's drop-in `<DynamicWidget/>`.

## Dashboard vs code (this is where it bites — same lesson as Privy)

Dynamic is **dashboard-first**. The public `environmentId` points at a project configured at
`app.dynamic.xyz`. These are Dashboard toggles the SDK cannot substitute:

- **Enable Base Sepolia / testnets** (often behind a "show testnets" switch) — the Privy analog that bit us before.
- **Embedded wallets → "Create on Sign up"** — if off, email/social users log in with **no wallet** and `primaryWallet` is null (the #1 gotcha).
- **Sign-in methods** — Email OTP + each social provider.
- **Allowed origins / CORS** for each deployment host.

Env var: `NEXT_PUBLIC_PRIVY_APP_ID` → `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID` (public; renamed
across env examples, docker-compose, and web.Dockerfile build args). A fail-loud guard renders
a "not configured" message if it's unset (never mount with an empty id).

## Next.js / bundling / CSP

- All Dynamic providers/hooks are client-only → keep them under the `"use client"` `WalletProviders` mounted from a server layout, in the `(wallet)` route group (preserves bundle isolation: `/console` and `/ledger` stay wallet-free).
- The webpack optional-module stubs from the Privy era **carried over unchanged** and the build passed first try: `IgnorePlugin(/^@x402\/|^@react-native-async-storage\//)` + `externals: ["pino-pretty","lokijs","encoding"]`. Dynamic's external-wallet connectors (WalletConnect/Coinbase/MetaMask) pull the same optional deps.
- **CSP** (Report-Only): `connect-src`/`frame-src` → `https://app.dynamicauth.com https://*.dynamicauth.com` (+ `wss:` for connect); `img-src 'self' data: blob: https://app.dynamic.xyz` (network/wallet icons). For enforcing mode, pass a nonce via `DynamicContextProvider` `cspNonce` instead of `'unsafe-inline'` styles.
- **Bundle cost:** `/donate` First Load JS grew ~498 kB (Privy embedded-only) → ~920 kB, because external-wallet connectors are heavier. Still isolated to `/donate` + `/mint`.

## Gas / funding on testnet

Dynamic's fiat onramp (`getCoinbaseBuyUrl`, headless client SDK) is **mainnet-only** — it won't
fund a Base Sepolia wallet. Keep the existing GasPrompt approach: show `address` + a faucet link.

## Verification

`tsc` clean, `next build` green (wallet routes build; console/ledger stay light), 55 web unit
tests pass. **Not runtime-tested end to end** — requires a real `environmentId` + the Dashboard
toggles above. Setup checklist: create a Dynamic project → enable EVM + Base Sepolia testnet →
enable embedded wallets + "create on sign up" → enable Email + social sign-in → add allowed
origins → set `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID`.

## Related

- Superseded Privy docs: [build/prerender](./privy-wagmi-nextjs15-app-router-build-and-prerender.md), [testnet chain config](./privy-embedded-wallet-testnet-chain-config.md)
- Dynamic docs: [Using Wagmi](https://www.dynamic.xyz/docs/react/reference/using-wagmi), [DynamicWagmiConnector](https://www.dynamic.xyz/docs/react/reference/providers/dynamicwagmiconnector), [Adding custom networks](https://www.dynamic.xyz/docs/react/chains/adding-custom-networks), [CSP](https://www.dynamic.xyz/docs/get-started/security/content-security-policy)
