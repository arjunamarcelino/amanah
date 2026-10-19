// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockSwap
/// @notice Testnet-only off-ramp swap: converts owner-allowlisted stablecoins into
///         the base stablecoin (mUSDC) at a flat 1:1 rate. Production uses a real
///         DEX/oracle rate instead of the flat 1:1 here.
/// @dev The allowlist exists so a caller cannot drain base liquidity by swapping a
///      worthless token 1:1. The base token is always accepted (passthrough).
contract MockSwap is Ownable {
    using SafeERC20 for IERC20;

    /// @notice The base stablecoin everything swaps into (mUSDC).
    address public immutable base;

    /// @notice Decimals of the base stablecoin, cached at deploy. The 1:1 rate is only
    ///         valid between tokens of equal decimals, which is enforced per swap.
    uint8 public immutable baseDecimals;

    /// @notice Tokens accepted by `swapToBase` (the base token is always accepted).
    mapping(address token => bool supported) public isSupported;

    /// @notice Emitted on every swap, including base passthroughs.
    event Swapped(address indexed caller, address indexed tokenIn, uint256 amountIn, uint256 baseOut);

    /// @notice Emitted when the owner allows or disallows a token for swapping.
    event TokenSupported(address indexed token, bool supported);

    /// @notice Thrown when a zero address is supplied where a token is required.
    error ZeroAddress();

    /// @notice Thrown when swapping a non-base token that is not allowlisted.
    error UnsupportedToken(address token);

    /// @notice Thrown when `tokenIn` decimals differ from the base, so 1:1 is invalid.
    error DecimalsMismatch(address token, uint8 tokenDecimals, uint8 baseDecimals);

    constructor(address base_) Ownable(msg.sender) {
        if (base_ == address(0)) revert ZeroAddress();
        base = base_;
        baseDecimals = IERC20Metadata(base_).decimals();
    }

    /// @notice Allow or disallow a non-base token for `swapToBase`.
    /// @param token The token to configure.
    /// @param supported Whether the token may be swapped.
    function setSupported(address token, bool supported) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        isSupported[token] = supported;
        emit TokenSupported(token, supported);
    }

    /// @notice Swap `amountIn` of `tokenIn` into base (mUSDC) at 1:1.
    ///         If `tokenIn` is already base, the call is a passthrough (no conversion,
    ///         no token movement) and simply reports the amount.
    /// @dev Caller must approve this contract to spend `amountIn` of a non-base `tokenIn`,
    ///      which must be allowlisted via `setSupported`. The contract must hold enough
    ///      base liquidity to cover non-base swaps. Production uses a real DEX/oracle rate.
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

        if (!isSupported[tokenIn]) revert UnsupportedToken(tokenIn);

        uint8 tokenDecimals = IERC20Metadata(tokenIn).decimals();
        if (tokenDecimals != baseDecimals) {
            revert DecimalsMismatch(tokenIn, tokenDecimals, baseDecimals);
        }

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(base).safeTransfer(msg.sender, baseOut);

        emit Swapped(msg.sender, tokenIn, amountIn, baseOut);
    }
}
