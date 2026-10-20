---
title: "Foundry invariant passes but tests the wrong property: a donate-only handler can't falsify poolValue == totalSupply"
date: 2026-10-20
category: test-failures
problem_type: test_quality
component: contracts
severity: silent
status: resolved
symptoms:
  - "Invariant suite is green (256 runs / 128k calls / 0 reverts) yet asserts a property the contract does not guarantee"
  - "assertEq(pool.poolValue(), pool.totalSupply()) passes, but a unit test proves a direct ERC20 transfer makes them diverge"
  - "An invariant comment literally says 'no drift (donate-only)' — scoping the assertion to the handler's blind spot"
  - "invariant_campaignTallySumsToSupply sums a hardcoded 3-element campaign array (the only ids the handler ever uses)"
tags: [foundry, invariant-testing, fuzzing, handler, erc4626, test-quality, solidity, false-positive]
related:
  - PR: https://github.com/arjunamarcelino/amanah/pull/2
  - review-doc: docs/reviews/pr-2-charitypool-donations.md (local-only)
  - commit-fix: 016ddbb
---

# Foundry invariant passes but tests the wrong property

## Problem

`CharityPool`'s stateful invariant suite was green — 256 runs, 128,000 calls, 0 reverts — and
included this assertion:

```solidity
// test/invariant/CharityPool.invariant.t.sol (before)
function invariant_poolValueConsistent() public view {
    assertEq(pool.poolValue(), pool.totalAssets());            // tautology: totalAssets() returns poolValue()
    assertEq(pool.poolValue(), pool.totalSupply(), "no drift (donate-only)");
}
```

A code review flagged that `poolValue() == totalSupply()` is **not a contract invariant**.
`poolValue()` is `base.balanceOf(address(this))`, which *anyone* can raise with a bare ERC20
`transfer` that never calls `donate` / `_mint` / the tally. The branch's own unit test
`test_DirectTransferDriftDoesNotMintOrTally` already proved it: after a direct transfer,
`poolValue() == 140e6` while `totalSupply() == 100e6`.

So the suite asserted a strictly-stronger-than-true equality, and passed only because it couldn't
generate the one scenario that breaks it.

## Root cause

**The handler's action set didn't include the falsifying action.** The invariant fuzzer only calls
functions the handler exposes. The handler offered `donateBase` and `donateSwap` — and nothing else —
so a raw inbound `transfer` (the only way to make `poolValue > totalSupply`) was unreachable. The
assertion was unconsciously written around that blind spot; the comment `"no drift (donate-only)"`
is the tell.

Two adjacent invariants were similarly hollow:

- `invariant_campaignTallySumsToSupply` summed a hardcoded `campaigns[0..2]` array — the only ids the
  handler ever used — so `Σ tally == totalSupply` was **tautological**, not a test of "sum over *all*
  campaign ids."
- `invariant_donorSharesAlwaysZero` checked the handler's own balance, but `_mint` always targets the
  pool, so the handler could never hold shares regardless of correctness — near-zero signal.

The contract itself was correct. The defect was entirely in the test: **a green invariant that
verifies a property weaker/different than it appears to.**

## Solution (commit `016ddbb`)

Fix the assertion to the *true* invariant, and give the handler the actions + entropy needed to
actually attack it.

### 1. Assert the real invariant (`>=`, solvency), drop the tautology

```solidity
// after
function invariant_poolSolvent() public view {
    assertGe(pool.poolValue(), pool.totalSupply(), "pool base covers minted principal");
}
```

`poolValue() >= totalSupply()` is what the contract guarantees: minted principal is always covered by
base held; raw transfers can push `poolValue` strictly *above* `totalSupply`, never below.

### 2. Add the falsifying action to the handler

```solidity
/// Raw ERC20 transfer of base into the pool — NOT via donate. Exercises drift.
function rawTransfer(uint256 amount) external {
    amount = bound(amount, 0, 1_000_000e6);
    usdc.mint(address(this), amount);
    usdc.transfer(address(pool), amount);
}
```

Register it alongside the donate actions:

```solidity
bytes4[] memory selectors = new bytes4[](3);
selectors[0] = CharityHandler.donateBase.selector;
selectors[1] = CharityHandler.donateSwap.selector;
selectors[2] = CharityHandler.rawTransfer.selector;
targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
```

### 3. Remove the tautologies with real entropy

- Donate from **distinct external actor addresses** (never the pool), so `donorSharesAlwaysZero`
  checks real donors: `address[4] actors; ... actor = actors[seed % 4];` then `vm.startPrank(actor)`.
- Use **arbitrary** campaign ids (`bytes32 id = bytes32(seed)`), and **ghost-track every id used**
  (`seenCampaigns` + a `_campaignSeen` mapping). The tally invariant then sums the real id set:

```solidity
function invariant_campaignTallySumsToSupply() public view {
    uint256 n = handler.seenCampaignsLength();
    uint256 sum;
    for (uint256 i = 0; i < n; i++) sum += pool.donatedByCampaign(handler.seenCampaigns(i));
    assertEq(sum, pool.totalSupply(), "campaign tallies sum to supply");
}
```

Keep handler actions bounded so `fail_on_revert = true` stays valid (e.g. `donateSwap` early-returns
when the adapter's base liquidity is 0 rather than reverting).

## Verification

```bash
forge test --mp 'test/invariant/*'
# CharityPoolInvariantTest invariants (runs: 256, calls: 128000, reverts: 0)
#   donateBase ~42.7k | donateSwap ~42.5k | rawTransfer ~42.8k   <- drift now exercised
```

The proof the original was a real bug: with `rawTransfer` in the action set, the old
`assertEq(poolValue, totalSupply)` now **fails** (drift occurs), while the new
`assertGe(poolValue, totalSupply)` holds. The suite now falsifies the wrong assertion and confirms the
right one.

## Prevention

- **A handler must expose every state-mutating path that touches the invariant's variables** — not
  just the "happy" entry points. For an ERC20-holding contract that includes a bare `transfer` *into*
  it, since `balanceOf(address(this))` is attacker-writable from outside your API.
- **Assert the invariant the contract actually guarantees, not the one that happens to hold under your
  handler.** For balance-vs-supply accounting that's almost always `>=` (solvency), not `==`.
- **Treat "donate-only" / "no drift" style comments on an invariant as a smell** — they usually mean
  the assertion was scoped to the handler's coverage gap.
- **Watch for tautological sums:** if an invariant sums exactly the fixed set of keys the handler is
  restricted to, it proves nothing. Ghost-track the real key set and sum that.
- **Make `donorSharesAlwaysZero`-type checks use distinct external actors**, or they assert something
  structurally impossible to violate.
- A **green invariant suite is necessary but not sufficient** — review each invariant for (a) is it the
  true property, and (b) can the handler even reach a counterexample.

## Related

- PR [#2](https://github.com/arjunamarcelino/amanah/pull/2) — CharityPool donations + firewall
- Fix commit `016ddbb`; found during the PR #2 multi-agent code review (local `docs/reviews/pr-2-charitypool-donations.md`, finding P2-1/P2-2)
- **Second-order follow-up:** [coverage guard false-passes — counting calls isn't counting work](./foundry-invariant-coverage-guard-counts-calls-not-work.md). After adding `rawTransfer`/ghost-tracking here, PR #3 added a call-count coverage guard that was itself a blind spot (early-returning actions increment the counter without doing work). The fix: assert *effective-work* ghosts, not `calls[selector] > 0`.
