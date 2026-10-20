// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {MockStablecoin} from "../../src/mocks/MockStablecoin.sol";
import {MockSwap} from "../../src/mocks/MockSwap.sol";
import {MockYieldVault} from "../../src/yield/MockYieldVault.sol";
import {MockHalalVault} from "../../src/yield/MockHalalVault.sol";
import {CharityPool} from "../../src/CharityPool.sol";
import {ReleaseController} from "../../src/release/ReleaseController.sol";
import {IReleaseController} from "../../src/release/IReleaseController.sol";
import {PayoutRouter} from "../../src/release/PayoutRouter.sol";

/// @dev Handler for CharityPool invariant testing. Donations come from DISTINCT external
///      actor addresses (never the pool), use ARBITRARY campaign ids, and are joined by a
///      `rawTransfer` action (base straight to the pool, bypassing `donate`) plus the yield
///      actions `investIdle`/`setMode`/`accrue` so the fuzzer actually reaches deployed +
///      accrued-yield states. The handler owns the two adapters (so it can `accrue`) and is
///      the pool owner (so it can `investIdle`/`setMode`). Bounds + early-returns keep every
///      call non-reverting (fail_on_revert).
contract CharityHandler is CommonBase, StdCheats, StdUtils {
    uint16 internal constant MAX_BPS = 10_000;

    CharityPool internal pool;
    MockStablecoin internal usdc;
    MockStablecoin internal xsgd;
    MockSwap internal swap;

    /// @notice Adapters owned by this handler, wired into the pool by the invariant test.
    MockYieldVault public standardVault;
    MockHalalVault public halalVault;

    /// @notice Release controller (owned by this handler so it can register/fire) + payout router (base
    ///         sink for released tranches), both wired into the pool by the invariant test.
    ReleaseController public releaseController;
    PayoutRouter public router;

    bytes32 internal constant CONSENT = keccak256("consent-doc|salt");

    /// @notice Fixed non-zero beneficiary for released tranches (router requires non-zero).
    address internal constant BENEFICIARY = address(0xBEEF);

    /// @notice Distinct external donor addresses (never the pool), so donor-share
    ///         invariants carry real signal.
    address[4] public actors;

    /// @notice Cumulative base credited across all donations (the expected totalSupply).
    uint256 public ghost_baseOutSum;
    /// @notice Cumulative base sent to the pool via raw transfer (drift, not minted).
    uint256 public ghost_rawTransferSum;
    /// @notice Cumulative simulated yield minted into the active adapter (poolValue growth).
    uint256 public ghost_yieldMinted;
    /// @notice Count of `investIdle` calls that actually deployed base (surplus > 0).
    uint256 public ghost_meaningfulInvests;
    /// @notice Count of `setMode` calls that actually flipped the mode (not same-mode no-ops).
    uint256 public ghost_modeFlips;
    /// @notice Cumulative base released out of the pool (measured totalSupply drop per release).
    uint256 public ghost_releasedSum;
    /// @notice Count of releases that actually drew from a deployed adapter (the divest-during-release
    ///         branch — the slice's novel code; a call-count/releasedSum guard alone would be vacuous here).
    uint256 public ghost_releasesFromDeployed;

    /// @notice Campaign ids this handler has registered in the controller (register-once guard).
    mapping(bytes32 campaignId => bool registered) internal _handlerRegistered;

    /// @notice Per-selector call counts, for the coverage guard against handler blind spots.
    mapping(bytes4 selector => uint256 count) public calls;

    /// @notice Every campaignId actually used — lets the tally-sum invariant cover the real
    ///         id set instead of a hardcoded few.
    bytes32[] public seenCampaigns;
    mapping(bytes32 campaignId => bool seen) internal _campaignSeen;

    modifier countCall() {
        calls[msg.sig]++;
        _;
    }

    constructor(CharityPool pool_, MockStablecoin usdc_, MockStablecoin xsgd_, MockSwap swap_) {
        pool = pool_;
        usdc = usdc_;
        xsgd = xsgd_;
        swap = swap_;
        standardVault = new MockYieldVault(address(usdc_), address(this));
        halalVault = new MockHalalVault(address(usdc_), address(this));
        releaseController = new ReleaseController(address(this));
        router = new PayoutRouter(address(usdc_), address(this));
        router.setPool(address(pool_));
        actors[0] = address(0xA11CE);
        actors[1] = address(0xB0B);
        actors[2] = address(0xC0FFEE);
        actors[3] = address(0xDECAF);
    }

    function donateBase(uint256 amount, uint256 seed) external countCall {
        amount = bound(amount, 1, 1_000_000e6);
        bytes32 id = bytes32(seed); // arbitrary campaign id (may be 0 = general fund)
        address actor = actors[seed % 4];
        usdc.mint(actor, amount);
        vm.startPrank(actor);
        usdc.approve(address(pool), amount);
        uint256 out = pool.donate(id, address(usdc), amount, CONSENT);
        vm.stopPrank();
        ghost_baseOutSum += out;
        _track(id);
    }

    function donateSwap(uint256 amount, uint256 seed) external countCall {
        uint256 liq = usdc.balanceOf(address(swap));
        if (liq == 0) return; // adapter out of base liquidity — skip rather than revert
        amount = bound(amount, 1, liq);
        bytes32 id = bytes32(seed);
        address actor = actors[seed % 4];
        xsgd.mint(actor, amount);
        vm.startPrank(actor);
        xsgd.approve(address(pool), amount);
        uint256 out = pool.donate(id, address(xsgd), amount, CONSENT);
        vm.stopPrank();
        ghost_baseOutSum += out;
        _track(id);
    }

    /// @notice Raw ERC20 transfer of base into the pool — NOT via `donate`. Exercises the
    ///         direct-transfer drift path (poolValue rises without minting/tallying).
    function rawTransfer(uint256 amount) external countCall {
        amount = bound(amount, 0, 1_000_000e6);
        usdc.mint(address(this), amount);
        usdc.transfer(address(pool), amount);
        ghost_rawTransferSum += amount;
    }

    /// @notice Deploy idle surplus into the active adapter; count only deploying calls.
    function investIdle() external countCall {
        uint256 before = _activeDeployed();
        pool.investIdle();
        if (_activeDeployed() > before) ghost_meaningfulInvests++;
    }

    /// @notice Flip yield mode (internal no-op if already in the requested mode); count real flips.
    function setMode(uint256 seed) external countCall {
        bool before = pool.halalMode();
        pool.setMode(seed % 2 == 1);
        if (pool.halalMode() != before) ghost_modeFlips++;
    }

    /// @notice Accrue simulated yield on the active adapter — skipped when it holds nothing,
    ///         so only EFFECTIVE accruals (that actually grow poolValue) are produced.
    function accrue(uint256 seed) external countCall {
        uint16 bps = uint16(bound(seed, 1, MAX_BPS));
        uint256 before = pool.poolValue();
        if (pool.halalMode()) {
            if (halalVault.totalAssets() == 0) return;
            halalVault.accrue(bps);
        } else {
            if (standardVault.totalAssets() == 0) return;
            standardVault.accrue(bps);
        }
        ghost_yieldMinted += pool.poolValue() - before;
    }

    /// @notice Fuzz the liquidity buffer across its full range, so the invest/divest math is
    ///         exercised at every buffer level (0%..100%), not just the 2000 bps default.
    function setBufferBps(uint256 seed) external countCall {
        pool.setBufferBps(uint16(bound(seed, 0, MAX_BPS)));
    }

    /// @notice Release a capped tranche of a DONATED campaign, registering + firing it first if needed.
    /// @dev Draws the id from `seenCampaigns` (the donated set) so the per-campaign cap is non-zero and the
    ///      release does real work — a fresh id would early-return forever and trip the afterInvariant
    ///      ghost. All campaigns registered PARAMETRIC + fired (type-correctness is covered by unit tests).
    ///      Biased so that when the active adapter holds funds and the campaign's available exceeds idle,
    ///      the amount exceeds idle — forcing the divest-during-release branch. Solvency guarantees
    ///      `amount <= poolValue = idle + deployed`, so the divest always covers (no revert).
    function release(uint256 seed, uint256 amount) external countCall {
        uint256 n = seenCampaigns.length;
        if (n == 0) return; // nothing donated yet
        bytes32 id = seenCampaigns[seed % n];
        if (id == bytes32(0)) return; // general fund: the controller rejects id 0

        if (!_handlerRegistered[id]) {
            releaseController.registerCampaign(id, IReleaseController.ReleaseType.PARAMETRIC);
            _handlerRegistered[id] = true;
        }
        if (!releaseController.canRelease(id)) {
            releaseController.fire(id, "fuzz");
        }

        uint256 available = pool.donatedByCampaign(id) - pool.releasedByCampaign(id);
        if (available == 0) return; // fully released already

        // Bias so the divest-during-release branch is PROVABLY exercised (not merely probable): if idle
        // base alone could cover the payout, deploy the surplus (at a 0 buffer) into the active adapter
        // first, pushing idle below `available` so the release must pull from the adapter. Direct pool
        // calls (handler is owner) — not the countCall'd actions — so no ghost/coverage pollution.
        uint256 idle = usdc.balanceOf(address(pool));
        if (idle >= available) {
            // Deploy the surplus so the release must divest — but SAVE/RESTORE the buffer so this does
            // not permanently pin minLiquidityBufferBps to 0 and silently dilute the full-range buffer
            // coverage that commit 964958d guarantees (investIdle already ran at 0, leaving idle ~0).
            uint16 savedBuffer = pool.minLiquidityBufferBps();
            pool.setBufferBps(0);
            pool.investIdle();
            pool.setBufferBps(savedBuffer);
            idle = usdc.balanceOf(address(pool));
        }

        uint256 deployed = _activeDeployed();
        if (deployed > 0 && available > idle) {
            amount = idle + 1 + (seed % (available - idle)); // in (idle, available] → forces a divest
        } else {
            amount = bound(amount, 1, available);
        }

        uint256 supplyBefore = pool.totalSupply();
        pool.releaseTranche(id, amount, BENEFICIARY);

        ghost_releasedSum += supplyBefore - pool.totalSupply(); // measured drop, not the arg
        if (deployed > _activeDeployed()) ghost_releasesFromDeployed++; // drew from a deployed adapter
    }

    function seenCampaignsLength() external view returns (uint256) {
        return seenCampaigns.length;
    }

    function _activeDeployed() internal view returns (uint256) {
        return pool.halalMode() ? halalVault.totalAssets() : standardVault.totalAssets();
    }

    function _track(bytes32 id) internal {
        if (!_campaignSeen[id]) {
            _campaignSeen[id] = true;
            seenCampaigns.push(id);
        }
    }
}
