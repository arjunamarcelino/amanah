// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockStablecoin} from "../src/mocks/MockStablecoin.sol";
import {MockSwap} from "../src/mocks/MockSwap.sol";
import {ISwapToBase} from "../src/interfaces/ISwapToBase.sol";
import {CharityPool} from "../src/CharityPool.sol";

contract CharityPoolTest is Test {
    MockStablecoin internal usdc;
    MockStablecoin internal xsgd;
    MockSwap internal swap;
    CharityPool internal pool;

    address internal owner = address(this);
    address internal donor = makeAddr("donor");

    function setUp() public {
        usdc = new MockStablecoin("Mock USDC", "mUSDC");
        xsgd = new MockStablecoin("Mock XSGD", "mXSGD");
        swap = new MockSwap(address(usdc));
        swap.setSupported(address(xsgd), true);

        // Seed the swap with base liquidity so it can cover non-base donations.
        usdc.mint(address(swap), 1_000_000e6);

        pool = new CharityPool(IERC20(address(usdc)), ISwapToBase(address(swap)), "Amanah Charity Pool", "aCHAR", owner);
    }

    function test_InitialState() public view {
        assertEq(pool.poolValue(), 0, "poolValue starts at 0");
        assertEq(pool.totalAssets(), 0, "totalAssets starts at 0");
        assertEq(pool.totalSupply(), 0, "totalSupply starts at 0");
        assertEq(pool.asset(), address(usdc), "asset is base");
        assertEq(pool.decimals(), 6, "shares share base's 6 decimals");
        assertEq(pool.owner(), owner, "owner set");
        assertEq(address(pool.swap()), address(swap), "swap adapter set");
        assertEq(pool.minLiquidityBufferBps(), 2000, "default buffer 20%");
    }

    function test_Constructor_RevertZeroAsset() public {
        vm.expectRevert(CharityPool.ZeroAddress.selector);
        new CharityPool(IERC20(address(0)), ISwapToBase(address(swap)), "n", "s", owner);
    }

    function test_Constructor_RevertZeroSwap() public {
        vm.expectRevert(CharityPool.ZeroAddress.selector);
        new CharityPool(IERC20(address(usdc)), ISwapToBase(address(0)), "n", "s", owner);
    }

    function test_Constructor_RevertBaseMismatch() public {
        // A swap whose base is xsgd, paired against a usdc-asset pool.
        MockSwap wrongSwap = new MockSwap(address(xsgd));
        vm.expectRevert(abi.encodeWithSelector(CharityPool.BaseMismatch.selector, address(usdc), address(xsgd)));
        new CharityPool(IERC20(address(usdc)), ISwapToBase(address(wrongSwap)), "n", "s", owner);
    }
}
