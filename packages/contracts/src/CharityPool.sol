// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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
///         itself; funds can only leave via a future owner/release-gated payout.
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
