// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockStablecoin} from "../../src/mocks/MockStablecoin.sol";
import {MockSwap} from "../../src/mocks/MockSwap.sol";
import {ISwapToBase} from "../../src/interfaces/ISwapToBase.sol";
import {IYieldAdapter} from "../../src/yield/IYieldAdapter.sol";
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

        // Wire the handler-owned adapters, then hand pool ownership to the handler so it can
        // drive the onlyOwner yield actions (Ownable2Step: transfer + accept).
        pool.setStandardAdapter(handler.standardVault());
        pool.setHalalAdapter(handler.halalVault());
        pool.transferOwnership(address(handler));
        vm.prank(address(handler));
        pool.acceptOwnership();

        bytes4[] memory selectors = new bytes4[](7);
        selectors[0] = CharityHandler.donateBase.selector;
        selectors[1] = CharityHandler.donateSwap.selector;
        selectors[2] = CharityHandler.rawTransfer.selector;
        selectors[3] = CharityHandler.investIdle.selector;
        selectors[4] = CharityHandler.setMode.selector;
        selectors[5] = CharityHandler.accrue.selector;
        selectors[6] = CharityHandler.setBufferBps.selector;
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
    ///      transfers and yield can push poolValue strictly above totalSupply, never below.
    function invariant_poolSolvent() public view {
        assertGe(pool.poolValue(), pool.totalSupply(), "pool base covers minted principal");
    }

    /// @dev The inactive adapter never holds funds — the property that makes active-only
    ///      poolValue() accounting sound (setMode fully divests before flipping).
    function invariant_inactiveAdapterEmpty() public view {
        IYieldAdapter inactive = pool.halalMode() ? pool.standardAdapter() : pool.halalAdapter();
        assertEq(inactive.totalAssets(), 0, "inactive adapter holds no funds");
    }

    /// @dev Exact value conservation: poolValue is accounted for entirely by donated principal,
    ///      raw-transfer drift, and minted yield — nothing leaks across invest/divest/mode.
    function invariant_valueConservation() public view {
        assertEq(
            pool.poolValue(),
            handler.ghost_baseOutSum() + handler.ghost_rawTransferSum() + handler.ghost_yieldMinted(),
            "poolValue == donated + raw drift + yield"
        );
    }

    /// @dev Coverage guard against the documented false-pass blind spot: assert the yield
    ///      actions were not only CALLED but did real work (deployed base, minted yield).
    ///      Runs once after the campaign — a run that never reached yield states fails here.
    function afterInvariant() public view {
        assertGt(handler.calls(CharityHandler.investIdle.selector), 0, "investIdle never called");
        assertGt(handler.calls(CharityHandler.setMode.selector), 0, "setMode never called");
        assertGt(handler.calls(CharityHandler.accrue.selector), 0, "accrue never called");
        assertGt(handler.ghost_meaningfulInvests(), 0, "no invest ever deployed base (all no-ops)");
        assertGt(handler.ghost_modeFlips(), 0, "mode never actually flipped (all same-mode no-ops)");
        assertGt(handler.ghost_yieldMinted(), 0, "no effective yield ever produced");
    }
}
