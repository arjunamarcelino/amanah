// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {MockStablecoin} from "../src/mocks/MockStablecoin.sol";
import {MockSwap} from "../src/mocks/MockSwap.sol";
import {MockYieldVault} from "../src/yield/MockYieldVault.sol";
import {MockHalalVault} from "../src/yield/MockHalalVault.sol";
import {IYieldAdapter} from "../src/yield/IYieldAdapter.sol";
import {ReleaseController} from "../src/release/ReleaseController.sol";
import {IReleaseController} from "../src/release/IReleaseController.sol";
import {PayoutRouter} from "../src/release/PayoutRouter.sol";
import {IPayoutRouter} from "../src/release/IPayoutRouter.sol";
import {CharityPool} from "../src/CharityPool.sol";
import {ISwapToBase} from "../src/interfaces/ISwapToBase.sol";

/// @title Deploy
/// @notice One-shot deploy of the Amanah money contracts to Base Sepolia (84532) with
///         structural wiring (demo posture: releaseDelay=0, bufferBps=2000, mode=standard).
///         Deploys + wires inside one broadcast window, reads back every wire BEFORE writing
///         the labeled address ledger, then emits deployments/84532.json for the TS codegen.
/// @dev The deployer (derived from DEPLOYER_PRIVATE_KEY) is the initialOwner of every
///      Ownable/Ownable2Step contract and the msg.sender for every onlyOwner setter — so the
///      wiring cannot revert on ownership. Never calls transferOwnership/renounceOwnership.
contract Deploy is Script {
    uint16 internal constant BUFFER_BPS = 2000; // demo liquidity buffer
    uint64 internal constant RELEASE_DELAY = 0; // demo: instant release (prod T+2 = 172800)

    function run() external {
        // Guard: never broadcast to, or write a 84532-labeled ledger for, the wrong chain.
        // 84532 = Base Sepolia; canonical in packages/shared/src/chain.ts (CHAIN_ID).
        require(block.chainid == 84532, "Deploy: wrong chain (expected Base Sepolia 84532)");

        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);

        // --- deploy (order is load-bearing: every base/asset check must already hold) ---
        MockStablecoin mUSDC = new MockStablecoin("Mock USDC", "mUSDC"); // decimals() == 6
        MockStablecoin mXSGD = new MockStablecoin("Mock XSGD", "mXSGD");
        MockStablecoin mIDRX = new MockStablecoin("Mock IDRX", "mIDRX");

        MockSwap swap = new MockSwap(address(mUSDC)); // Ownable(msg.sender) == deployer

        CharityPool pool = new CharityPool(
            IERC20(address(mUSDC)), ISwapToBase(address(swap)), "Amanah Charity Pool", "aCHARITY", deployer
        );

        MockYieldVault stdVault = new MockYieldVault(address(mUSDC), deployer);
        MockHalalVault halalVault = new MockHalalVault(address(mUSDC), deployer);
        ReleaseController rc = new ReleaseController(deployer);
        PayoutRouter router = new PayoutRouter(address(mUSDC), deployer);

        // --- structural wiring (demo posture) ---
        pool.setStandardAdapter(IYieldAdapter(address(stdVault))); // requires base() == asset()
        pool.setHalalAdapter(IYieldAdapter(address(halalVault))); // requires base() == asset()
        pool.setReleaseController(IReleaseController(address(rc)));
        pool.setPayoutRouter(IPayoutRouter(address(router))); // requires base() == asset()
        pool.setBufferBps(BUFFER_BPS);
        pool.setReleaseDelay(RELEASE_DELAY);
        // setMode(false) intentionally omitted: halalMode already defaults false and
        // setMode(false) early-returns (no-op) — calling it would be dead weight.
        router.setPool(address(pool)); // requires pool != 0
        swap.setSupported(address(mXSGD), true); // base (mUSDC) is passthrough — never allowlisted
        swap.setSupported(address(mIDRX), true);

        vm.stopBroadcast();

        // --- console summary (addresses only — never the key). Printed BEFORE the read-back
        // asserts so a failing assert still surfaces the live addresses for recovery. ---
        console2.log("== Amanah deploy (Base Sepolia 84532) ==");
        console2.log("deployer         ", deployer);
        console2.log("mUSDC            ", address(mUSDC));
        console2.log("mXSGD            ", address(mXSGD));
        console2.log("mIDRX            ", address(mIDRX));
        console2.log("MockSwap         ", address(swap));
        console2.log("CharityPool      ", address(pool));
        console2.log("MockYieldVault   ", address(stdVault));
        console2.log("MockHalalVault   ", address(halalVault));
        console2.log("ReleaseController", address(rc));
        console2.log("PayoutRouter     ", address(router));

        // --- read-back verification: revert BEFORE writing the ledger if any wire is wrong ---
        // Only the MUTABLE wiring the setters just applied is checked — a setter given a wrong
        // address succeeds on-chain (no revert) but points at the wrong contract, which this
        // catches. Constructor immutables (base()/asset()) and single-owner ownership are
        // guaranteed by construction (initialOwner = deployer, no transfer/renounce call), so
        // they can only "fail" on an OpenZeppelin/compiler bug and are not re-checked.
        require(address(pool.standardAdapter()) == address(stdVault), "wire: standardAdapter");
        require(address(pool.halalAdapter()) == address(halalVault), "wire: halalAdapter");
        require(address(pool.releaseController()) == address(rc), "wire: releaseController");
        require(address(pool.payoutRouter()) == address(router), "wire: payoutRouter");
        require(pool.minLiquidityBufferBps() == BUFFER_BPS, "wire: bufferBps");
        require(pool.releaseDelay() == RELEASE_DELAY, "wire: releaseDelay");
        require(!pool.halalMode(), "wire: halalMode");
        require(router.pool() == address(pool), "wire: router.pool");
        require(swap.isSupported(address(mXSGD)), "wire: mXSGD allowlist");
        require(swap.isSupported(address(mIDRX)), "wire: mIDRX allowlist");

        // --- labeled ledger (FS write, after stopBroadcast) ---
        string memory o = "deployment";
        vm.serializeAddress(o, "mUSDC", address(mUSDC));
        vm.serializeAddress(o, "mXSGD", address(mXSGD));
        vm.serializeAddress(o, "mIDRX", address(mIDRX));
        vm.serializeAddress(o, "MockSwap", address(swap));
        vm.serializeAddress(o, "CharityPool", address(pool));
        vm.serializeAddress(o, "MockYieldVault", address(stdVault));
        vm.serializeAddress(o, "MockHalalVault", address(halalVault));
        vm.serializeAddress(o, "ReleaseController", address(rc));
        string memory json = vm.serializeAddress(o, "PayoutRouter", address(router));
        vm.writeJson(json, "./deployments/84532.json");
    }
}
