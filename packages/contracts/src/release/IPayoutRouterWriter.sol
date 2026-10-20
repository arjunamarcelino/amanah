// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IPayoutRouterWriter
/// @notice The single pool->router push that binds a released tranche to its payout record. When
///         CharityPool parks a tranche in the router it stamps the intended beneficiary/amount under a
///         deterministic `payoutId`, so the router's later `recordAndPay` can only disburse what was
///         actually released (no "pay anyone any amount" authority).
/// @dev Keeping this as its own interface (not the router's full surface) preserves the pool/router
///      decoupling: the pool depends only on this writer seam, not on `PayoutRouter.sol`. The router
///      restricts `setPending` to the pool address.
interface IPayoutRouterWriter {
    /// @notice Record the intended payout for a tranche the pool is transferring into the router.
    /// @dev Caller MUST be the CharityPool. `payoutId` is derived deterministically by the pool
    ///      (campaignId + the per-campaign running release total) so it is unique and replay-proof.
    /// @param payoutId Deterministic id for this tranche's disbursement.
    /// @param campaignId The campaign the tranche belongs to (for on-chain reconciliation).
    /// @param beneficiary The vetted recipient organization the tranche is intended for.
    /// @param amount The base amount parked for this payout.
    function setPending(bytes32 payoutId, bytes32 campaignId, address beneficiary, uint256 amount) external;
}
