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

    bytes32 internal constant CONSENT = keccak256("consent-doc|salt");
    bytes32 internal constant CAMPAIGN = keccak256("campaign-1");

    // Mirror of CharityPool.Donated for vm.expectEmit.
    event Donated(
        address indexed donor,
        bytes32 indexed campaignId,
        address indexed stablecoin,
        uint256 amountIn,
        uint256 baseOut,
        bytes32 consentHash
    );

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

    // --- donate: base path -------------------------------------------------------------

    function _donateBase(address from, bytes32 id, uint256 amount) internal returns (uint256 out) {
        usdc.mint(from, amount);
        vm.startPrank(from);
        usdc.approve(address(pool), amount);
        out = pool.donate(id, address(usdc), amount, CONSENT);
        vm.stopPrank();
    }

    function test_DonateBase_IncreasesStateAndMintsToPool() public {
        uint256 amount = 1_000e6;
        uint256 out = _donateBase(donor, CAMPAIGN, amount);

        assertEq(out, amount, "returns base received");
        assertEq(pool.poolValue(), amount, "poolValue += amount");
        assertEq(pool.totalAssets(), amount, "totalAssets == poolValue");
        assertEq(pool.totalSupply(), amount, "totalSupply == pooled base");
        assertEq(pool.donatedByCampaign(CAMPAIGN), amount, "campaign tally");
        assertEq(pool.balanceOf(donor), 0, "donor gets NO shares");
        assertEq(pool.balanceOf(address(pool)), amount, "pool holds its principal");
        assertEq(usdc.balanceOf(address(pool)), amount, "pool base balance");
    }

    function test_DonateBase_EmitsDonated() public {
        uint256 amount = 500e6;
        usdc.mint(donor, amount);
        vm.startPrank(donor);
        usdc.approve(address(pool), amount);
        vm.expectEmit(true, true, true, true, address(pool));
        emit Donated(donor, CAMPAIGN, address(usdc), amount, amount, CONSENT);
        pool.donate(CAMPAIGN, address(usdc), amount, CONSENT);
        vm.stopPrank();
    }

    function test_DonateBase_RevertZeroAmount() public {
        vm.prank(donor);
        vm.expectRevert(CharityPool.ZeroAmount.selector);
        pool.donate(CAMPAIGN, address(usdc), 0, CONSENT);
    }

    function test_DonateBase_RevertZeroStablecoin() public {
        vm.prank(donor);
        vm.expectRevert(CharityPool.ZeroAddress.selector);
        pool.donate(CAMPAIGN, address(0), 1e6, CONSENT);
    }

    function test_DonateBase_RevertZeroConsent() public {
        vm.prank(donor);
        vm.expectRevert(CharityPool.ZeroConsent.selector);
        pool.donate(CAMPAIGN, address(usdc), 1e6, bytes32(0));
    }

    function test_Donate_CampaignZeroIsGeneralFund() public {
        uint256 amount = 250e6;
        _donateBase(donor, bytes32(0), amount);
        assertEq(pool.donatedByCampaign(bytes32(0)), amount, "general-fund tally");
    }

    function test_DonateBase_CumulativeAndIndependentCampaigns() public {
        bytes32 c2 = keccak256("campaign-2");
        _donateBase(donor, CAMPAIGN, 100e6);
        _donateBase(donor, CAMPAIGN, 150e6);
        _donateBase(donor, c2, 70e6);
        assertEq(pool.donatedByCampaign(CAMPAIGN), 250e6, "cumulative same campaign");
        assertEq(pool.donatedByCampaign(c2), 70e6, "independent campaign");
        assertEq(pool.totalSupply(), 320e6, "totalSupply == sum");
    }

    function test_DonateBase_MultipleDonorsOneCampaign() public {
        address donor2 = makeAddr("donor2");
        _donateBase(donor, CAMPAIGN, 100e6);
        _donateBase(donor2, CAMPAIGN, 200e6);
        assertEq(pool.donatedByCampaign(CAMPAIGN), 300e6, "both donors tallied");
        assertEq(pool.balanceOf(donor), 0, "donor1 no shares");
        assertEq(pool.balanceOf(donor2), 0, "donor2 no shares");
        assertEq(pool.totalSupply(), 300e6);
    }

    function test_DirectTransferDriftDoesNotMintOrTally() public {
        _donateBase(donor, CAMPAIGN, 100e6);
        // Someone sends base directly (not via donate).
        usdc.mint(address(this), 40e6);
        usdc.transfer(address(pool), 40e6);
        assertEq(pool.poolValue(), 140e6, "poolValue reflects direct transfer");
        assertEq(pool.totalSupply(), 100e6, "totalSupply unchanged by direct transfer");
        assertEq(pool.donatedByCampaign(CAMPAIGN), 100e6, "tally unchanged");
    }
}
