// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IYieldAdapter} from "./IYieldAdapter.sol";
import {MockStablecoin} from "../mocks/MockStablecoin.sol";

/// @title MockYieldVault
/// @notice Testnet-only standard yield adapter over the base stablecoin (mUSDC). Holds base
///         1:1 and lets the owner simulate yield via `accrue`, which mints fresh base into the
///         vault using the base token's testnet faucet. Production uses a real yield source.
/// @dev `totalAssets()` is a raw `balanceOf` — acceptable only as a known-trusted test double;
///      a production adapter MUST report a non-donatable, index-based value (see IYieldAdapter).
contract MockYieldVault is Ownable, IYieldAdapter {
    using SafeERC20 for IERC20;

    /// @notice One hundred percent, in basis points.
    uint16 internal constant MAX_BPS = 10_000;

    /// @inheritdoc IYieldAdapter
    address public immutable override base;

    /// @notice Emitted when base is deployed into the vault.
    event Deposited(address indexed from, uint256 assets);

    /// @notice Emitted when base is withdrawn from the vault.
    event Withdrawn(address indexed to, uint256 assets);

    /// @notice Emitted when simulated yield is minted into the vault.
    event YieldAccrued(uint256 amount);

    /// @notice Thrown when a zero address is supplied where the base token is required.
    error ZeroAddress();

    /// @param base_ The base stablecoin this vault deploys (must equal the pool's asset()).
    /// @param initialOwner The owner permitted to accrue simulated yield.
    constructor(address base_, address initialOwner) Ownable(initialOwner) {
        if (base_ == address(0)) revert ZeroAddress();
        base = base_;
    }

    /// @inheritdoc IYieldAdapter
    function deposit(uint256 assets) external override returns (uint256 deposited) {
        IERC20(base).safeTransferFrom(msg.sender, address(this), assets);
        emit Deposited(msg.sender, assets);
        return assets;
    }

    /// @inheritdoc IYieldAdapter
    function withdraw(uint256 assets) external override returns (uint256 withdrawn) {
        IERC20(base).safeTransfer(msg.sender, assets);
        emit Withdrawn(msg.sender, assets);
        return assets;
    }

    /// @inheritdoc IYieldAdapter
    function totalAssets() public view override returns (uint256) {
        return IERC20(base).balanceOf(address(this));
    }

    /// @notice Simulate yield by minting `totalAssets() * bps / MAX_BPS` base into the vault.
    /// @dev Owner-only (testnet faucet). A rate on deployed principal — mints 0 on an empty vault.
    /// @param bps Yield rate in basis points applied to current holdings.
    function accrue(uint16 bps) external onlyOwner {
        uint256 amount = totalAssets() * bps / MAX_BPS;
        if (amount > 0) {
            MockStablecoin(base).mint(address(this), amount);
            emit YieldAccrued(amount);
        }
    }
}
