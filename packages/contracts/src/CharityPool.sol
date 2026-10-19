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

    /// @dev Base-token balance of the pool. `base_` is passed in to avoid re-reading
    ///      `asset()` on hot paths.
    function _baseBalance(address base_) internal view returns (uint256) {
        return IERC20(base_).balanceOf(address(this));
    }
}
