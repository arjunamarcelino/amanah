// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title MockSwap
/// @notice Testnet-only off-ramp swap: converts supported stablecoins into the
///         base stablecoin (mUSDC) at a flat 1:1 rate. Production uses a real
///         DEX/oracle rate instead of the flat 1:1 here.
contract MockSwap {
    using SafeERC20 for IERC20;

    /// @notice The base stablecoin everything swaps into (mUSDC).
    address public immutable base;

    /// @notice Emitted on every swap, including base passthroughs.
    event Swapped(address indexed caller, address indexed tokenIn, uint256 amountIn, uint256 baseOut);

    /// @notice Thrown when a zero address is supplied where a token is required.
    error ZeroAddress();

    constructor(address base_) {
        if (base_ == address(0)) revert ZeroAddress();
        base = base_;
    }

    /// @notice Swap `amountIn` of `tokenIn` into base (mUSDC) at 1:1.
    ///         If `tokenIn` is already base, the call is a passthrough (no conversion,
    ///         no token movement) and simply reports the amount.
    /// @dev Caller must approve this contract to spend `amountIn` of a non-base `tokenIn`.
    ///      The contract must hold enough base liquidity to cover non-base swaps.
    ///      Production uses a real DEX/oracle rate instead of the flat 1:1 here.
    /// @param tokenIn The stablecoin being swapped in.
    /// @param amountIn The amount of `tokenIn` to swap (6 decimals).
    /// @return baseOut Amount of base credited to the caller (== amountIn for the 1:1 mock).
    function swapToBase(address tokenIn, uint256 amountIn) external returns (uint256 baseOut) {
        // 1:1 for MVP; production uses a real DEX/oracle rate.
        baseOut = amountIn;

        if (tokenIn == base) {
            // base is passthrough — already base, nothing to convert.
            emit Swapped(msg.sender, tokenIn, amountIn, baseOut);
            return baseOut;
        }

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(base).safeTransfer(msg.sender, baseOut);

        emit Swapped(msg.sender, tokenIn, amountIn, baseOut);
    }
}
