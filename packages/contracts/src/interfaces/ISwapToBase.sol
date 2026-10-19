// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ISwapToBase
/// @notice Minimal interface a swap adapter must implement so that CharityPool can
///         convert non-base donations into the base stablecoin.
/// @dev MockSwap implements this for testnet (flat 1:1). A production adapter (real
///      DEX/oracle rate with slippage bounds) must conform to the same surface.
interface ISwapToBase {
    /// @notice Swap `amountIn` of `tokenIn` into base, crediting the caller.
    /// @param tokenIn The stablecoin being swapped in.
    /// @param amountIn The amount of `tokenIn` to swap.
    /// @return baseOut Amount of base credited to the caller.
    function swapToBase(address tokenIn, uint256 amountIn) external returns (uint256 baseOut);

    /// @notice The base stablecoin everything swaps into.
    function base() external view returns (address);
}
