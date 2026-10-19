// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {ISwapToBase} from "./interfaces/ISwapToBase.sol";

/// @title CharityPool
/// @notice An ERC4626 vault over a base stablecoin (mUSDC) that accepts IRREVOCABLE
///         charitable donations attributed to a campaignId. Donors receive NO shares
///         and have NO withdrawal path: the standard ERC4626 deposit/mint/withdraw/
///         redeem surface is disabled (the irrevocable-gift firewall) and ownership
///         cannot be renounced. Pooled principal is minted as shares to the vault
///         itself. THIS version has no payout path whatsoever; an owner/release-gated
///         payout exists only in a future, separately-deployed version (see DEPLOYMENT).
/// @dev Intentional: irrevocable charitable gift (firewall — keeps this a charity, not
///      a CIS/security).
///
///      CLOSED VAULT: this is a degenerate (non-redeemable) ERC4626. `max*` return 0 and
///      all of deposit/mint/withdraw/redeem revert — do NOT integrate this as a yield
///      source. `preview*`/`convertTo*` stay live per EIP-4626 but quote a value that is
///      NOT redeemable here.
///
///      DEPLOYMENT: this version has no exit at all and is non-upgradeable, so any real
///      value sent to it is permanently locked. Testnet/MVP only — the production
///      contract ships with the release path already present.
contract CharityPool is ERC4626, Ownable2Step, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    /// @notice One hundred percent, in basis points.
    uint16 internal constant MAX_BPS = 10_000;

    /// @notice The 1:1 swap adapter used to convert non-base donations into base.
    ISwapToBase public immutable swap;

    /// @notice Minimum reserve (bps of cumulative donations) the pool must retain once a
    ///         payout path exists. STORE-ONLY this slice — not yet enforced.
    uint16 public minLiquidityBufferBps = 2000;

    /// @notice Cumulative base attributed to each campaign for transparency. Never
    ///         decremented; `campaignId == 0` is the general (unattributed) fund. Open and
    ///         unauthenticated — anyone may attribute real funds to any id.
    mapping(bytes32 campaignId => uint256 totalBase) public donatedByCampaign;

    /// @notice Thrown when a zero address is supplied where a token/adapter is required.
    error ZeroAddress();

    /// @notice Thrown when the vault asset does not match the swap adapter's base token.
    error BaseMismatch(address asset, address base);

    /// @notice Thrown by every donor-exit path and by `renounceOwnership` — funds are an
    ///         irrevocable charitable gift and the fund always retains a custodian.
    error GiftIsIrrevocable();

    /// @notice Thrown when the donation amount is zero.
    error ZeroAmount();

    /// @notice Thrown when no consent commitment is supplied (`consentHash == 0`).
    error ZeroConsent();

    /// @notice Thrown when the base actually received (and thus mintable) is zero.
    error NothingReceived();

    /// @notice Thrown when a buffer value exceeds 100% (`> MAX_BPS`).
    error InvalidBufferBps(uint16 bps);

    /// @notice Emitted on every successful donation.
    /// @param donor The caller (`msg.sender`); for relayed donations this is the relayer.
    /// @param campaignId Attribution bucket; `0` is the general fund.
    /// @param stablecoin The token supplied by the donor.
    /// @param amountIn Requested input amount (in `stablecoin` decimals); equals the amount
    ///        received for standard ERC20s, but may exceed it for a fee-on-transfer token.
    ///        `baseOut` is the authoritative credited value.
    /// @param baseOut Base actually received and credited (in base decimals).
    /// @param consentHash Opaque off-chain consent commitment; unverified on-chain and
    ///        carries no on-chain guarantee. MUST be a salted/high-entropy commitment,
    ///        never a bare hash of raw PII.
    event Donated(
        address indexed donor,
        bytes32 indexed campaignId,
        address indexed stablecoin,
        uint256 amountIn,
        uint256 baseOut,
        bytes32 consentHash
    );

    /// @notice Emitted when the owner updates the liquidity buffer.
    event BufferBpsUpdated(uint16 oldBps, uint16 newBps);

    /// @param asset_ The base stablecoin (mUSDC, 6 decimals) — the ERC4626 asset.
    /// @param swap_ The swap adapter converting non-base donations into `asset_`.
    /// @param name_ ERC20 name of the share token.
    /// @param symbol_ ERC20 symbol of the share token.
    /// @param initialOwner The initial owner/custodian.
    constructor(IERC20 asset_, ISwapToBase swap_, string memory name_, string memory symbol_, address initialOwner)
        ERC20(name_, symbol_)
        ERC4626(asset_)
        Ownable(initialOwner)
    {
        if (address(asset_) == address(0)) revert ZeroAddress();
        if (address(swap_) == address(0)) revert ZeroAddress();
        if (address(asset_) != swap_.base()) revert BaseMismatch(address(asset_), swap_.base());
        swap = swap_;
    }

    /// @notice Make an irrevocable charitable donation attributed to `campaignId`.
    /// @dev Pulls `amount` of `stablecoin`; base donations pass through, non-base are
    ///      swapped to base via the adapter. Shares equal to the base ACTUALLY received
    ///      (a balance delta, so fee-on-transfer tokens cannot mint phantom principal) are
    ///      minted to the pool itself — the donor receives nothing. `nonReentrant` + CEI:
    ///      all external calls happen before `_mint`/tally.
    /// @param campaignId Attribution bucket; `0` is the general fund.
    /// @param stablecoin The token to donate (base or an adapter-allowlisted token).
    /// @param amount Amount of `stablecoin` to donate (must be > 0).
    /// @param consentHash Salted off-chain consent commitment (must be non-zero).
    /// @return baseOut The base received and credited to the pool.
    function donate(bytes32 campaignId, address stablecoin, uint256 amount, bytes32 consentHash)
        external
        nonReentrant
        returns (uint256 baseOut)
    {
        if (amount == 0) revert ZeroAmount();
        if (stablecoin == address(0)) revert ZeroAddress();
        if (consentHash == bytes32(0)) revert ZeroConsent();

        address base_ = asset();
        uint256 baseBefore = _baseBalance(base_);

        IERC20(stablecoin).safeTransferFrom(msg.sender, address(this), amount);

        // Non-base donations are converted to base via the adapter. `baseOut` is read from
        // the pool's base-balance delta below (not the adapter's return value), so an
        // under-delivering adapter can never mint more than was actually received.
        if (stablecoin != base_) {
            IERC20(stablecoin).forceApprove(address(swap), amount);
            swap.swapToBase(stablecoin, amount);
            IERC20(stablecoin).forceApprove(address(swap), 0);
        }

        baseOut = _baseBalance(base_) - baseBefore;
        if (baseOut == 0) revert NothingReceived();

        _mint(address(this), baseOut);
        donatedByCampaign[campaignId] += baseOut;

        emit Donated(msg.sender, campaignId, stablecoin, amount, baseOut, consentHash);
    }

    /// @notice Total base held by the pool — the single accounting source of truth.
    /// @return The pool's base-token balance.
    function poolValue() public view returns (uint256) {
        return _baseBalance(asset());
    }

    /// @inheritdoc ERC4626
    /// @dev Overridden to the pool's base balance; equals `poolValue()`. When a future
    ///      yield slice deploys base into a yield source, this must count deployed + idle
    ///      assets, and the excess over outstanding principal becomes the yield.
    function totalAssets() public view override returns (uint256) {
        return poolValue();
    }

    /// @notice Set the minimum liquidity buffer. STORE-ONLY this slice — not yet enforced;
    ///         a future release slice uses it as a floor on releasable funds.
    /// @param bps New buffer in basis points; must be <= 10_000.
    function setBufferBps(uint16 bps) external onlyOwner {
        if (bps > MAX_BPS) revert InvalidBufferBps(bps);
        uint16 oldBps = minLiquidityBufferBps;
        minLiquidityBufferBps = bps;
        emit BufferBpsUpdated(oldBps, bps);
    }

    // --- Irrevocable-gift firewall: every ERC4626 exit is disabled ----------------------

    /// @inheritdoc ERC4626
    /// @dev Disabled: donations enter only via `donate`. Intentional firewall.
    function deposit(uint256, address) public pure override returns (uint256) {
        revert GiftIsIrrevocable();
    }

    /// @inheritdoc ERC4626
    /// @dev Disabled: donations enter only via `donate`. Intentional firewall.
    function mint(uint256, address) public pure override returns (uint256) {
        revert GiftIsIrrevocable();
    }

    /// @inheritdoc ERC4626
    /// @dev Disabled: donations are irrevocable; no donor withdrawal path exists.
    function withdraw(uint256, address, address) public pure override returns (uint256) {
        revert GiftIsIrrevocable();
    }

    /// @inheritdoc ERC4626
    /// @dev Disabled: donations are irrevocable; no donor redemption path exists.
    function redeem(uint256, address, address) public pure override returns (uint256) {
        revert GiftIsIrrevocable();
    }

    /// @inheritdoc Ownable
    /// @dev Disabled: the fund must always retain a custodian for the future release path.
    function renounceOwnership() public pure override {
        revert GiftIsIrrevocable();
    }

    /// @inheritdoc ERC4626
    /// @dev Returns 0 per EIP-4626 to signal deposits are permanently disabled.
    function maxDeposit(address) public pure override returns (uint256) {
        return 0;
    }

    /// @inheritdoc ERC4626
    /// @dev Returns 0 per EIP-4626 to signal mints are permanently disabled.
    function maxMint(address) public pure override returns (uint256) {
        return 0;
    }

    /// @inheritdoc ERC4626
    /// @dev Returns 0 per EIP-4626 to signal withdrawals are permanently disabled.
    function maxWithdraw(address) public pure override returns (uint256) {
        return 0;
    }

    /// @inheritdoc ERC4626
    /// @dev Returns 0 per EIP-4626 to signal redemptions are permanently disabled.
    function maxRedeem(address) public pure override returns (uint256) {
        return 0;
    }

    /// @dev Base-token balance of the pool. `base_` is passed in to avoid re-reading
    ///      `asset()` on hot paths.
    function _baseBalance(address base_) internal view returns (uint256) {
        return IERC20(base_).balanceOf(address(this));
    }
}
