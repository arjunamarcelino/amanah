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

    // --- Firewall ----------------------------------------------------------------------

    function test_Firewall_ExitsRevertForDonor() public {
        vm.startPrank(donor);
        vm.expectRevert(CharityPool.GiftIsIrrevocable.selector);
        pool.deposit(1, donor);
        vm.expectRevert(CharityPool.GiftIsIrrevocable.selector);
        pool.mint(1, donor);
        vm.expectRevert(CharityPool.GiftIsIrrevocable.selector);
        pool.withdraw(1, donor, donor);
        vm.expectRevert(CharityPool.GiftIsIrrevocable.selector);
        pool.redeem(1, donor, donor);
        vm.stopPrank();
    }

    function test_Firewall_ExitsRevertForOwner() public {
        // Owner (msg.sender == this) is NOT privileged on the frozen surface.
        vm.expectRevert(CharityPool.GiftIsIrrevocable.selector);
        pool.deposit(1, owner);
        vm.expectRevert(CharityPool.GiftIsIrrevocable.selector);
        pool.mint(1, owner);
        vm.expectRevert(CharityPool.GiftIsIrrevocable.selector);
        pool.withdraw(1, owner, owner);
        vm.expectRevert(CharityPool.GiftIsIrrevocable.selector);
        pool.redeem(1, owner, owner);
    }

    function test_Firewall_RenounceOwnershipReverts() public {
        vm.expectRevert(CharityPool.GiftIsIrrevocable.selector);
        pool.renounceOwnership();
    }

    function test_Firewall_MaxFunctionsReturnZero() public view {
        assertEq(pool.maxDeposit(donor), 0, "maxDeposit 0");
        assertEq(pool.maxMint(donor), 0, "maxMint 0");
        assertEq(pool.maxWithdraw(donor), 0, "maxWithdraw 0");
        assertEq(pool.maxRedeem(donor), 0, "maxRedeem 0");
    }
}
