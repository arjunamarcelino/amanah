// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockStablecoin} from "../../src/mocks/MockStablecoin.sol";
import {MockSwap} from "../../src/mocks/MockSwap.sol";
import {ISwapToBase} from "../../src/interfaces/ISwapToBase.sol";
import {CharityPool} from "../../src/CharityPool.sol";
import {CharityHandler} from "./CharityHandler.sol";

contract CharityPoolInvariantTest is Test {
    MockStablecoin internal usdc;
    MockStablecoin internal xsgd;
    MockSwap internal swap;
    CharityPool internal pool;
    CharityHandler internal handler;

    function setUp() public {
        usdc = new MockStablecoin("Mock USDC", "mUSDC");
        xsgd = new MockStablecoin("Mock XSGD", "mXSGD");
        swap = new MockSwap(address(usdc));
        swap.setSupported(address(xsgd), true);
        usdc.mint(address(swap), 1_000_000_000e6); // deep liquidity for the run

        pool = new CharityPool(
            IERC20(address(usdc)), ISwapToBase(address(swap)), "Amanah Charity Pool", "aCHAR", address(this)
        );
        handler = new CharityHandler(pool, usdc, xsgd, swap);
        targetContract(address(handler));
    }

    /// @dev Donors never receive shares.
    function invariant_donorSharesAlwaysZero() public view {
        assertEq(pool.balanceOf(address(handler)), 0, "donor holds no shares");
    }

    /// @dev Every minted share is held by the pool itself.
    function invariant_totalSupplyEqualsSelfBalance() public view {
        assertEq(pool.totalSupply(), pool.balanceOf(address(pool)), "all shares held by pool");
    }

    /// @dev Supply tracks the base actually received across all donations.
    function invariant_totalSupplyEqualsBaseOutSum() public view {
        assertEq(pool.totalSupply(), handler.ghost_baseOutSum(), "supply == cumulative base received");
    }

    /// @dev The per-campaign tallies sum to total supply.
    function invariant_campaignTallySumsToSupply() public view {
        uint256 sum;
        for (uint256 i = 0; i < 3; i++) {
            sum += pool.donatedByCampaign(handler.campaigns(i));
        }
        assertEq(sum, pool.totalSupply(), "campaign tallies sum to supply");
    }

    /// @dev Accounting source of truth stays consistent; donate-only handler = no drift.
    function invariant_poolValueConsistent() public view {
        assertEq(pool.poolValue(), pool.totalAssets(), "poolValue == totalAssets");
        assertEq(pool.poolValue(), pool.totalSupply(), "no drift (donate-only)");
    }
}
