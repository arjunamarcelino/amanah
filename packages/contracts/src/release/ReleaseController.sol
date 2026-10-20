// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IReleaseController} from "./IReleaseController.sol";

/// @title ReleaseController
/// @notice Records, per charity campaign, a release condition and WHEN it was met, so CharityPool can
///         gate staged payouts. Supports two generalized conditions: a PARAMETRIC trigger (e.g. a
///         disaster index) fired via `fire`, and a MILESTONE (education/medical/waqf progress) approved
///         via `approveMilestone`. Both flip the campaign to releasable and stamp `activatedAt`.
/// @dev Owner-gated MVP: the owner stands in for the production trigger source. A real deployment can
///      swap the manual trigger for a parametric oracle (PAGASA/BMKG/hydro-met) or a charity/multisig
///      approval behind the same `IReleaseController` seam — ideally by granting a dedicated role rather
///      than the single owner. `activatedAt` is write-once per activation (`fire`/`approveMilestone`
///      reject an already-active campaign), so the pool's T+N clock cannot be reset by re-firing.
contract ReleaseController is IReleaseController, Ownable2Step {
    /// @notice Per-campaign condition record. Packs into ONE storage slot (1 + 1 + 1 + 8 = 11 bytes):
    ///         register costs one zero->nonzero SSTORE and fire/approve mutate the same warm slot.
    /// @dev `activatedAt` as `uint64` is good past year 2500; `canRelease`/`activatedAt` widen it back to
    ///      the interface's `uint256`. Kept behind explicit getters because the struct-mapping auto-getter
    ///      returns a tuple and would not satisfy the interface signatures.
    struct Campaign {
        ReleaseType releaseType;
        bool registered;
        bool active;
        uint64 activatedAt;
    }

    /// @notice Condition record per campaign id. Read via `canRelease`/`activatedAt`; `campaignId == 0`
    ///         is rejected at registration (it is the pool's general/unattributed fund).
    mapping(bytes32 campaignId => Campaign campaign) internal _campaigns;

    /// @notice Thrown when registering a campaign id that is already registered.
    error AlreadyRegistered(bytes32 campaignId);

    /// @notice Thrown when firing/approving/revoking a campaign that was never registered.
    error NotRegistered(bytes32 campaignId);

    /// @notice Thrown when the trigger kind does not match the campaign's registered `ReleaseType`
    ///         (e.g. `fire` on a MILESTONE campaign, or `approveMilestone` on a PARAMETRIC one).
    error WrongReleaseType(bytes32 campaignId);

    /// @notice Thrown when firing/approving a campaign that is already active (would reset the T+N clock).
    error AlreadyActive(bytes32 campaignId);

    /// @notice Thrown when registering `campaignId == 0` (the pool's general fund is not individually releasable).
    error ZeroId();

    /// @notice Thrown by `renounceOwnership` — a custody-gating contract must always retain an owner.
    error OwnershipCannotBeRenounced();

    /// @notice Emitted when a campaign is registered with its release condition kind.
    event CampaignRegistered(bytes32 indexed campaignId, ReleaseType releaseType);

    /// @notice Emitted when a PARAMETRIC trigger fires. `detail` is a free-form human/oracle note.
    event TriggerFired(bytes32 indexed campaignId, string detail);

    /// @notice Emitted when a MILESTONE is approved. `detail` is a free-form human/multisig note.
    event MilestoneApproved(bytes32 indexed campaignId, string detail);

    /// @notice Emitted when an erroneous/false-positive activation is revoked back to non-releasable.
    event TriggerRevoked(bytes32 indexed campaignId);

    /// @param initialOwner The initial owner/custodian (the trigger authority for this MVP).
    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Register a campaign with the release condition it will use.
    /// @dev Rejects `id == 0` and re-registration. Register before firing/approving.
    /// @param campaignId The campaign id (must be non-zero and unregistered).
    /// @param releaseType PARAMETRIC (fire) or MILESTONE (approveMilestone).
    function registerCampaign(bytes32 campaignId, ReleaseType releaseType) external onlyOwner {
        if (campaignId == bytes32(0)) revert ZeroId();
        if (_campaigns[campaignId].registered) revert AlreadyRegistered(campaignId);
        _campaigns[campaignId].registered = true;
        _campaigns[campaignId].releaseType = releaseType;
        emit CampaignRegistered(campaignId, releaseType);
    }

    /// @notice Fire a PARAMETRIC campaign's trigger, making it releasable and starting its T+N clock.
    /// @dev Production reads a parametric oracle, e.g. PAGASA/BMKG/hydro-met for disasters; a single
    ///      manual trigger is an MVP simplification. Reverts unless the campaign is registered, PARAMETRIC,
    ///      and not already active.
    /// @param campaignId The campaign to trigger.
    /// @param detail Free-form note (event index, source, etc.) recorded on-chain.
    function fire(bytes32 campaignId, string calldata detail) external onlyOwner {
        _activate(campaignId, ReleaseType.PARAMETRIC);
        emit TriggerFired(campaignId, detail);
    }

    /// @notice Approve a MILESTONE campaign, making it releasable and starting its T+N clock.
    /// @dev Production: charity/multisig approval. Reverts unless the campaign is registered, MILESTONE,
    ///      and not already active.
    /// @param campaignId The campaign to approve.
    /// @param detail Free-form note (milestone reference, approver, etc.) recorded on-chain.
    function approveMilestone(bytes32 campaignId, string calldata detail) external onlyOwner {
        _activate(campaignId, ReleaseType.MILESTONE);
        emit MilestoneApproved(campaignId, detail);
    }

    /// @notice Revoke an erroneous/false-positive activation, returning the campaign to non-releasable.
    /// @dev The ONLY way to clear a trigger — `canRelease` is otherwise sticky. Clears `activatedAt` so a
    ///      later re-fire/re-approve re-stamps the clock. Does NOT claw back a tranche already released;
    ///      use `PayoutRouter.recoverToPool` for funds still parked in the router.
    /// @param campaignId The campaign to revoke.
    function revoke(bytes32 campaignId) external onlyOwner {
        if (!_campaigns[campaignId].registered) revert NotRegistered(campaignId);
        _campaigns[campaignId].active = false;
        _campaigns[campaignId].activatedAt = 0;
        emit TriggerRevoked(campaignId);
    }

    /// @inheritdoc IReleaseController
    function canRelease(bytes32 campaignId) external view override returns (bool releasable) {
        return _campaigns[campaignId].active;
    }

    /// @inheritdoc IReleaseController
    function activatedAt(bytes32 campaignId) external view override returns (uint256 at) {
        return _campaigns[campaignId].activatedAt;
    }

    /// @notice The registered release condition kind for a campaign.
    /// @param campaignId The campaign to query.
    /// @return registered Whether the campaign is registered.
    /// @return releaseType The campaign's release condition kind (meaningful only when `registered`).
    function campaignInfo(bytes32 campaignId) external view returns (bool registered, ReleaseType releaseType) {
        Campaign storage c = _campaigns[campaignId];
        return (c.registered, c.releaseType);
    }

    /// @inheritdoc Ownable
    /// @dev Disabled: a custody-gating contract must always retain an owner.
    function renounceOwnership() public pure override {
        revert OwnershipCannotBeRenounced();
    }

    /// @dev Shared activation path: validate registration + type + not-already-active, then flip active
    ///      and stamp the write-once `activatedAt`.
    function _activate(bytes32 campaignId, ReleaseType expected) internal {
        Campaign storage c = _campaigns[campaignId];
        if (!c.registered) revert NotRegistered(campaignId);
        if (c.releaseType != expected) revert WrongReleaseType(campaignId);
        if (c.active) revert AlreadyActive(campaignId);
        c.active = true;
        c.activatedAt = uint64(block.timestamp);
    }
}
