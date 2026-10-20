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
import {MockHalalVault} from "../src/yield/MockHalalVault.sol";
import {CharityPool} from "../src/CharityPool.sol";

/// @dev Adapter that moves real tokens but misbehaves by fractions: pulls only `pullBps` of a
///      deposit and returns only `sendBps` of a withdrawal. Proves the pool accounts on its
///      own measured delta (invest) and that an under-delivering divest is caught.
contract MisbehavingYieldVault is IYieldAdapter {
    using SafeERC20 for IERC20;

    address public immutable override base;
    uint256 public immutable pullBps;
    uint256 public immutable sendBps;

    constructor(address base_, uint256 pullBps_, uint256 sendBps_) {
        base = base_;
        pullBps = pullBps_;
        sendBps = sendBps_;
    }

    function deposit(uint256 assets) external override returns (uint256) {
        uint256 pulled = assets * pullBps / 10_000;
        IERC20(base).safeTransferFrom(msg.sender, address(this), pulled);
        return assets;
    }

    function withdraw(uint256 assets) external override returns (uint256) {
        uint256 sent = assets * sendBps / 10_000;
        IERC20(base).safeTransfer(msg.sender, sent);
        return assets;
    }

    function totalAssets() external view override returns (uint256) {
        return IERC20(base).balanceOf(address(this));
    }
}

/// @dev Adapter whose `deposit` returns MORE base to the pool than it took (pre-funded bonus),
///      exercising the pool's defensive invest delta (must not underflow / revert).
contract BaseReturningVault is IYieldAdapter {
    using SafeERC20 for IERC20;

    address public immutable override base;

    constructor(address base_) {
        base = base_;
    }

    function deposit(uint256 assets) external override returns (uint256) {
        IERC20(base).safeTransferFrom(msg.sender, address(this), assets);
        // Send everything back plus whatever bonus was pre-funded to this vault.
        IERC20(base).safeTransfer(msg.sender, IERC20(base).balanceOf(address(this)));
        return assets;
    }

    function withdraw(uint256) external pure override returns (uint256) {
        return 0;
    }

    function totalAssets() external view override returns (uint256) {
        return IERC20(base).balanceOf(address(this));
    }
}

/// @dev Adapter that is "bricked": `totalAssets`/`deposit`/`withdraw` all revert, simulating a
///      paused/broken yield source. `base()` stays callable so it can be configured.
contract RevertingYieldVault is IYieldAdapter {
    address public immutable override base;

    error Bricked();

    constructor(address base_) {
        base = base_;
    }

    function deposit(uint256) external pure override returns (uint256) {
        revert Bricked();
    }

    function withdraw(uint256) external pure override returns (uint256) {
        revert Bricked();
    }

    function totalAssets() external pure override returns (uint256) {
        revert Bricked();
    }
}

