// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {MockStablecoin} from "../../src/mocks/MockStablecoin.sol";
import {MockSwap} from "../../src/mocks/MockSwap.sol";
import {CharityPool} from "../../src/CharityPool.sol";

/// @dev Handler for CharityPool invariant testing. Donations come from DISTINCT external
///      actor addresses (never the pool), use ARBITRARY campaign ids, and are joined by a
///      `rawTransfer` action that sends base straight to the pool (bypassing `donate`) so
///      the direct-transfer drift path is actually exercised. Bounds keep every call
///      non-reverting (fail_on_revert).
contract CharityHandler is CommonBase, StdCheats, StdUtils {
    CharityPool internal pool;
    MockStablecoin internal usdc;
    MockStablecoin internal xsgd;
    MockSwap internal swap;

    bytes32 internal constant CONSENT = keccak256("consent-doc|salt");

    /// @notice Distinct external donor addresses (never the pool), so donor-share
    ///         invariants carry real signal.
    address[4] public actors;

    /// @notice Cumulative base credited across all donations (the expected totalSupply).
    uint256 public ghost_baseOutSum;
    /// @notice Every campaignId actually used — lets the tally-sum invariant cover the real
    ///         id set instead of a hardcoded few.
    bytes32[] public seenCampaigns;
    mapping(bytes32 campaignId => bool seen) internal _campaignSeen;

    constructor(CharityPool pool_, MockStablecoin usdc_, MockStablecoin xsgd_, MockSwap swap_) {
        pool = pool_;
        usdc = usdc_;
        xsgd = xsgd_;
        swap = swap_;
        actors[0] = address(0xA11CE);
        actors[1] = address(0xB0B);
        actors[2] = address(0xC0FFEE);
        actors[3] = address(0xDECAF);
    }

    function donateBase(uint256 amount, uint256 seed) external {
        amount = bound(amount, 1, 1_000_000e6);
        bytes32 id = bytes32(seed); // arbitrary campaign id (may be 0 = general fund)
        address actor = actors[seed % 4];
        usdc.mint(actor, amount);
        vm.startPrank(actor);
        usdc.approve(address(pool), amount);
        uint256 out = pool.donate(id, address(usdc), amount, CONSENT);
        vm.stopPrank();
        ghost_baseOutSum += out;
        _track(id);
    }

    function donateSwap(uint256 amount, uint256 seed) external {
        uint256 liq = usdc.balanceOf(address(swap));
        if (liq == 0) return; // adapter out of base liquidity — skip rather than revert
        amount = bound(amount, 1, liq);
        bytes32 id = bytes32(seed);
        address actor = actors[seed % 4];
        xsgd.mint(actor, amount);
        vm.startPrank(actor);
        xsgd.approve(address(pool), amount);
        uint256 out = pool.donate(id, address(xsgd), amount, CONSENT);
        vm.stopPrank();
        ghost_baseOutSum += out;
        _track(id);
    }

    /// @notice Raw ERC20 transfer of base into the pool — NOT via `donate`. Exercises the
    ///         direct-transfer drift path (poolValue rises without minting/tallying).
    function rawTransfer(uint256 amount) external {
        amount = bound(amount, 0, 1_000_000e6);
        usdc.mint(address(this), amount);
        usdc.transfer(address(pool), amount);
    }

    function seenCampaignsLength() external view returns (uint256) {
        return seenCampaigns.length;
    }

    function _track(bytes32 id) internal {
        if (!_campaignSeen[id]) {
            _campaignSeen[id] = true;
            seenCampaigns.push(id);
        }
    }
}
