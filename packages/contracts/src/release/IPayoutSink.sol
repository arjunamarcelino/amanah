// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IPayoutSink
/// @notice The minimal surface CharityPool needs to validate a payout router before wiring it: the base
///         asset the router operates on. Mirrors the repo-wide `base() == asset()` invariant already
///         enforced for the swap adapter and yield adapters.
/// @dev Deliberately one method. The pool never calls the router's disbursement logic (it only pushes
///      base to it), so the pool must not depend on `recordAndPay`'s surface — only on `base()` for the
///      mismatch guard in `setPayoutRouter`.
interface IPayoutSink {
    /// @notice The base asset this router holds/disburses; MUST equal the pool's `asset()`.
    /// @return base The base token address.
    function base() external view returns (address base);
}
