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
  - "WalletConnect bundle weight can't be trimmed from EthereumWalletConnectors via config in v5"
  - "CSP blocks Coinbase/WalletConnect because only Dynamic's own domains were allowlisted"
tags: [dynamic, dynamic-labs, wallet, wagmi, nextjs, app-router, base-sepolia, embedded-wallet, external-wallet, walletconnect, coinbase, bundle-size, migration, privy, csp]
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
- **CSP** (Report-Only): Dynamic alone needs `*.dynamicauth.com` + `*.dynamic-static-assets.com`. **External wallets need more** — the migration's first CSP only had Dynamic's domains, which would silently break Coinbase/WalletConnect once enforced (invisible under Report-Only unless you actually connect an external wallet during that run). Full set:
  - `connect-src`: `https://*.dynamicauth.com wss://*.dynamicauth.com https://*.dynamic-static-assets.com` + Coinbase `https://cca-lite.coinbase.com https://chain-proxy.wallet.coinbase.com wss://www.walletlink.org` + WalletConnect `https://*.walletconnect.com https://*.walletconnect.org wss://relay.walletconnect.com wss://*.relay.walletconnect.org` + your api/rpc origins.
  - `frame-src`: `https://app.dynamicauth.com https://verify.walletconnect.com https://verify.walletconnect.org https://keys.coinbase.com` (last one only if the Coinbase Smart-Wallet popup is allowed; `coinbaseWalletPreference: 'eoaOnly'` avoids it).
  - `img-src`: `'self' data: blob: https://app.dynamic.xyz https://*.dynamic-static-assets.com`.
  - For **enforcing** mode: pass a nonce via `DynamicContextProvider` `cspNonce` and drop `'unsafe-inline'` for **both** script and style (style-only nonce buys little).
- **Bundle cost:** `/donate` First Load JS grew ~498 kB (Privy embedded-only) → ~920 kB. See the WalletConnect section below — most of it is **not trimmable via config** in v5.
- The webpack optional-module stubs from the Privy era carried over unchanged (build passed first try): `IgnorePlugin(/^@x402\/|^@react-native-async-storage\//)` + `externals: ["pino-pretty","lokijs","encoding"]`. Added `experimental.optimizePackageImports: ["@dynamic-labs/sdk-react-core","@dynamic-labs/ethereum","wagmi"]`.

## Bundle weight: WalletConnect can't be trimmed via config (Dynamic v5)

The +422 kB on the wallet routes is dominated by WalletConnect/Reown pulled through
`EthereumWalletConnectors` — and in v5 **there is no supported way to drop it** (verified against
installed `@dynamic-labs/ethereum@5.12.2` source):

- `@dynamic-labs/ethereum`'s barrel entry has a **top-level side-effect import** of
  `WalletConnectProvider` → static `import '@walletconnect/ethereum-provider'`, the package has
  **no `sideEffects:false`** and **no subpath exports**, and the injected base class chains into
  the WC fallback. So importing *anything* from the package pulls the WC providers into the static
  graph. Granular connector exports exist but don't help.
- `walletsFilter` is a **runtime UI filter** — hides WC from the modal but still ships the bytes.
- **Coinbase is independent** of WC (`@coinbase/wallet-sdk`, zero WC refs), and `@reown/appkit` is
  already a **lazy** `import()` chunk (not initial weight). The eager cost is the `@walletconnect/*`
  providers.

Options: **(a)** keep the full set (supported — what this repo does; weight is isolated to the
`(wallet)` routes), **(b)** an **unsupported** `next.config` hack
`config.resolve.alias['@walletconnect/ethereum-provider'] = false` — safe *in 5.12.2* because WC
code only runs on an actual WC connect (so don't set a WC `projectId` + filter it out), but it must
be re-smoke-tested after any `@dynamic-labs` bump, or **(c)** embedded-only (drops MetaMask/Coinbase
too). Decide deliberately; don't assume a dashboard toggle sheds the bytes.

## Post-migration review hardening

A multi-agent review surfaced several cheap correctness/robustness fixes worth doing up front:

- **Type the Dynamic network override:** `export const evmNetworks = [ … ] satisfies EvmNetwork[]`
  (`EvmNetwork` is re-exported from `@dynamic-labs/sdk-react-core`). A loose literal passed via a
  named variable skips excess-property checks — a `rpcUrl`/`rpcUrls` typo would compile and fail at
  runtime.
- **Guard the chain-id coupling:** hooks key off `CHAIN_ID` (`@amanah/shared`) while the wagmi
  config + `evmNetworks` hardcode `baseSepolia.id`. Add a zero-runtime `_Equal` mirror
  (`type _ChainIdMatches = _Expect<_Equal<typeof CHAIN_ID, typeof baseSepolia.id>>`) so divergence
  fails the build instead of silently breaking `useBalance`/`isBaseSepolia`.
- **SSR parity:** give the donor `wagmiConfig` `ssr: true` + an explicit `createStorage({ key: "wagmi" })`
  (mirroring the console config) to avoid hydration-mismatch warnings on SSR'd wallet routes.
- **Account/logout control:** `<DynamicWidget/>` renders the login button on the logged-out arm, but
  it **unmounts once a wallet is active** — so a logged-in donor has no disconnect/switch control. Add
  a small `WalletBar` (connected address + Disconnect, calling the hook's `logout`) in the `(wallet)`
  layout. This also consumes the otherwise-dead `logout` (and lets you drop the now-dead `login`,
  since DynamicWidget handles it).
- **Backend trust:** with external wallets, the client-supplied `donor` in a POST /donations is now
  *any* connected EOA — the backend should re-derive it from the on-chain event (chain-pinned writes
  already prevent fund misdirection; this is about the off-chain index's trust).

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
- Dynamic docs: [Using Wagmi](https://www.dynamic.xyz/docs/react/reference/using-wagmi), [DynamicWagmiConnector](https://www.dynamic.xyz/docs/react/reference/providers/dynamicwagmiconnector), [Adding custom networks](https://www.dynamic.xyz/docs/react/chains/adding-custom-networks), [CSP](https://www.dynamic.xyz/docs/get-started/security/content-security-policy), [v5 upgrade / connector bundling](https://www.dynamic.xyz/docs/react/reference/upgrade/v5)
- WalletConnect finding verified against installed `@dynamic-labs/ethereum@5.12.2` source (`src/index.js` side-effect import; no `sideEffects:false`); Coinbase/Reown CSP origins from [Reown CSP guidance](https://docs.reown.com/advanced/security/content-security-policy).
