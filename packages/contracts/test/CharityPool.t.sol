// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {MockStablecoin} from "../src/mocks/MockStablecoin.sol";
import {MockSwap} from "../src/mocks/MockSwap.sol";
import {ISwapToBase} from "../src/interfaces/ISwapToBase.sol";
import {CharityPool} from "../src/CharityPool.sol";

/// @dev Test adapter that UNDER-DELIVERS: pulls `tokenIn`, sends less base than it
///      returns — proving CharityPool credits the measured balance delta, not the
///      adapter's claimed return value.
contract LossySwap is ISwapToBase {
    using SafeERC20 for IERC20;

    address public immutable override base;
    uint256 public immutable feeBps;

    constructor(address base_, uint256 feeBps_) {
        base = base_;
        feeBps = feeBps_;
    }

    function swapToBase(address tokenIn, uint256 amountIn) external override returns (uint256 baseOut) {
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        uint256 delivered = amountIn - (amountIn * feeBps / 10_000);
        IERC20(base).safeTransfer(msg.sender, delivered);
        return amountIn; // claims the full amount but delivered less
    }
}

/// @dev Malicious adapter: re-enters `donate` during the swap. The pool's nonReentrant
///      guard must reject the re-entry.
contract ReentrantSwap is ISwapToBase {
    address public immutable override base;
    CharityPool public pool;

    constructor(address base_) {
        base = base_;
    }

    function setPool(CharityPool pool_) external {
        pool = pool_;
    }

    function swapToBase(address tokenIn, uint256 amountIn) external override returns (uint256) {
        // Attempt to re-enter the pool mid-donation — must revert.
        pool.donate(bytes32("x"), tokenIn, amountIn, keccak256("c"));
        return amountIn;
    }
}

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
    // Mirror of CharityPool.BufferBpsUpdated for vm.expectEmit.
    event BufferBpsUpdated(uint16 oldBps, uint16 newBps);

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

    // --- donate: swap path -------------------------------------------------------------

    function _donateSwap(address from, bytes32 id, uint256 amount) internal returns (uint256 out) {
        xsgd.mint(from, amount);
        vm.startPrank(from);
        xsgd.approve(address(pool), amount);
        out = pool.donate(id, address(xsgd), amount, CONSENT);
        vm.stopPrank();
    }

    function test_DonateSwap_IncreasesStateAndClearsAllowance() public {
        uint256 amount = 800e6;
        uint256 out = _donateSwap(donor, CAMPAIGN, amount);

        assertEq(out, amount, "1:1 baseOut");
        assertEq(pool.poolValue(), amount, "pool received base");
        assertEq(pool.totalSupply(), amount, "minted base received");
        assertEq(pool.donatedByCampaign(CAMPAIGN), amount, "tally");
        assertEq(pool.balanceOf(donor), 0, "donor no shares");
        assertEq(xsgd.balanceOf(address(pool)), 0, "pool holds no tokenIn");
        assertEq(xsgd.allowance(address(pool), address(swap)), 0, "pool->swap allowance re-zeroed");
    }

    function test_DonateSwap_EmitsDonatedWithBaseOut() public {
        uint256 amount = 300e6;
        xsgd.mint(donor, amount);
        vm.startPrank(donor);
        xsgd.approve(address(pool), amount);
        vm.expectEmit(true, true, true, true, address(pool));
        emit Donated(donor, CAMPAIGN, address(xsgd), amount, amount, CONSENT);
        pool.donate(CAMPAIGN, address(xsgd), amount, CONSENT);
        vm.stopPrank();
    }

    function test_DonateSwap_RevertUnsupported_DonorIntact() public {
        MockStablecoin idrx = new MockStablecoin("Mock IDRX", "mIDRX");
        uint256 amount = 100e6;
        idrx.mint(donor, amount);
        vm.startPrank(donor);
        idrx.approve(address(pool), amount);
        vm.expectRevert(abi.encodeWithSelector(MockSwap.UnsupportedToken.selector, address(idrx)));
        pool.donate(CAMPAIGN, address(idrx), amount, CONSENT);
        vm.stopPrank();
        assertEq(idrx.balanceOf(donor), amount, "donor keeps tokenIn on failed swap");
        assertEq(pool.totalSupply(), 0, "nothing minted");
    }

    function test_DonateSwap_RevertUnderfunded_DonorIntact() public {
        MockSwap dry = new MockSwap(address(usdc));
        dry.setSupported(address(xsgd), true);
        CharityPool dryPool = new CharityPool(IERC20(address(usdc)), ISwapToBase(address(dry)), "n", "s", owner);

        uint256 amount = 100e6;
        xsgd.mint(donor, amount);
        vm.startPrank(donor);
        xsgd.approve(address(dryPool), amount);
        vm.expectRevert(abi.encodeWithSelector(MockSwap.InsufficientBaseLiquidity.selector, amount, 0));
        dryPool.donate(CAMPAIGN, address(xsgd), amount, CONSENT);
        vm.stopPrank();
        assertEq(xsgd.balanceOf(donor), amount, "donor keeps tokenIn");
    }

    function test_DonateSwap_CreditsMeasuredDeltaNotReturn() public {
        LossySwap lossy = new LossySwap(address(usdc), 500); // under-delivers 5%
        usdc.mint(address(lossy), 1_000_000e6);
        CharityPool lossyPool = new CharityPool(IERC20(address(usdc)), ISwapToBase(address(lossy)), "n", "s", owner);

        uint256 amount = 1_000e6;
        uint256 expected = amount - (amount * 500 / 10_000); // 950e6 actually delivered

        xsgd.mint(donor, amount);
        vm.startPrank(donor);
        xsgd.approve(address(lossyPool), amount);
        uint256 out = lossyPool.donate(CAMPAIGN, address(xsgd), amount, CONSENT);
        vm.stopPrank();

        assertEq(out, expected, "credits measured base, not the adapter's claim");
        assertLt(out, amount, "strictly less than nominal");
        assertEq(lossyPool.totalSupply(), expected, "no phantom principal");
        assertEq(lossyPool.donatedByCampaign(CAMPAIGN), expected, "tally == received");
    }

    function testFuzz_DonateSwap(uint256 amount) public {
        amount = bound(amount, 1, 1_000_000e6); // bounded to seeded swap liquidity
        uint256 out = _donateSwap(donor, CAMPAIGN, amount);
        assertEq(out, amount, "1:1");
        assertEq(pool.totalSupply(), amount, "minted == received");
        assertEq(pool.donatedByCampaign(CAMPAIGN), amount, "tally");
    }

    // --- buffer (store-only) -----------------------------------------------------------

    function test_SetBufferBps_OwnerUpdatesAndEmits() public {
        vm.expectEmit(false, false, false, true, address(pool));
        emit BufferBpsUpdated(2000, 3000);
        pool.setBufferBps(3000);
        assertEq(pool.minLiquidityBufferBps(), 3000, "buffer updated");
    }

    function test_SetBufferBps_RevertNonOwner() public {
        vm.prank(donor);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, donor));
        pool.setBufferBps(1000);
    }

    function test_SetBufferBps_RevertAboveMax() public {
        vm.expectRevert(abi.encodeWithSelector(CharityPool.InvalidBufferBps.selector, uint16(10_001)));
        pool.setBufferBps(10_001);
    }

    function test_SetBufferBps_BoundariesAccepted() public {
        pool.setBufferBps(0);
        assertEq(pool.minLiquidityBufferBps(), 0, "0 accepted");
        pool.setBufferBps(10_000);
        assertEq(pool.minLiquidityBufferBps(), 10_000, "10000 accepted");
    }

    function test_SetBufferBps_NotEnforcedOnDonate() public {
        // Buffer is store-only: setting it does not block or alter donations.
        pool.setBufferBps(10_000);
        uint256 out = _donateBase(donor, CAMPAIGN, 100e6);
        assertEq(out, 100e6, "donation unaffected by buffer");
        assertEq(pool.poolValue(), 100e6, "funds still accepted in full");
    }

    // --- reentrancy --------------------------------------------------------------------

    function test_Donate_ReentrancyGuardBlocksReenter() public {
        ReentrantSwap evil = new ReentrantSwap(address(usdc));
        CharityPool evilPool = new CharityPool(IERC20(address(usdc)), ISwapToBase(address(evil)), "n", "s", owner);
        evil.setPool(evilPool);

        MockStablecoin attack = new MockStablecoin("Attack", "ATK");
        uint256 amount = 100e6;
        attack.mint(donor, amount);

        vm.startPrank(donor);
        attack.approve(address(evilPool), amount);
        vm.expectRevert(ReentrancyGuardTransient.ReentrancyGuardReentrantCall.selector);
        evilPool.donate(CAMPAIGN, address(attack), amount, CONSENT);
        vm.stopPrank();
    }
}
