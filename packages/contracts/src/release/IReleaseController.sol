// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IReleaseController
/// @notice The release-condition seam CharityPool reads to gate a staged payout. A campaign's funds
///         become releasable once its condition is met (a PARAMETRIC trigger fired, or a MILESTONE
///         approved); the controller records WHEN that happened so the pool can enforce its T+N delay.
/// @dev Minimal on purpose — the pool knows only a boolean + a timestamp and nothing about HOW the
///      condition was met. A production deployment can swap the manual MVP trigger for an oracle/multisig
///      behind this same interface (e.g. grant a future TRIGGER_ROLE to a Chainlink consumer) without any
///      pool change. The `ReleaseType` enum is shared vocabulary for implementers; the pool never reads it.
interface IReleaseController {
    /// @notice The kind of condition that releases a campaign.
    /// @dev PARAMETRIC = an external data trigger (e.g. a disaster index); MILESTONE = an explicit approval
    ///      (e.g. education/medical/waqf progress). Both end in the same releasable state.
    enum ReleaseType {
        PARAMETRIC,
        MILESTONE
    }

    /// @notice True once `campaignId`'s release condition has been met (and not revoked).
    /// @param campaignId The campaign to query.
    /// @return releasable Whether CharityPool may release tranches for this campaign.
    function canRelease(bytes32 campaignId) external view returns (bool releasable);

    /// @notice The block timestamp at which `campaignId`'s condition was met; `0` if never (or revoked).
    /// @dev The origin of the pool's staged-payout clock: a release requires
    ///      `block.timestamp >= activatedAt(id) + releaseDelay`. Write-once per activation (re-firing is
    ///      rejected), so the clock cannot be reset out from under an in-flight tranche.
    /// @param campaignId The campaign to query.
    /// @return at The activation timestamp, or 0 if not currently active.
    function activatedAt(bytes32 campaignId) external view returns (uint256 at);
}
