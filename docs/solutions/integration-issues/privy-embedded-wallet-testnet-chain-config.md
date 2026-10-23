---
title: "Privy embedded wallet stuck on the wrong chain: 'target chain (id: 84532 – undefined)' is a dashboard config gap, not SDK code"
date: 2026-10-23
category: integration-issues
problem_type: configuration
component: apps/web
severity: blocking
status: resolved
symptoms:
  - "Donate/mint tx fails: 'The current chain of the wallet (id: 137) does not match the target chain for the transaction (id: 84532 – undefined)'"
  - "The embedded wallet defaults to Polygon (137) even though the app targets Base Sepolia (84532)"
  - "The target chain name renders as 'undefined' — Privy's SDK doesn't recognize 84532 for this app"
  - "ChainGuard's 'Switch to Base Sepolia' either errors or can't move the embedded wallet"
  - "Symptom appears only after swapping in a freshly-created NEXT_PUBLIC_PRIVY_APP_ID"
tags: [privy, embedded-wallet, base-sepolia, testnet, chain-config, defaultChain, supportedChains, dashboard, wagmi, 137, 84532]
related:
  - PR: https://github.com/arjunamarcelino/amanah/pull/12
  - related-doc: docs/solutions/integration-issues/privy-wagmi-nextjs15-app-router-build-and-prerender.md
  - files:
    - apps/web/lib/wallet-providers.tsx
    - apps/web/lib/wagmi.ts
    - apps/web/components/ChainGuard.tsx
---

# Privy embedded wallet stuck on the wrong chain

> **Superseded:** `apps/web` migrated from Privy to Dynamic.xyz. See
> [`dynamic-xyz-wallet-migration-nextjs-app-router.md`](./dynamic-xyz-wallet-migration-nextjs-app-router.md).
> Kept for historical reference — the dashboard-vs-code chain-config lesson below applies
> identically to Dynamic (enable Base Sepolia / testnets in the Dynamic dashboard).

The donor flow (`apps/web`, Privy embedded EOA on Base Sepolia) threw at transaction time:

```
The current chain of the wallet (id: 137) does not match the target chain
for the transaction (id: 84532 – undefined)
```

`137` is Polygon; `84532` is Base Sepolia. The embedded wallet had been provisioned on
Polygon and the app couldn't move it to Base Sepolia. The `– undefined` is the key tell:
it's the **chain name**, and it's undefined because Privy's backend for this app doesn't
recognize 84532 at all.

## Root cause

**The SDK chain config is necessary but NOT sufficient — the chain must also be enabled in
the Privy Dashboard for the app.** The client config was already correct:

```tsx
// apps/web/lib/wallet-providers.tsx — correct, not the problem
const privyConfig: PrivyClientConfig = {
  embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
  defaultChain: baseSepoliaOverride,          // viem baseSepolia (id 84532) + RPC override
  supportedChains: [baseSepoliaOverride],
  // ...
};
```

Per Privy's docs, `supportedChains`/`defaultChain` are a client-side guardrail. But the
**app's allowed networks live in the Privy Dashboard**, and **testnets are not enabled by
default** — a freshly-created app ships with mainnets (Polygon/Ethereum/Base). When the
dashboard doesn't allow a chain, the embedded wallet is provisioned on the dashboard default
(Polygon 137) and the SDK can't switch it to a chain the backend doesn't know — so 84532's
name resolves to `undefined`.

This is why it only surfaced after swapping in a new `NEXT_PUBLIC_PRIVY_APP_ID`: the code was
unchanged; the new app's dashboard simply didn't have Base Sepolia enabled.

## Solution

**No code change.** Fix it in the Privy Dashboard for the app id in `NEXT_PUBLIC_PRIVY_APP_ID`:

1. **dashboard.privy.io** → select the app.
2. **Settings → Networks/Chains** → toggle **"Show testnets"**, then enable **Base Sepolia
   (84532)**. (Optionally remove Polygon or set Base Sepolia as the default.)
3. **Settings → Login methods** → confirm the methods the code requests are enabled
   (here: email, Google, Twitter).
4. Save, then **log out and log back in** in the app so the embedded wallet re-provisions /
   reconnects on Base Sepolia. `ChainGuard`'s switch then works instead of erroring.

If Base Sepolia *was* already enabled, the wallet is a stale one created on Polygon before the
config — logging out and back in (fresh provision) is the fix.

## How to tell this apart from a code bug

- The chain id in the error (`84532`) is correct but its **name is `undefined`** → the SDK/app
  doesn't know the chain → **dashboard**, not code.
- The wallet sits on a chain that **isn't in your `supportedChains`** (here 137) → the config
  isn't the thing in effect → **dashboard default is overriding**.
- Your `defaultChain`/`supportedChains` already name the target chain (verify in
  `wallet-providers.tsx`) → stop editing code; check the dashboard.

## Prevention

- **Enabling a testnet in the Privy Dashboard is a required setup step, not optional.** Treat
  "new Privy app id" as "re-enable Base Sepolia + testnets + login methods in the dashboard."
  Record it next to `NEXT_PUBLIC_PRIVY_APP_ID` in the env docs.
- **`defaultChain`/`supportedChains` in code are a guardrail, not the source of truth** for which
  chains the embedded wallet may use — the dashboard is. Both must agree.
- **Use viem chains as-is.** `addRpcUrlOverrideToChain(baseSepolia, rpc)` keeps the id/name; the
  `undefined` name here was the backend not knowing the chain, not a malformed chain object.
- **A wallet on a chain outside `supportedChains` is the signature** of a dashboard/default
  mismatch — don't chase it in the SDK.

## Related

- Build/prerender/bundling side of the same integration:
  [`privy-wagmi-nextjs15-app-router-build-and-prerender.md`](./privy-wagmi-nextjs15-app-router-build-and-prerender.md)
- PR [#12](https://github.com/arjunamarcelino/amanah/pull/12) (surfaced during local review of the donor flow)
