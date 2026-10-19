// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {MockStablecoin} from "../../src/mocks/MockStablecoin.sol";
import {MockSwap} from "../../src/mocks/MockSwap.sol";
import {CharityPool} from "../../src/CharityPool.sol";

/// @dev Donate-only handler for CharityPool invariant testing. It never performs raw
///      transfers into the pool, so `poolBalance == totalSupply` stays exact. All
///      donations originate from the handler itself (the donor), which must therefore
///      always hold zero shares. Bounds keep every call non-reverting (fail_on_revert).
contract CharityHandler is CommonBase, StdCheats, StdUtils {
    CharityPool internal pool;
    MockStablecoin internal usdc;
    MockStablecoin internal xsgd;
    MockSwap internal swap;

    bytes32 internal constant CONSENT = keccak256("consent-doc|salt");

    /// @notice Fixed, bounded set of campaign buckets (index 0 is the general fund).
    bytes32[3] public campaigns;
    /// @notice Cumulative base credited across all donations (the expected totalSupply).
    uint256 public ghost_baseOutSum;
    /// @notice Mirror of pool.donatedByCampaign per bucket.
    mapping(bytes32 campaignId => uint256 total) public ghost_tally;

    constructor(CharityPool pool_, MockStablecoin usdc_, MockStablecoin xsgd_, MockSwap swap_) {
        pool = pool_;
        usdc = usdc_;
        xsgd = xsgd_;
        swap = swap_;
        campaigns[0] = bytes32(0); // general fund
        campaigns[1] = keccak256("campaign-1");
        campaigns[2] = keccak256("campaign-2");
    }

    function donateBase(uint256 amount, uint256 seed) external {
        amount = bound(amount, 1, 1_000_000e6);
        bytes32 id = campaigns[seed % 3];
        usdc.mint(address(this), amount);
        usdc.approve(address(pool), amount);
        uint256 out = pool.donate(id, address(usdc), amount, CONSENT);
        ghost_baseOutSum += out;
        ghost_tally[id] += out;
    }

    function donateSwap(uint256 amount, uint256 seed) external {
        uint256 liq = usdc.balanceOf(address(swap));
        if (liq == 0) return; // adapter out of base liquidity — skip rather than revert
        amount = bound(amount, 1, liq);
        bytes32 id = campaigns[seed % 3];
        xsgd.mint(address(this), amount);
        xsgd.approve(address(pool), amount);
        uint256 out = pool.donate(id, address(xsgd), amount, CONSENT);
        ghost_baseOutSum += out;
        ghost_tally[id] += out;
    }
}
