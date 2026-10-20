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
import {IYieldAdapter} from "./yield/IYieldAdapter.sol";

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
///
///      YIELD / EGRESS: `investIdle` deploys idle base into an owner-set adapter — the ONLY
///      path that moves base out of the pool. The donor-irrevocability firewall does not
///      constrain this owner-custodian power; a hostile owner-set adapter could route idle
///      principal away. Testnet/MVP accepts this (mocks only). A production deployment MUST
///      gate adapters behind an allowlist/timelock or make them set-once immutable.
contract CharityPool is ERC4626, Ownable2Step, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    /// @notice One hundred percent, in basis points.
    uint16 internal constant MAX_BPS = 10_000;

    /// @notice The 1:1 swap adapter used to convert non-base donations into base.
    ISwapToBase public immutable swap;

    /// @notice Liquidity buffer in bps. ENFORCED NOW by `investIdle` as the fraction of
    ///         `poolValue()` (idle + deployed) kept liquid rather than deployed. NOT yet used
    ///         as the release-time payout floor — that use arrives with the future release slice.
    uint16 public minLiquidityBufferBps = 2000;

    /// @notice Cumulative base attributed to each campaign for transparency. Never
    ///         decremented; `campaignId == 0` is the general (unattributed) fund. Open and
    ///         unauthenticated — anyone may attribute real funds to any id.
    mapping(bytes32 campaignId => uint256 totalBase) public donatedByCampaign;

    /// @notice The standard (riba-bearing) yield adapter idle base is deployed into when not
    ///         in Halal mode.
    IYieldAdapter public standardAdapter;

    /// @notice When true, idle base routes to `halalAdapter` (riba-free); otherwise to
    ///         `standardAdapter`. Shares a slot with `standardAdapter` (address + bool < 32
    ///         bytes), so the two adapters plus this flag occupy 2 storage slots total.
    bool public halalMode;

    /// @notice The Halal (Shariah-compliant, riba-free) yield adapter used in Halal mode.
    IYieldAdapter public halalAdapter;

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

    /// @notice Thrown when an invest/divest/mode action needs an adapter that is not set.
    error AdapterNotSet();

    /// @notice Thrown when configuring/switching would strand base in an adapter that still
    ///         holds funds (`remaining` base left behind).
    error AdapterStillFunded(uint256 remaining);

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

    /// @notice Emitted when the owner sets/replaces the standard yield adapter.
    event StandardAdapterUpdated(address indexed oldAdapter, address indexed newAdapter);

    /// @notice Emitted when the owner sets/replaces the Halal yield adapter.
    event HalalAdapterUpdated(address indexed oldAdapter, address indexed newAdapter);

    /// @notice Emitted when idle base is deployed into the active adapter. `assets` is the
    ///         measured base delta leaving the pool, not the adapter's claimed amount.
    event Invested(address indexed adapter, uint256 assets);

    /// @notice Emitted when the active yield mode is switched.
    event ModeChanged(bool halal);

    /// @notice Emitted on an emergency adapter replacement that bypasses the funded-check.
    event AdapterEmergencyReplaced(bool halal, address indexed oldAdapter, address indexed newAdapter);

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

    /// @notice Live fund value: idle base held by the pool PLUS base deployed in the active
    ///         yield adapter. The excess of this over `totalSupply()` (outstanding principal)
    ///         is accrued yield.
    /// @dev Short-circuits to idle-only when the active adapter is unset (`address(0)`), so the
    ///      pre-yield behaviour and the whole ERC4626 view surface keep working. `totalAssets()`
    ///      MUST NOT revert per EIP-4626; a reverting adapter breaks that (see `investIdle` /
    ///      `emergencyReplaceAdapter`).
    /// @return The pool's idle base balance plus the active adapter's holdings.
    function poolValue() public view returns (uint256) {
        uint256 idle = _baseBalance(asset());
        IYieldAdapter adapter = _activeAdapter();
        uint256 deployed = address(adapter) == address(0) ? 0 : adapter.totalAssets();
        return idle + deployed;
    }

    /// @inheritdoc ERC4626
    /// @dev Equals `poolValue()` = idle + deployed base. The excess over `totalSupply()`
    ///      (outstanding donated principal) is the yield accrued in the active adapter.
    function totalAssets() public view override returns (uint256) {
        return poolValue();
    }

    /// @dev The adapter idle base is currently routed to, per `halalMode`. May be `address(0)`
    ///      if the selected adapter has not been set.
    function _activeAdapter() internal view returns (IYieldAdapter) {
        return halalMode ? halalAdapter : standardAdapter;
    }

    /// @notice Set the liquidity buffer. Takes effect immediately on the next `investIdle`
    ///         (the fraction of poolValue kept liquid); the release-time payout-floor use is still future.
    /// @param bps New buffer in basis points; must be <= 10_000.
    function setBufferBps(uint16 bps) external onlyOwner {
        if (bps > MAX_BPS) revert InvalidBufferBps(bps);
        uint16 oldBps = minLiquidityBufferBps;
        minLiquidityBufferBps = bps;
        emit BufferBpsUpdated(oldBps, bps);
    }

    // --- Yield layer: adapters, invest/divest, mode -------------------------------------

    /// @notice Set/replace the standard yield adapter.
    /// @dev EGRESS WARNING: configuring an adapter enables `investIdle` to move base OUT of
    ///      the pool — the only path that does so. A hostile owner-set adapter could route
    ///      idle principal away. The donor firewall does NOT constrain this owner-custodian
    ///      power; a production deployment should gate adapters behind an allowlist/timelock
    ///      or make them set-once immutable.
    /// @param a The adapter (must operate on `asset()` and be non-zero). Reverts
    ///        `AdapterStillFunded` if replacing an adapter that still holds base.
    function setStandardAdapter(IYieldAdapter a) external onlyOwner {
        _setAdapter(false, a);
    }

    /// @notice Set/replace the Halal yield adapter. See `setStandardAdapter` egress warning.
    /// @param a The adapter (must operate on `asset()` and be non-zero). Reverts
    ///        `AdapterStillFunded` if replacing an adapter that still holds base.
    function setHalalAdapter(IYieldAdapter a) external onlyOwner {
        _setAdapter(true, a);
    }

    /// @dev Validates and stores an adapter slot, refusing to overwrite one that still holds
    ///      funds (which would make `poolValue()` stop counting them). The `totalAssets() != 0`
    ///      gate assumes an exact-divest adapter — see `setMode`'s EXACT DIVEST note.
    function _setAdapter(bool halal, IYieldAdapter a) internal {
        if (address(a) == address(0)) revert ZeroAddress();
        if (a.base() != asset()) revert BaseMismatch(asset(), a.base());
        IYieldAdapter current = halal ? halalAdapter : standardAdapter;
        if (address(current) != address(0) && current.totalAssets() != 0) {
            revert AdapterStillFunded(current.totalAssets());
        }
        if (halal) {
            emit HalalAdapterUpdated(address(current), address(a));
            halalAdapter = a;
        } else {
            emit StandardAdapterUpdated(address(current), address(a));
            standardAdapter = a;
        }
    }

    /// @notice Deploy idle base above the liquidity buffer into the active yield adapter.
    /// @dev Keeps `poolValue() * minLiquidityBufferBps / MAX_BPS` liquid and invests only the
    ///      surplus; a no-op when idle is at/below target (so it is idempotent and safe at a
    ///      100% buffer). EGRESS WARNING: this is the only path moving base out of the pool —
    ///      see `setStandardAdapter`. `nonReentrant` + the base delta is MEASURED, never the
    ///      adapter's return value.
    function investIdle() external onlyOwner nonReentrant {
        IYieldAdapter adapter = _activeAdapter();
        if (address(adapter) == address(0)) revert AdapterNotSet();

        uint256 idle = _baseBalance(asset());
        // `adapter` is already resolved and non-zero here, so this equals poolValue() without
        // the extra balanceOf STATICCALL + adapter re-resolution that poolValue() would redo.
        uint256 target = (idle + adapter.totalAssets()) * minLiquidityBufferBps / MAX_BPS;
        if (idle <= target) return;
        uint256 surplus = idle - target;

        IERC20 base_ = IERC20(asset());
        base_.forceApprove(address(adapter), surplus);
        adapter.deposit(surplus);
        base_.forceApprove(address(adapter), 0);

        uint256 afterBal = _baseBalance(asset());
        // Defensive: an adapter that returns base during deposit must not underflow here.
        emit Invested(address(adapter), afterBal >= idle ? 0 : idle - afterBal);
    }

    /// @notice Switch between standard and Halal yield modes.
    /// @dev Fully divests the currently-active adapter back to idle BEFORE flipping, so the
    ///      new (single) active adapter is the sole deployed location and `poolValue()` stays
    ///      correct. Requires the target adapter to be set and empty. Owner redeploys with
    ///      `investIdle` afterwards. `nonReentrant`.
    ///
    ///      ASSUMPTION — EXACT DIVEST: the post-divest `old.totalAssets() == 0` re-check assumes
    ///      an adapter that divests exactly to zero (the 1:1 mocks do). A real rounding/share-based
    ///      adapter may leave dust, which would make this check revert and brick mode switching.
    ///      The release slice MUST replace the exact-zero gate here and in `_setAdapter` with a
    ///      dust tolerance / sweep-to-idle before integrating such an adapter.
    /// @param halal True to route to the Halal adapter, false for the standard adapter.
    function setMode(bool halal) external onlyOwner nonReentrant {
        if (halal == halalMode) return;

        IYieldAdapter target = halal ? halalAdapter : standardAdapter;
        if (address(target) == address(0)) revert AdapterNotSet();
        // Stray funds in the inactive adapter (anyone can transfer base in) would surface
        // uncounted on switch — require it empty.
        if (target.totalAssets() != 0) revert AdapterStillFunded(target.totalAssets());

        IYieldAdapter old = _activeAdapter(); // resolve before the flip
        if (address(old) != address(0)) {
            uint256 deployed = old.totalAssets();
            if (deployed != 0) {
                _divest(deployed); // old still active — pulls from it
                if (old.totalAssets() != 0) revert AdapterStillFunded(old.totalAssets());
            }
        }

        halalMode = halal;
        emit ModeChanged(halal);
    }

    /// @notice LAST RESORT: replace an adapter whose `totalAssets()`/`withdraw` reverts (e.g.
    ///         a paused/bricked yield source), which would otherwise brick `poolValue()` and
    ///         the normal setter/`setMode` recovery paths.
    /// @dev Skips the funded-check and does NOT divest — any base stuck in the old adapter is
    ///      ABANDONED. Still validates the new adapter's base. `nonReentrant`.
    /// @param halal Which slot to replace (true = Halal, false = standard).
    /// @param a The replacement adapter.
    function emergencyReplaceAdapter(bool halal, IYieldAdapter a) external onlyOwner nonReentrant {
        if (address(a) == address(0)) revert ZeroAddress();
        if (a.base() != asset()) revert BaseMismatch(asset(), a.base());
        IYieldAdapter old = halal ? halalAdapter : standardAdapter;
        // Emit the canonical *AdapterUpdated event too, so indexers tracking the current
        // adapter via those events don't go stale on an emergency swap.
        if (halal) {
            emit HalalAdapterUpdated(address(old), address(a));
            halalAdapter = a;
        } else {
            emit StandardAdapterUpdated(address(old), address(a));
            standardAdapter = a;
        }
        emit AdapterEmergencyReplaced(halal, address(old), address(a));
    }

    /// @dev Pull up to `need` base from the active adapter back to the pool. Internal: only
    ///      reached through `nonReentrant` entrypoints. Pushes base pool-ward via the adapter.
    ///      Currently the sole caller (`setMode`) always passes the full deployed amount, so the
    ///      `need`-clamp is exercised only as a partial-divest primitive the deferred
    ///      release/harvest path will use.
    function _divest(uint256 need) internal {
        IYieldAdapter adapter = _activeAdapter();
        if (address(adapter) == address(0) || need == 0) return;
        uint256 deployed = adapter.totalAssets();
        uint256 pull = need > deployed ? deployed : need;
        if (pull != 0) adapter.withdraw(pull);
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
