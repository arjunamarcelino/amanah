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

        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = CharityHandler.donateBase.selector;
        selectors[1] = CharityHandler.donateSwap.selector;
        selectors[2] = CharityHandler.rawTransfer.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));
    }

    /// @dev Donors (distinct external addresses) never receive shares.
    function invariant_donorSharesAlwaysZero() public view {
        for (uint256 i = 0; i < 4; i++) {
            assertEq(pool.balanceOf(handler.actors(i)), 0, "donor holds no shares");
        }
        assertEq(pool.balanceOf(address(handler)), 0, "handler holds no shares");
    }

    /// @dev Every minted share is held by the pool itself.
    function invariant_totalSupplyEqualsSelfBalance() public view {
        assertEq(pool.totalSupply(), pool.balanceOf(address(pool)), "all shares held by pool");
    }

    /// @dev Supply tracks the base actually received via donate (raw transfers don't mint).
    function invariant_totalSupplyEqualsBaseOutSum() public view {
        assertEq(pool.totalSupply(), handler.ghost_baseOutSum(), "supply == cumulative base received");
    }

    /// @dev The per-campaign tallies, summed over the real id set used, equal total supply.
    function invariant_campaignTallySumsToSupply() public view {
        uint256 n = handler.seenCampaignsLength();
        uint256 sum;
        for (uint256 i = 0; i < n; i++) {
            sum += pool.donatedByCampaign(handler.seenCampaigns(i));
        }
        assertEq(sum, pool.totalSupply(), "campaign tallies sum to supply");
    }

    /// @dev Base held always covers minted principal. This is the TRUE invariant: raw
    ///      transfers can push poolValue strictly above totalSupply (drift), never below.
    function invariant_poolSolvent() public view {
        assertGe(pool.poolValue(), pool.totalSupply(), "pool base covers minted principal");
    }
}
