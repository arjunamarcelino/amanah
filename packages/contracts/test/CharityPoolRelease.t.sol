// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MockStablecoin} from "../src/mocks/MockStablecoin.sol";
import {MockSwap} from "../src/mocks/MockSwap.sol";
import {ISwapToBase} from "../src/interfaces/ISwapToBase.sol";
import {IYieldAdapter} from "../src/yield/IYieldAdapter.sol";
import {MockYieldVault} from "../src/yield/MockYieldVault.sol";
import {CharityPool} from "../src/CharityPool.sol";
import {IReleaseController} from "../src/release/IReleaseController.sol";
import {IPayoutRouter} from "../src/release/IPayoutRouter.sol";

/// @dev Inline test double for the release controller — lets the pool's gating/cap/burn logic be driven
///      directly (house pattern: inline doubles like LossySwap/ReentrantSwap in CharityPool.t.sol).
contract MockReleaseController is IReleaseController {
    mapping(bytes32 => bool) internal _releasable;
    mapping(bytes32 => uint256) internal _activatedAt;

    function setCanRelease(bytes32 id, bool v) external {
        _releasable[id] = v;
    }

    function setActivatedAt(bytes32 id, uint64 t) external {
        _activatedAt[id] = t;
    }

    function canRelease(bytes32 id) external view override returns (bool) {
        return _releasable[id];
    }

    function activatedAt(bytes32 id) external view override returns (uint256) {
        return _activatedAt[id];
    }
}

/// @dev Inline payout-router double: records what the pool stamps + receives base. Keeps the pool unit
///      test focused on pool logic (the real PayoutRouter's recordAndPay is covered in Payout.t.sol).
contract MockPayoutRouter is IPayoutRouter {
    address public immutable override base;

    struct Stamp {
        bytes32 campaignId;
        address beneficiary;
        uint256 amount;
    }

    mapping(bytes32 => Stamp) public stamped;

    constructor(address base_) {
        base = base_;
    }

    function setPending(bytes32 payoutId, bytes32 campaignId, address beneficiary, uint256 amount) external override {
        stamped[payoutId] = Stamp(campaignId, beneficiary, amount);
    }
}

/// @dev Adapter that UNDER-DELIVERS on withdraw (keeps `shortfallBps` of the requested base), to prove the
///      pool's post-divest `InsufficientLiquidity` self-check fires instead of transferring phantom base.
contract UnderDeliveringVault is IYieldAdapter {
    using SafeERC20 for IERC20;

    address public immutable override base;
    uint256 public immutable shortfallBps;

    constructor(address base_, uint256 shortfallBps_) {
        base = base_;
        shortfallBps = shortfallBps_;
    }

    function deposit(uint256 assets) external override returns (uint256) {
        IERC20(base).safeTransferFrom(msg.sender, address(this), assets);
        return assets;
    }

    function withdraw(uint256 assets) external override returns (uint256) {
        uint256 sent = assets - (assets * shortfallBps / 10_000);
        IERC20(base).safeTransfer(msg.sender, sent);
        return assets; // claims full, delivers less
    }

    function totalAssets() external view override returns (uint256) {
        return IERC20(base).balanceOf(address(this));
    }
}

