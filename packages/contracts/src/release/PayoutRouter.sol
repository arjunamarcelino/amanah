// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {IPayoutSink} from "./IPayoutSink.sol";
import {IPayoutRouterWriter} from "./IPayoutRouterWriter.sol";
import {IPayoutRouter} from "./IPayoutRouter.sol";

/// @title PayoutRouter
/// @notice Second custody phase of a staged payout. CharityPool parks a released tranche here (stamping
///         the intended beneficiary/amount under a deterministic `payoutId`), then the owner/AI operator
///         disburses it to the vetted recipient with the routing decision (`rail` + `rationale`) recorded
///         on-chain via `Routed`.
/// @dev TRUST MODEL (mirror of CharityPool's EGRESS warnings): the router holds custody between release
///      and disbursement under a single owner key — this is NOT a defense against a compromised key. What
///      it IS: tranche-bound. `recordAndPay` can only pay the beneficiary/amount the pool stamped in
///      `pending[payoutId]`; it cannot invent a new payee/amount. `feeBpsCovered` is platform-covered and
///      recorded, NOT deducted from the beneficiary amount. `recoverToPool` is an owner escape hatch for
///      mis-released (post-`revoke`) or raw-transfer-griefed base.
contract PayoutRouter is IPayoutRouter, Ownable2Step, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    /// @inheritdoc IPayoutSink
    address public immutable override base;

    /// @notice The CharityPool allowed to stamp payouts and the destination for `recoverToPool`.
    address public pool;

    /// @notice A tranche's intended disbursement, stamped by the pool at release and consumed once.
    /// @dev Field order packs `consumed` into `beneficiary`'s slot (address 20B + bool 1B), so the record
    ///      is 3 slots not 4 and flipping `consumed` in `recordAndPay` is a modify-nonzero (~2.9k) rather
    ///      than a fresh 0->1 SSTORE (~20k). Do not reorder.
    struct Pending {
        bytes32 campaignId;
        address beneficiary;
        bool consumed;
        uint256 amount;
    }

    /// @notice Pending payout record per `payoutId` (pool-derived: campaignId + running release total).
    mapping(bytes32 payoutId => Pending pending) public pending;

    /// @notice Thrown when a required address/token is zero.
    error ZeroAddress();

    /// @notice Thrown when a required amount is zero.
    error ZeroAmount();

    /// @notice Thrown when `recordAndPay` targets a `payoutId` the pool never stamped.
    error UnknownPayout(bytes32 payoutId);

    /// @notice Thrown when a `payoutId` has already been disbursed.
    error AlreadyPaid(bytes32 payoutId);

    /// @notice Thrown when `recordAndPay`'s caller args do not match the stamped tranche record.
    error PayoutMismatch(bytes32 payoutId);

    /// @notice Thrown when a pool-only function is called by anyone other than the configured pool.
    error OnlyPool();

    /// @notice Thrown when `setPending` would overwrite an existing, not-yet-consumed payout record.
    error AlreadyPending(bytes32 payoutId);

    /// @notice Thrown when `recoverToPool` is called before the pool address is set.
    error PoolNotSet();

    /// @notice Thrown by `renounceOwnership` — a custody contract must always retain an owner.
    error OwnershipCannotBeRenounced();

    /// @notice Emitted when the owner sets/replaces the pool allowed to stamp payouts.
    event PoolUpdated(address indexed oldPool, address indexed newPool);

    /// @notice Emitted on a disbursement. `rail` + `rationale` = the AI routing decision recorded on-chain.
    /// @param payoutId The consumed pending-payout id.
    /// @param campaignId The campaign the tranche belonged to (for reconciliation to `TrancheReleased`).
    /// @param beneficiary The vetted recipient paid.
    /// @param usdcAmount Base amount sent (in base decimals).
    /// @param rail The off-chain settlement rail chosen (e.g. a corridor/provider label).
    /// @param feeBpsCovered Platform-covered fee in bps, recorded only (never deducted from `usdcAmount`).
    /// @param rationale Free-form justification for the routing decision.
    event Routed(
        bytes32 indexed payoutId,
        bytes32 indexed campaignId,
        address indexed beneficiary,
        uint256 usdcAmount,
        string rail,
        uint16 feeBpsCovered,
        string rationale
    );

    /// @notice Emitted when base is recovered back to the pool.
    event Recovered(uint256 amount);

    /// @param base_ The base stablecoin (mUSDC) this router disburses; MUST equal the pool's asset.
    /// @param initialOwner The initial owner/custodian (the AI/operator authority for this MVP).
    constructor(address base_, address initialOwner) Ownable(initialOwner) {
        if (base_ == address(0)) revert ZeroAddress();
        base = base_;
    }

    /// @notice Set/replace the CharityPool permitted to stamp payouts (and the recovery destination).
    /// @param pool_ The pool address (non-zero).
    function setPool(address pool_) external onlyOwner {
        if (pool_ == address(0)) revert ZeroAddress();
        emit PoolUpdated(pool, pool_);
        pool = pool_;
    }

    /// @inheritdoc IPayoutRouterWriter
    /// @dev Pool-only. Records the intended disbursement for a parked tranche. The pool derives `payoutId`
    ///      from the campaign's monotonic running total, so collisions require a pool bug; the overwrite
    ///      guard is defense-in-depth at the trust boundary, since the router already distrusts callers.
    function setPending(bytes32 payoutId, bytes32 campaignId, address beneficiary, uint256 amount) external override {
        if (msg.sender != pool) revert OnlyPool();
        if (beneficiary == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        Pending storage existing = pending[payoutId];
        if (existing.amount != 0 && !existing.consumed) revert AlreadyPending(payoutId);
        pending[payoutId] = Pending({campaignId: campaignId, beneficiary: beneficiary, consumed: false, amount: amount});
    }

    /// @notice Disburse a parked tranche to its stamped beneficiary with the AI routing decision.
    /// @dev Owner-gated, `nonReentrant`, CEI (mark consumed before transfer). Caller args MUST match the
    ///      pool-stamped record — the router cannot pay a different payee/amount than was released.
    /// @param payoutId The pending payout to consume.
    /// @param beneficiary Must equal the stamped beneficiary.
    /// @param usdcAmount Must equal the stamped amount.
    /// @param rail The settlement rail chosen by the operator/AI.
    /// @param feeBpsCovered Platform-covered fee in bps (recorded only).
    /// @param rationale Free-form routing justification (recorded on-chain).
    function recordAndPay(
        bytes32 payoutId,
        address beneficiary,
        uint256 usdcAmount,
        string calldata rail,
        uint16 feeBpsCovered,
        string calldata rationale
    ) external onlyOwner nonReentrant {
        Pending memory p = pending[payoutId];
        if (p.amount == 0) revert UnknownPayout(payoutId);
        if (p.consumed) revert AlreadyPaid(payoutId);
        if (beneficiary != p.beneficiary || usdcAmount != p.amount) revert PayoutMismatch(payoutId);

        pending[payoutId].consumed = true;

        IERC20(base).safeTransfer(p.beneficiary, p.amount);

        emit Routed(payoutId, p.campaignId, p.beneficiary, p.amount, rail, feeBpsCovered, rationale);
    }

    /// @notice Return mis-released or griefed base to the pool as general surplus.
    /// @dev Owner escape hatch, `nonReentrant`. Does NOT re-credit any campaign tally or un-burn shares
    ///      (the pool's `releasedByCampaign` is a monotonic "ever-moved-out" counter). The owner is
    ///      responsible for not recovering base still earmarked for a valid unconsumed `pending`.
    /// @param amount Base to send back to the pool.
    function recoverToPool(uint256 amount) external onlyOwner nonReentrant {
        if (pool == address(0)) revert PoolNotSet();
        if (amount == 0) revert ZeroAmount();
        IERC20(base).safeTransfer(pool, amount);
        emit Recovered(amount);
    }

    /// @inheritdoc Ownable
    /// @dev Disabled: a custody contract must always retain an owner.
    function renounceOwnership() public pure override {
        revert OwnershipCannotBeRenounced();
    }
}
