// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IYieldAdapter
/// @notice Minimal yield-source seam for CharityPool: deploy idle base, pull it back, and
///         report holdings. A standard (riba-bearing) and a Halal (riba-free) adapter both
///         conform to this surface so the pool can route idle principal to either.
/// @dev The pool measures its OWN base-balance delta on deposit/withdraw and does NOT trust
///      these return values for accounting. `totalAssets()` IS trusted (owner-as-custodian).
///
///      PRODUCTION REQUIREMENT: a real adapter's `totalAssets()` MUST be a monotonic,
///      non-donatable, non-reverting accounting value (index-based, e.g. a share:asset
///      conversion), NOT a raw `balanceOf` that a direct transfer can inflate. The mocks use
///      `balanceOf` deliberately as a known-trusted test double only.
interface IYieldAdapter {
    /// @notice Pull `assets` of base from msg.sender (via transferFrom) and deploy into the source.
    /// @param assets Amount of base to deploy.
    /// @return deposited Amount accepted (informational only; the pool accounts on its own delta).
    function deposit(uint256 assets) external returns (uint256 deposited);

    /// @notice Return `assets` of base to msg.sender.
    /// @param assets Amount of base to withdraw.
    /// @return withdrawn Amount sent back (informational only; the pool accounts on its own delta).
    function withdraw(uint256 assets) external returns (uint256 withdrawn);

    /// @notice Total base currently held/claimable by this adapter (deployed principal + accrued yield).
    function totalAssets() external view returns (uint256);

    /// @notice The base asset this adapter operates on; MUST equal the pool's `asset()`.
    function base() external view returns (address);
}