contract CharityPoolReleaseTest is Test {
    MockStablecoin internal usdc;
    MockSwap internal swap;
    CharityPool internal pool;
    MockReleaseController internal controller;
    MockPayoutRouter internal router;

    address internal owner = address(this);
    address internal donor = makeAddr("donor");
    address internal stranger = makeAddr("stranger");
    address internal beneficiary = makeAddr("beneficiary");

    bytes32 internal constant CONSENT = keccak256("consent|salt");
    bytes32 internal constant CAMPAIGN = keccak256("campaign-1");

    // Mirrors for vm.expectEmit.
    event ReleaseControllerUpdated(address indexed oldController, address indexed newController);
    event PayoutRouterUpdated(address indexed oldRouter, address indexed newRouter);
    event ReleaseDelayUpdated(uint64 oldDelay, uint64 newDelay);
    event TrancheReleased(
        bytes32 indexed campaignId,
        bytes32 indexed payoutId,
        uint256 usdcAmount,
        address indexed beneficiary,
        uint256 unlockTime
    );

    function setUp() public {
        usdc = new MockStablecoin("Mock USDC", "mUSDC");
        swap = new MockSwap(address(usdc));
        usdc.mint(address(swap), 1_000_000e6);
        pool = new CharityPool(IERC20(address(usdc)), ISwapToBase(address(swap)), "Amanah", "aCHAR", owner);

        controller = new MockReleaseController();
        router = new MockPayoutRouter(address(usdc));
        pool.setReleaseController(IReleaseController(address(controller)));
        pool.setPayoutRouter(IPayoutRouter(address(router)));

        vm.warp(1_000_000);
    }

    function _donate(bytes32 id, uint256 amount) internal {
        usdc.mint(donor, amount);
        vm.startPrank(donor);
        usdc.approve(address(pool), amount);
        pool.donate(id, address(usdc), amount, CONSENT);
        vm.stopPrank();
    }

    /// @dev Make a campaign releasable now (condition met, activated at current time, delay 0).
    function _makeReleasable(bytes32 id) internal {
        controller.setCanRelease(id, true);
        controller.setActivatedAt(id, uint64(block.timestamp));
    }

    // --- setters ------------------------------------------------------------------------

    function test_SetReleaseController_EmitsAndStores() public {
        MockReleaseController c2 = new MockReleaseController();
        vm.expectEmit(true, true, false, false, address(pool));
        emit ReleaseControllerUpdated(address(controller), address(c2));
        pool.setReleaseController(IReleaseController(address(c2)));
        assertEq(address(pool.releaseController()), address(c2), "controller updated");
    }

    function test_SetReleaseController_RevertZero() public {
        vm.expectRevert(CharityPool.ZeroAddress.selector);
        pool.setReleaseController(IReleaseController(address(0)));
    }

    function test_SetReleaseController_RevertNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        pool.setReleaseController(IReleaseController(address(controller)));
    }

    function test_SetPayoutRouter_EmitsAndStores() public {
        MockPayoutRouter r2 = new MockPayoutRouter(address(usdc));
        vm.expectEmit(true, true, false, false, address(pool));
        emit PayoutRouterUpdated(address(router), address(r2));
        pool.setPayoutRouter(IPayoutRouter(address(r2)));
        assertEq(address(pool.payoutRouter()), address(r2), "router updated");
    }

    function test_SetPayoutRouter_RevertZero() public {
        vm.expectRevert(CharityPool.ZeroAddress.selector);
        pool.setPayoutRouter(IPayoutRouter(address(0)));
    }

    function test_SetPayoutRouter_RevertBaseMismatch() public {
        MockStablecoin other = new MockStablecoin("Other", "OTH");
        MockPayoutRouter wrong = new MockPayoutRouter(address(other));
        vm.expectRevert(abi.encodeWithSelector(CharityPool.BaseMismatch.selector, address(usdc), address(other)));
        pool.setPayoutRouter(IPayoutRouter(address(wrong)));
    }

    function test_SetReleaseDelay_EmitsAndStores() public {
        vm.expectEmit(false, false, false, true, address(pool));
        emit ReleaseDelayUpdated(0, 2 days);
        pool.setReleaseDelay(uint64(2 days));
        assertEq(pool.releaseDelay(), 2 days, "delay updated");
    }

    // --- releaseTranche: reverts --------------------------------------------------------

    function test_Release_RevertNotConfigured() public {
        CharityPool fresh = new CharityPool(IERC20(address(usdc)), ISwapToBase(address(swap)), "n", "s", owner);
        vm.expectRevert(CharityPool.ReleaseNotConfigured.selector);
        fresh.releaseTranche(CAMPAIGN, 1e6, beneficiary);
    }

    function test_Release_RevertZeroAmount() public {
        _donate(CAMPAIGN, 100e6);
        _makeReleasable(CAMPAIGN);
        vm.expectRevert(CharityPool.ZeroAmount.selector);
        pool.releaseTranche(CAMPAIGN, 0, beneficiary);
    }

    function test_Release_RevertZeroBeneficiary() public {
        _donate(CAMPAIGN, 100e6);
        _makeReleasable(CAMPAIGN);
        vm.expectRevert(CharityPool.ZeroAddress.selector);
        pool.releaseTranche(CAMPAIGN, 10e6, address(0));
    }

    function test_Release_RevertConditionNotMet() public {
        _donate(CAMPAIGN, 100e6);
        // condition not set
        vm.expectRevert(CharityPool.ReleaseConditionNotMet.selector);
        pool.releaseTranche(CAMPAIGN, 10e6, beneficiary);
    }

    function test_Release_RevertLockedBeforeDelay() public {
        _donate(CAMPAIGN, 100e6);
        _makeReleasable(CAMPAIGN);
        pool.setReleaseDelay(uint64(1 days));
        vm.expectRevert(CharityPool.ReleaseLocked.selector);
        pool.releaseTranche(CAMPAIGN, 10e6, beneficiary);
    }

    function test_Release_SucceedsAfterDelayElapses() public {
        _donate(CAMPAIGN, 100e6);
        _makeReleasable(CAMPAIGN);
        pool.setReleaseDelay(uint64(1 days));
        vm.warp(block.timestamp + 1 days);
        pool.releaseTranche(CAMPAIGN, 10e6, beneficiary);
        assertEq(pool.releasedByCampaign(CAMPAIGN), 10e6, "released after unlock");
    }

    function test_Release_RevertExceedsCampaignFunds() public {
        _donate(CAMPAIGN, 100e6);
        _makeReleasable(CAMPAIGN);
        vm.expectRevert(abi.encodeWithSelector(CharityPool.ExceedsCampaignFunds.selector, 101e6, 100e6));
        pool.releaseTranche(CAMPAIGN, 101e6, beneficiary);
    }

    function test_Release_RevertNonOwner() public {
        _donate(CAMPAIGN, 100e6);
        _makeReleasable(CAMPAIGN);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        pool.releaseTranche(CAMPAIGN, 10e6, beneficiary);
    }

    // --- releaseTranche: happy path -----------------------------------------------------

    function test_Release_BurnsStampsTransfersAndStaysSolvent() public {
        _donate(CAMPAIGN, 100e6);
        _makeReleasable(CAMPAIGN);
        uint256 amount = 30e6;
        bytes32 expectedPayoutId = keccak256(abi.encode(CAMPAIGN, uint256(0)));

        vm.expectEmit(true, true, true, true, address(pool));
        emit TrancheReleased(CAMPAIGN, expectedPayoutId, amount, beneficiary, block.timestamp);
        pool.releaseTranche(CAMPAIGN, amount, beneficiary);

        assertEq(pool.releasedByCampaign(CAMPAIGN), amount, "tally bumped");
        assertEq(pool.totalSupply(), 70e6, "principal burned");
        assertEq(pool.poolValue(), 70e6, "poolValue dropped by payout");
        assertGe(pool.poolValue(), pool.totalSupply(), "solvency preserved");
        assertEq(usdc.balanceOf(address(router)), amount, "base parked in router");
        assertEq(pool.donatedByCampaign(CAMPAIGN), 100e6, "donated never decremented");

        (bytes32 c, address ben, uint256 amt) = router.stamped(expectedPayoutId);
        assertEq(c, CAMPAIGN, "stamp campaign");
        assertEq(ben, beneficiary, "stamp beneficiary");
        assertEq(amt, amount, "stamp amount");
    }

    function test_Release_PayoutIdsDifferPerTranche() public {
        _donate(CAMPAIGN, 100e6);
        _makeReleasable(CAMPAIGN);
        bytes32 id0 = keccak256(abi.encode(CAMPAIGN, uint256(0)));
        bytes32 id1 = keccak256(abi.encode(CAMPAIGN, uint256(30e6)));
        pool.releaseTranche(CAMPAIGN, 30e6, beneficiary);
        pool.releaseTranche(CAMPAIGN, 20e6, beneficiary);
        (,, uint256 a0) = router.stamped(id0);
        (,, uint256 a1) = router.stamped(id1);
        assertEq(a0, 30e6, "first tranche stamped");
        assertEq(a1, 20e6, "second tranche stamped under distinct id");
        assertEq(pool.releasedByCampaign(CAMPAIGN), 50e6, "cumulative released");
    }

    // --- divest-during-release ----------------------------------------------------------

    function test_Release_DivestsWhenIdleShort() public {
        _donate(CAMPAIGN, 100e6);
        // Deploy most idle base into an adapter so idle < payout, forcing a divest.
        MockYieldVault vault = new MockYieldVault(address(usdc), owner);
        pool.setStandardAdapter(vault);
        pool.setBufferBps(1000); // keep 10% liquid → ~10e6 idle, 90e6 deployed
        pool.investIdle();
        assertLt(usdc.balanceOf(address(pool)), 50e6, "idle below payout after invest");

        _makeReleasable(CAMPAIGN);
        pool.releaseTranche(CAMPAIGN, 50e6, beneficiary); // 50 > idle → divest 40 from adapter
        assertEq(usdc.balanceOf(address(router)), 50e6, "full tranche delivered via divest");
        assertGe(pool.poolValue(), pool.totalSupply(), "solvency preserved across divest");
    }

    function test_Release_RevertInsufficientLiquidity_OnUnderDeliveringAdapter() public {
        _donate(CAMPAIGN, 100e6);
        UnderDeliveringVault bad = new UnderDeliveringVault(address(usdc), 500); // keeps 5% on withdraw
        pool.setStandardAdapter(IYieldAdapter(address(bad)));
        pool.setBufferBps(0); // deploy ~all idle
        pool.investIdle();
        assertLt(usdc.balanceOf(address(pool)), 50e6, "little idle left");

        _makeReleasable(CAMPAIGN);
        vm.expectRevert(CharityPool.InsufficientLiquidity.selector);
        pool.releaseTranche(CAMPAIGN, 50e6, beneficiary); // divest under-delivers → guard fires
    }
}
