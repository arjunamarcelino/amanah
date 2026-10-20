// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockStablecoin} from "../src/mocks/MockStablecoin.sol";
import {MockSwap} from "../src/mocks/MockSwap.sol";
import {ISwapToBase} from "../src/interfaces/ISwapToBase.sol";
import {MockYieldVault} from "../src/yield/MockYieldVault.sol";
import {CharityPool} from "../src/CharityPool.sol";
import {ReleaseController} from "../src/release/ReleaseController.sol";
import {IReleaseController} from "../src/release/IReleaseController.sol";
import {PayoutRouter} from "../src/release/PayoutRouter.sol";
import {IPayoutRouter} from "../src/release/IPayoutRouter.sol";

/// @dev End-to-end release + routing across the REAL ReleaseController + CharityPool + PayoutRouter.
contract PayoutTest is Test {
    MockStablecoin internal usdc;
    MockSwap internal swap;
    CharityPool internal pool;
    ReleaseController internal controller;
    PayoutRouter internal router;

    address internal owner = address(this);
    address internal donor = makeAddr("donor");
    address internal beneficiary = makeAddr("beneficiary");

    bytes32 internal constant CONSENT = keccak256("consent|salt");
    bytes32 internal constant DISASTER = keccak256("disaster-relief");
    bytes32 internal constant SCHOOL = keccak256("education-waqf");

    // Mirrors for vm.expectEmit.
    event TrancheReleased(
        bytes32 indexed payoutId,
        bytes32 indexed campaignId,
        address indexed beneficiary,
        uint256 usdcAmount,
        uint256 unlockTime
    );
    event Routed(
        bytes32 indexed payoutId,
        bytes32 indexed campaignId,
        address indexed beneficiary,
        uint256 usdcAmount,
        string rail,
        uint16 feeBpsCovered,
        string rationale
    );

    function setUp() public {
        usdc = new MockStablecoin("Mock USDC", "mUSDC");
        swap = new MockSwap(address(usdc));
        usdc.mint(address(swap), 1_000_000e6);
        pool = new CharityPool(IERC20(address(usdc)), ISwapToBase(address(swap)), "Amanah", "aCHAR", owner);

        controller = new ReleaseController(owner);
        router = new PayoutRouter(address(usdc), owner);

        pool.setReleaseController(IReleaseController(address(controller)));
        pool.setPayoutRouter(IPayoutRouter(address(router)));
        router.setPool(address(pool));

        controller.registerCampaign(DISASTER, IReleaseController.ReleaseType.PARAMETRIC);
        controller.registerCampaign(SCHOOL, IReleaseController.ReleaseType.MILESTONE);

        vm.warp(1_000_000);
    }

    function _donate(bytes32 id, uint256 amount) internal {
        usdc.mint(donor, amount);
        vm.startPrank(donor);
        usdc.approve(address(pool), amount);
        pool.donate(id, address(usdc), amount, CONSENT);
        vm.stopPrank();
    }

    function _firstPayoutId(bytes32 campaignId) internal pure returns (bytes32) {
        return keccak256(abi.encode(campaignId, uint256(0)));
    }

    // --- release gating -----------------------------------------------------------------

    function test_Release_RevertBeforeConditionMet() public {
        _donate(DISASTER, 100e6);
        vm.expectRevert(CharityPool.ReleaseConditionNotMet.selector);
        pool.releaseTranche(DISASTER, 10e6, beneficiary);
    }

    function test_Release_Parametric_AfterFire() public {
        _donate(DISASTER, 100e6);
        controller.fire(DISASTER, "PAGASA signal #5");

        uint256 amount = 40e6;
        vm.expectEmit(true, true, true, true, address(pool));
        emit TrancheReleased(_firstPayoutId(DISASTER), DISASTER, beneficiary, amount, block.timestamp);
        pool.releaseTranche(DISASTER, amount, beneficiary);

        assertEq(usdc.balanceOf(address(router)), amount, "tranche parked in router");
        assertEq(pool.totalSupply(), 60e6, "shares burned");
        assertEq(pool.releasedByCampaign(DISASTER), amount, "tally");
        assertGe(pool.poolValue(), pool.totalSupply(), "solvent");
    }

    function test_Release_Milestone_AfterApprove() public {
        _donate(SCHOOL, 100e6);
        controller.approveMilestone(SCHOOL, "term 1 complete");
        pool.releaseTranche(SCHOOL, 25e6, beneficiary);
        assertEq(usdc.balanceOf(address(router)), 25e6, "milestone tranche parked");
        assertEq(pool.releasedByCampaign(SCHOOL), 25e6, "tally");
    }

    function test_Release_RevertBeforeUnlock_WhenConditionMet() public {
        _donate(DISASTER, 100e6);
        pool.setReleaseDelay(uint64(2 days)); // production T+2
        controller.fire(DISASTER, "signal");

        // Condition IS met, but the staged delay has not elapsed.
        vm.expectRevert(CharityPool.ReleaseLocked.selector);
        pool.releaseTranche(DISASTER, 10e6, beneficiary);

        // After T+2 it succeeds.
        vm.warp(block.timestamp + 2 days);
        pool.releaseTranche(DISASTER, 10e6, beneficiary);
        assertEq(pool.releasedByCampaign(DISASTER), 10e6, "released after unlock");
    }

    function test_Release_RevertWrongType() public {
        // fire() on a MILESTONE campaign and approveMilestone() on a PARAMETRIC one both revert.
        vm.expectRevert(abi.encodeWithSelector(ReleaseController.WrongReleaseType.selector, SCHOOL));
        controller.fire(SCHOOL, "x");
        vm.expectRevert(abi.encodeWithSelector(ReleaseController.WrongReleaseType.selector, DISASTER));
        controller.approveMilestone(DISASTER, "x");
        // Unregistered campaign cannot be fired.
        bytes32 ghost = keccak256("unregistered");
        vm.expectRevert(abi.encodeWithSelector(ReleaseController.NotRegistered.selector, ghost));
        controller.fire(ghost, "x");
    }

    function test_Release_RevertExceedsCampaignFunds_RealController() public {
        _donate(DISASTER, 100e6);
        controller.fire(DISASTER, "x");
        vm.expectRevert(abi.encodeWithSelector(CharityPool.ExceedsCampaignFunds.selector, 150e6, 100e6));
        pool.releaseTranche(DISASTER, 150e6, beneficiary);
    }

    function test_Release_BufferRespectedExceptPayoutDraw() public {
        _donate(DISASTER, 100e6);
        MockYieldVault vault = new MockYieldVault(address(usdc), owner);
        pool.setStandardAdapter(vault);
        pool.setBufferBps(2000); // 20% buffer → 20e6 idle, 80e6 deployed
        pool.investIdle();
        assertEq(usdc.balanceOf(address(pool)), 20e6, "idle == buffer after invest");

        controller.fire(DISASTER, "x");
        pool.releaseTranche(DISASTER, 50e6, beneficiary); // 50 > 20 idle → divest 30, draws below buffer

        assertEq(usdc.balanceOf(address(router)), 50e6, "full payout delivered");
        uint256 bufferTarget = pool.poolValue() * 2000 / 10_000; // 20% of 50e6 = 10e6
        assertLt(usdc.balanceOf(address(pool)), bufferTarget, "payout drew liquidity below buffer (sanctioned)");
        assertGe(pool.poolValue(), pool.totalSupply(), "solvent after buffer-draw release");
    }

    function test_Release_PreservesSolvency() public {
        _donate(DISASTER, 100e6);
        controller.fire(DISASTER, "x");
        uint256 supplyBefore = pool.totalSupply();
        pool.releaseTranche(DISASTER, 30e6, beneficiary);
        assertEq(pool.totalSupply(), supplyBefore - 30e6, "supply dropped by payout");
        assertGe(pool.poolValue(), pool.totalSupply(), "poolValue >= totalSupply");
    }

    // --- recordAndPay (real router) -----------------------------------------------------

    function test_RecordAndPay_ConsumesPendingAndEmitsRouted() public {
        _donate(DISASTER, 100e6);
        controller.fire(DISASTER, "x");
        uint256 amount = 40e6;
        pool.releaseTranche(DISASTER, amount, beneficiary);
        bytes32 payoutId = _firstPayoutId(DISASTER);

        vm.expectEmit(true, true, true, true, address(router));
        emit Routed(payoutId, DISASTER, beneficiary, amount, "gcash-ph", 25, "lowest-fee corridor");
        router.recordAndPay(payoutId, beneficiary, amount, "gcash-ph", 25, "lowest-fee corridor");

        assertEq(usdc.balanceOf(beneficiary), amount, "beneficiary received funds");
        assertEq(usdc.balanceOf(address(router)), 0, "router drained");
    }

    function test_RecordAndPay_RevertMismatch() public {
        _donate(DISASTER, 100e6);
        controller.fire(DISASTER, "x");
        pool.releaseTranche(DISASTER, 40e6, beneficiary);
        bytes32 payoutId = _firstPayoutId(DISASTER);
        // Owner cannot redirect to a different payee/amount than the pool stamped.
        vm.expectRevert(abi.encodeWithSelector(PayoutRouter.PayoutMismatch.selector, payoutId));
        router.recordAndPay(payoutId, makeAddr("attacker"), 40e6, "r", 0, "x");
    }

    function test_RecordAndPay_RevertAlreadyPaid() public {
        _donate(DISASTER, 100e6);
        controller.fire(DISASTER, "x");
        pool.releaseTranche(DISASTER, 40e6, beneficiary);
        bytes32 payoutId = _firstPayoutId(DISASTER);
        router.recordAndPay(payoutId, beneficiary, 40e6, "r", 0, "x");
        vm.expectRevert(abi.encodeWithSelector(PayoutRouter.AlreadyPaid.selector, payoutId));
        router.recordAndPay(payoutId, beneficiary, 40e6, "r", 0, "x");
    }

    function test_RecordAndPay_RevertUnknownPayout() public {
        bytes32 payoutId = _firstPayoutId(DISASTER);
        vm.expectRevert(abi.encodeWithSelector(PayoutRouter.UnknownPayout.selector, payoutId));
        router.recordAndPay(payoutId, beneficiary, 40e6, "r", 0, "x");
    }

    // --- revoke + recover (P0-2 recovery paths) -----------------------------------------

    function test_Revoke_BlocksFutureRelease() public {
        _donate(DISASTER, 100e6);
        controller.fire(DISASTER, "false positive");
        controller.revoke(DISASTER);
        vm.expectRevert(CharityPool.ReleaseConditionNotMet.selector);
        pool.releaseTranche(DISASTER, 10e6, beneficiary);

        // Re-firing re-arms the campaign.
        controller.fire(DISASTER, "confirmed");
        pool.releaseTranche(DISASTER, 10e6, beneficiary);
        assertEq(pool.releasedByCampaign(DISASTER), 10e6, "release works after re-arm");
    }

    function test_Recover_CancelThenReturnsStrandedBase() public {
        _donate(DISASTER, 100e6);
        controller.fire(DISASTER, "false positive");
        pool.releaseTranche(DISASTER, 40e6, beneficiary); // 40e6 parked + earmarked in router
        bytes32 pid = _firstPayoutId(DISASTER);
        uint256 poolValueBefore = pool.poolValue();

        // Earmarked base cannot be recovered while the pending is live...
        vm.expectRevert(abi.encodeWithSelector(PayoutRouter.ExceedsFreeBalance.selector, 40e6, 0));
        router.recoverToPool(40e6);

        // ...cancel frees the earmark, then recovery returns it to the pool as surplus.
        controller.revoke(DISASTER);
        router.cancelPending(pid);
        router.recoverToPool(40e6);

        assertEq(usdc.balanceOf(address(router)), 0, "router returned funds");
        assertEq(pool.poolValue(), poolValueBefore + 40e6, "pool regained base as surplus");
        assertEq(pool.releasedByCampaign(DISASTER), 40e6, "released tally stays monotonic (not re-credited)");
        assertGe(pool.poolValue(), pool.totalSupply(), "solvent");
    }
}