contract YieldTest is Test {
    MockStablecoin internal usdc;
    MockStablecoin internal xsgd;
    MockSwap internal swap;
    MockYieldVault internal standardVault;
    MockHalalVault internal halalVault;
    CharityPool internal pool;

    address internal owner = address(this);
    address internal donor = makeAddr("donor");

    bytes32 internal constant CONSENT = keccak256("consent-doc|salt");
    bytes32 internal constant CAMPAIGN = keccak256("campaign-1");

    // Mirrors for vm.expectEmit.
    event Invested(address indexed adapter, uint256 assets);
    event ModeChanged(bool halal);
    event StandardAdapterUpdated(address indexed oldAdapter, address indexed newAdapter);
    event AdapterEmergencyReplaced(bool halal, address indexed oldAdapter, address indexed newAdapter);
    event SukukYieldAccrued(uint256 amount);

    function setUp() public {
        usdc = new MockStablecoin("Mock USDC", "mUSDC");
        xsgd = new MockStablecoin("Mock XSGD", "mXSGD");
        swap = new MockSwap(address(usdc));
        usdc.mint(address(swap), 1_000_000e6);

        standardVault = new MockYieldVault(address(usdc), owner);
        halalVault = new MockHalalVault(address(usdc), owner);

        pool = new CharityPool(IERC20(address(usdc)), ISwapToBase(address(swap)), "Amanah Charity Pool", "aCHAR", owner);
        pool.setStandardAdapter(standardVault);
        pool.setHalalAdapter(halalVault);
    }

    function _donateBase(uint256 amount) internal returns (uint256 out) {
        usdc.mint(donor, amount);
        vm.startPrank(donor);
        usdc.approve(address(pool), amount);
        out = pool.donate(CAMPAIGN, address(usdc), amount, CONSENT);
        vm.stopPrank();
    }

    /// @dev A fresh pool with NO adapters configured.
    function _barePool() internal returns (CharityPool p) {
        p = new CharityPool(IERC20(address(usdc)), ISwapToBase(address(swap)), "n", "s", owner);
    }

    // --- investIdle ---------------------------------------------------------------------

    function test_InvestIdle_RespectsBuffer() public {
        _donateBase(1_000e6); // buffer default 20%
        pool.investIdle();
        assertEq(usdc.balanceOf(address(pool)), 200e6, "20% kept liquid");
        assertEq(standardVault.totalAssets(), 800e6, "80% deployed");
        assertEq(pool.poolValue(), 1_000e6, "poolValue conserved");
    }

    function test_InvestIdle_Buffer100_NoOp() public {
        pool.setBufferBps(10_000);
        _donateBase(1_000e6);
        pool.investIdle();
        assertEq(standardVault.totalAssets(), 0, "nothing deployed at 100% buffer");
        assertEq(usdc.balanceOf(address(pool)), 1_000e6, "all liquid");
    }

    function test_InvestIdle_Buffer0_InvestsAll() public {
        pool.setBufferBps(0);
        _donateBase(1_000e6);
        pool.investIdle();
        assertEq(standardVault.totalAssets(), 1_000e6, "all deployed at 0 buffer");
        assertEq(usdc.balanceOf(address(pool)), 0, "none liquid");
    }

    function test_InvestIdle_Idempotent() public {
        _donateBase(1_000e6);
        pool.investIdle();
        pool.investIdle(); // second call: idle == target, no-op
        assertEq(standardVault.totalAssets(), 800e6, "no double-invest");
        assertEq(usdc.balanceOf(address(pool)), 200e6, "buffer unchanged");
    }

    function test_InvestIdle_ClearsAllowance() public {
        _donateBase(1_000e6);
        pool.investIdle();
        assertEq(usdc.allowance(address(pool), address(standardVault)), 0, "allowance re-zeroed");
    }

    function test_InvestIdle_EmitsMeasuredDelta() public {
        _donateBase(1_000e6);
        vm.expectEmit(true, false, false, true, address(pool));
        emit Invested(address(standardVault), 800e6);
        pool.investIdle();
    }

    function test_InvestIdle_RevertsWhenAdapterUnset() public {
        CharityPool bare = _barePool();
        vm.expectRevert(CharityPool.AdapterNotSet.selector);
        bare.investIdle();
    }

    function test_InvestIdle_OnlyOwner() public {
        vm.prank(donor);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, donor));
        pool.investIdle();
    }

    function test_InvestIdle_MeasuresActualDelta() public {
        // Standard adapter under-pulls 5%: pool must credit the measured delta, not `surplus`.
        MisbehavingYieldVault lossy = new MisbehavingYieldVault(address(usdc), 9_500, 10_000);
        pool.setStandardAdapter(lossy); // current standard is empty → replace allowed
        _donateBase(1_000e6);

        uint256 surplus = 800e6;
        uint256 pulled = surplus * 9_500 / 10_000; // 760e6

        vm.expectEmit(true, false, false, true, address(pool));
        emit Invested(address(lossy), pulled);
        pool.investIdle();

        assertEq(lossy.totalAssets(), pulled, "adapter holds what it actually pulled");
        assertEq(usdc.balanceOf(address(pool)), 1_000e6 - pulled, "pool keeps the rest");
    }

    function test_InvestIdle_AdapterReturnsBase_NoUnderflow() public {
        BaseReturningVault weird = new BaseReturningVault(address(usdc));
        usdc.mint(address(weird), 50e6); // bonus it returns on top of the deposit
        pool.setStandardAdapter(weird);
        _donateBase(1_000e6);

        vm.expectEmit(true, false, false, true, address(pool));
        emit Invested(address(weird), 0); // defensive delta: balance grew, logs 0 not underflow
        pool.investIdle();

        assertEq(usdc.balanceOf(address(pool)), 1_000e6 + 50e6, "pool received deposit back plus bonus");
    }

    // --- accrue -------------------------------------------------------------------------

    function test_Accrue_GrowsPoolValue() public {
        _donateBase(1_000e6);
        pool.investIdle(); // 800e6 deployed
        uint256 before = pool.poolValue();

        standardVault.accrue(1_000); // +10% of 800e6 = 80e6
        assertEq(pool.poolValue(), before + 80e6, "poolValue grows by accrued yield");
        assertEq(pool.totalSupply(), 1_000e6, "totalSupply unchanged by yield");
        assertEq(pool.poolValue() - pool.totalSupply(), 80e6, "yield = poolValue - principal");

        // accrue on an empty adapter mints nothing (the inactive halal vault is empty).
        uint256 pv = pool.poolValue();
        halalVault.accrue(5_000);
        assertEq(pool.poolValue(), pv, "accrue on empty adapter is a no-op");
    }

    // --- setMode ------------------------------------------------------------------------

    function test_SetMode_RoutesToHalal() public {
        _donateBase(1_000e6);
        pool.investIdle(); // into standard

        pool.setMode(true);
        assertTrue(pool.halalMode(), "halal mode on");
        assertEq(standardVault.totalAssets(), 0, "standard fully divested");
        assertEq(usdc.balanceOf(address(pool)), 1_000e6, "all base back to idle");

        pool.investIdle(); // now routes to halal
        assertEq(halalVault.totalAssets(), 800e6, "deployed into halal adapter");

        vm.expectEmit(false, false, false, true, address(halalVault));
        emit SukukYieldAccrued(80e6);
        halalVault.accrue(1_000);
    }

    function test_SetMode_EmitsModeChanged() public {
        vm.expectEmit(false, false, false, true, address(pool));
        emit ModeChanged(true);
        pool.setMode(true);
    }

    function test_SetMode_SameMode_NoOp() public {
        pool.setMode(false); // already standard
        assertFalse(pool.halalMode(), "mode unchanged");
    }

    function test_SetMode_SolvencyHolds() public {
        _donateBase(1_000e6);
        pool.investIdle();
        standardVault.accrue(1_000); // yield so poolValue > totalSupply
        assertGe(pool.poolValue(), pool.totalSupply(), "solvent before switch");
        uint256 pv = pool.poolValue();

        pool.setMode(true);
        assertGe(pool.poolValue(), pool.totalSupply(), "solvent after switch");
        assertEq(pool.poolValue(), pv, "value conserved across switch (yield pulled to idle)");
    }

    function test_SetMode_RevertsWhenTargetUnset() public {
        CharityPool p = _barePool();
        p.setStandardAdapter(standardVault); // only standard set; halal unset
        vm.expectRevert(CharityPool.AdapterNotSet.selector);
        p.setMode(true);
    }

    function test_SetMode_RevertsWhenTargetFunded() public {
        // Anyone can inflate the inactive halal vault via a direct transfer.
        usdc.mint(address(this), 1e6);
        usdc.transfer(address(halalVault), 1e6);
        vm.expectRevert(abi.encodeWithSelector(CharityPool.AdapterStillFunded.selector, uint256(1e6)));
        pool.setMode(true);
    }

    function test_SetMode_UnderDeliveringWithdraw() public {
        // Standard adapter under-delivers on withdraw → divest leaves residue → revert.
        MisbehavingYieldVault lossy = new MisbehavingYieldVault(address(usdc), 10_000, 9_500);
        pool.setStandardAdapter(lossy);
        _donateBase(1_000e6);
        pool.investIdle(); // 800e6 into lossy

        uint256 residue = 800e6 - (800e6 * 9_500 / 10_000); // 40e6 left behind on divest
        vm.expectRevert(abi.encodeWithSelector(CharityPool.AdapterStillFunded.selector, residue));
        pool.setMode(true);
    }

    function test_SetMode_OnlyOwner() public {
        vm.prank(donor);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, donor));
        pool.setMode(true);
    }

    // --- setters ------------------------------------------------------------------------

    function test_SetAdapter_Emits() public {
        MockYieldVault fresh = new MockYieldVault(address(usdc), owner);
        vm.expectEmit(true, true, false, true, address(pool));
        emit StandardAdapterUpdated(address(standardVault), address(fresh));
        pool.setStandardAdapter(fresh);
    }

    function test_SetAdapter_RevertsBaseMismatch() public {
        MockYieldVault wrong = new MockYieldVault(address(xsgd), owner);
        vm.expectRevert(abi.encodeWithSelector(CharityPool.BaseMismatch.selector, address(usdc), address(xsgd)));
        pool.setStandardAdapter(wrong);
    }

    function test_SetAdapter_RevertsZeroAddress() public {
        vm.expectRevert(CharityPool.ZeroAddress.selector);
        pool.setStandardAdapter(IYieldAdapter(address(0)));
    }

    function test_SetAdapter_RevertsWhenFunded() public {
        _donateBase(1_000e6);
        pool.investIdle(); // standardVault now holds 800e6
        MockYieldVault fresh = new MockYieldVault(address(usdc), owner);
        vm.expectRevert(abi.encodeWithSelector(CharityPool.AdapterStillFunded.selector, uint256(800e6)));
        pool.setStandardAdapter(fresh);
    }

    function test_SetAdapter_OnlyOwner() public {
        MockYieldVault fresh = new MockYieldVault(address(usdc), owner);
        vm.prank(donor);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, donor));
        pool.setStandardAdapter(fresh);
    }

    // --- bricked adapter + emergency recovery -------------------------------------------

    function test_RevertingAdapter_BricksViews() public {
        RevertingYieldVault bricked = new RevertingYieldVault(address(usdc));
        pool.setStandardAdapter(bricked); // active adapter now reverts on totalAssets

        vm.expectRevert(RevertingYieldVault.Bricked.selector);
        pool.poolValue();
        vm.expectRevert(RevertingYieldVault.Bricked.selector);
        pool.totalAssets();
        // Normal recovery levers are also bricked (they read the active adapter).
        vm.expectRevert(RevertingYieldVault.Bricked.selector);
        pool.setMode(true);
        MockYieldVault fresh = new MockYieldVault(address(usdc), owner);
        vm.expectRevert(RevertingYieldVault.Bricked.selector);
        pool.setStandardAdapter(fresh);
    }

    function test_EmergencyReplace_RecoversFromBrickedAdapter() public {
        RevertingYieldVault bricked = new RevertingYieldVault(address(usdc));
        pool.setStandardAdapter(bricked);
        MockYieldVault healthy = new MockYieldVault(address(usdc), owner);

        vm.expectEmit(true, true, false, true, address(pool));
        emit StandardAdapterUpdated(address(bricked), address(healthy));
        vm.expectEmit(true, true, false, true, address(pool));
        emit AdapterEmergencyReplaced(false, address(bricked), address(healthy));
        pool.emergencyReplaceAdapter(false, healthy);

        assertEq(address(pool.standardAdapter()), address(healthy), "adapter swapped");
        assertEq(pool.poolValue(), 0, "views work again after recovery");
    }

    function test_EmergencyReplace_Validations() public {
        MockYieldVault fresh = new MockYieldVault(address(usdc), owner);
        vm.prank(donor);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, donor));
        pool.emergencyReplaceAdapter(false, fresh);

        vm.expectRevert(CharityPool.ZeroAddress.selector);
        pool.emergencyReplaceAdapter(false, IYieldAdapter(address(0)));

        MockYieldVault wrong = new MockYieldVault(address(xsgd), owner);
        vm.expectRevert(abi.encodeWithSelector(CharityPool.BaseMismatch.selector, address(usdc), address(xsgd)));
        pool.emergencyReplaceAdapter(false, wrong);
    }

    // --- regression + firewall ----------------------------------------------------------

    function test_PoolValue_IdleOnlyWhenAdapterUnset() public {
        CharityPool bare = _barePool();
        usdc.mint(donor, 100e6);
        vm.startPrank(donor);
        usdc.approve(address(bare), 100e6);
        bare.donate(CAMPAIGN, address(usdc), 100e6, CONSENT);
        vm.stopPrank();
        assertEq(bare.poolValue(), 100e6, "idle-only when no adapter set");
        assertEq(bare.totalAssets(), 100e6, "totalAssets idle-only, no revert");
    }

    function test_Firewall_StillRevertsAfterYield() public {
        _donateBase(1_000e6);
        pool.investIdle();
        standardVault.accrue(1_000); // poolValue now > totalSupply

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

        assertEq(pool.maxDeposit(donor), 0, "maxDeposit 0");
        assertEq(pool.maxMint(donor), 0, "maxMint 0");
        assertEq(pool.maxWithdraw(donor), 0, "maxWithdraw 0");
        assertEq(pool.maxRedeem(donor), 0, "maxRedeem 0");
    }

    function testFuzz_InvestIdle_BufferInvariant(uint256 amount, uint16 bps) public {
        amount = bound(amount, 1, 1_000_000e6);
        bps = uint16(bound(bps, 0, 10_000));
        pool.setBufferBps(bps);
        _donateBase(amount);

        pool.investIdle();

        // Immediately post-invest, idle meets the buffer target (NOT a standing invariant —
        // a later accrue would grow poolValue/target while idle is flat).
        uint256 target = pool.poolValue() * bps / 10_000;
        assertGe(usdc.balanceOf(address(pool)), target, "buffer target met after invest");
        assertEq(pool.poolValue(), amount, "poolValue conserved across invest");
    }
}
