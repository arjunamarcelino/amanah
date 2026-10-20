// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MockStablecoin} from "../src/mocks/MockStablecoin.sol";
import {PayoutRouter} from "../src/release/PayoutRouter.sol";

contract PayoutRouterTest is Test {
    MockStablecoin internal usdc;
    PayoutRouter internal router;

    address internal owner = address(this);
    address internal poolAddr = makeAddr("pool");
    address internal beneficiary = makeAddr("beneficiary");
    address internal stranger = makeAddr("stranger");

    bytes32 internal constant PAYOUT = keccak256("payout-1");
    bytes32 internal constant CAMPAIGN = keccak256("campaign-1");

    // Mirrors for vm.expectEmit.
    event PoolUpdated(address indexed oldPool, address indexed newPool);
    event Routed(
        bytes32 indexed payoutId,
        bytes32 indexed campaignId,
        address indexed beneficiary,
        uint256 usdcAmount,
        string rail,
        uint16 feeBpsCovered,
        string rationale
    );
    event Recovered(uint256 amount);

    function setUp() public {
        usdc = new MockStablecoin("Mock USDC", "mUSDC");
        router = new PayoutRouter(address(usdc), owner);
        router.setPool(poolAddr);
    }

    function _stamp(bytes32 payoutId, uint256 amount) internal {
        vm.prank(poolAddr);
        router.setPending(payoutId, CAMPAIGN, beneficiary, amount);
    }

    // --- init / setPool -----------------------------------------------------------------

    function test_InitialState() public view {
        assertEq(router.base(), address(usdc), "base set");
        assertEq(router.owner(), owner, "owner set");
        assertEq(router.pool(), poolAddr, "pool set");
    }

    function test_Constructor_RevertZeroBase() public {
        vm.expectRevert(PayoutRouter.ZeroAddress.selector);
        new PayoutRouter(address(0), owner);
    }

    function test_SetPool_EmitsAndStores() public {
        address newPool = makeAddr("newPool");
        vm.expectEmit(true, true, false, false, address(router));
        emit PoolUpdated(poolAddr, newPool);
        router.setPool(newPool);
        assertEq(router.pool(), newPool, "pool updated");
    }

    function test_SetPool_RevertZero() public {
        vm.expectRevert(PayoutRouter.ZeroAddress.selector);
        router.setPool(address(0));
    }

    function test_SetPool_RevertNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        router.setPool(stranger);
    }

    // --- setPending ---------------------------------------------------------------------

    function test_SetPending_RevertNotPool() public {
        vm.prank(stranger);
        vm.expectRevert(PayoutRouter.OnlyPool.selector);
        router.setPending(PAYOUT, CAMPAIGN, beneficiary, 1e6);
    }

    function test_SetPending_RevertZeroBeneficiary() public {
        vm.prank(poolAddr);
        vm.expectRevert(PayoutRouter.ZeroAddress.selector);
        router.setPending(PAYOUT, CAMPAIGN, address(0), 1e6);
    }

    function test_SetPending_RevertZeroAmount() public {
        vm.prank(poolAddr);
        vm.expectRevert(PayoutRouter.ZeroAmount.selector);
        router.setPending(PAYOUT, CAMPAIGN, beneficiary, 0);
    }

    function test_SetPending_RevertOverwriteUnconsumed() public {
        _stamp(PAYOUT, 100e6);
        vm.prank(poolAddr);
        vm.expectRevert(abi.encodeWithSelector(PayoutRouter.AlreadyPending.selector, PAYOUT));
        router.setPending(PAYOUT, CAMPAIGN, beneficiary, 200e6);
    }

    // --- recordAndPay -------------------------------------------------------------------

    function test_RecordAndPay_ConsumesAndEmitsRouted() public {
        uint256 amount = 1_000e6;
        _stamp(PAYOUT, amount);
        usdc.mint(address(router), amount);

        vm.expectEmit(true, true, true, true, address(router));
        emit Routed(PAYOUT, CAMPAIGN, beneficiary, amount, "gcash-ph", 25, "lowest-fee corridor");
        router.recordAndPay(PAYOUT, beneficiary, amount, "gcash-ph", 25, "lowest-fee corridor");

        assertEq(usdc.balanceOf(beneficiary), amount, "beneficiary paid");
        assertEq(usdc.balanceOf(address(router)), 0, "router drained");
        (,, bool consumed,) = router.pending(PAYOUT);
        assertTrue(consumed, "marked consumed");
    }

    function test_RecordAndPay_RevertUnknownPayout() public {
        vm.expectRevert(abi.encodeWithSelector(PayoutRouter.UnknownPayout.selector, PAYOUT));
        router.recordAndPay(PAYOUT, beneficiary, 1e6, "r", 0, "x");
    }

    function test_RecordAndPay_RevertAlreadyPaid() public {
        uint256 amount = 500e6;
        _stamp(PAYOUT, amount);
        usdc.mint(address(router), amount);
        router.recordAndPay(PAYOUT, beneficiary, amount, "r", 0, "x");

        vm.expectRevert(abi.encodeWithSelector(PayoutRouter.AlreadyPaid.selector, PAYOUT));
        router.recordAndPay(PAYOUT, beneficiary, amount, "r", 0, "x");
    }

    function test_RecordAndPay_RevertMismatchBeneficiary() public {
        uint256 amount = 500e6;
        _stamp(PAYOUT, amount);
        usdc.mint(address(router), amount);
        vm.expectRevert(abi.encodeWithSelector(PayoutRouter.PayoutMismatch.selector, PAYOUT));
        router.recordAndPay(PAYOUT, stranger, amount, "r", 0, "x");
    }

    function test_RecordAndPay_RevertMismatchAmount() public {
        uint256 amount = 500e6;
        _stamp(PAYOUT, amount);
        usdc.mint(address(router), amount);
        vm.expectRevert(abi.encodeWithSelector(PayoutRouter.PayoutMismatch.selector, PAYOUT));
        router.recordAndPay(PAYOUT, beneficiary, amount + 1, "r", 0, "x");
    }

    function test_RecordAndPay_RevertNonOwner() public {
        uint256 amount = 500e6;
        _stamp(PAYOUT, amount);
        usdc.mint(address(router), amount);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        router.recordAndPay(PAYOUT, beneficiary, amount, "r", 0, "x");
    }

    // --- recoverToPool ------------------------------------------------------------------

    function test_RecoverToPool_TransfersAndEmits() public {
        uint256 amount = 300e6;
        usdc.mint(address(router), amount);
        vm.expectEmit(false, false, false, true, address(router));
        emit Recovered(amount);
        router.recoverToPool(amount);
        assertEq(usdc.balanceOf(poolAddr), amount, "returned to pool");
    }

    function test_RecoverToPool_RevertPoolNotSet() public {
        PayoutRouter fresh = new PayoutRouter(address(usdc), owner);
        usdc.mint(address(fresh), 100e6);
        vm.expectRevert(PayoutRouter.PoolNotSet.selector);
        fresh.recoverToPool(100e6);
    }

    function test_RecoverToPool_RevertZeroAmount() public {
        vm.expectRevert(PayoutRouter.ZeroAmount.selector);
        router.recoverToPool(0);
    }

    function test_RecoverToPool_RevertNonOwner() public {
        usdc.mint(address(router), 100e6);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        router.recoverToPool(100e6);
    }

    // --- ownership ----------------------------------------------------------------------

    function test_RenounceOwnership_Reverts() public {
        vm.expectRevert(PayoutRouter.OwnershipCannotBeRenounced.selector);
        router.renounceOwnership();
    }
}
