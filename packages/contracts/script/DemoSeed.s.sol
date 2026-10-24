// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {MockStablecoin} from "../src/mocks/MockStablecoin.sol";
import {CharityPool} from "../src/CharityPool.sol";
import {ReleaseController} from "../src/release/ReleaseController.sol";
import {IReleaseController} from "../src/release/IReleaseController.sol";
import {IYieldAdapter} from "../src/yield/IYieldAdapter.sol";

// OPTIONAL demo seeding (off the critical path). Idempotent: safe to re-run.
// Registers BOTH demo campaigns on-chain, makes ONE real mUSDC donation to the
// flagship PARAMETRIC campaign (so the indexer surfaces a genuine `confirmed`
// ledger row — never fabricate confirmed data offchain), and deploys idle
// principal into the yield adapter. Uses the SAME campaignId preimages as the
// offchain seed: keccak256(bytes(slug)).
//
// Deliberately does NOT call fire(): the PARAMETRIC campaign is left ARMED
// (registered but not triggered) for a live demo of the release path.
//
// Reads a funded owner key from an untracked .env (DEPLOYER_PRIVATE_KEY = owner of
// all three contracts) — passed as an env var, never an argv flag:
//   forge script script/DemoSeed.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast
contract DemoSeed is Script {
    string internal constant FLAGSHIP_SLUG = "ph-typhoon-2025"; // PARAMETRIC (armed, not fired)
    string internal constant MILESTONE_SLUG = "id-rural-school-supplies"; // MILESTONE (registered)
    string internal constant FIRE_SLUG = "id-forest-fire-2026"; // PARAMETRIC (armed, not fired)

    uint256 internal constant SEED_AMOUNT = 100e6; // 100 mUSDC (6 decimals)
    // Forest-fire campaign funded ABOVE its console preset tranche (500 mUSDC) so a demo
    // releaseTranche doesn't revert ExceedsCampaignFunds (releaseTranche does not cap).
    uint256 internal constant FIRE_SEED_AMOUNT = 600e6; // 600 mUSDC
    // Preflight floor: ~10x headroom for ~9 cheap L2 txs (3x register, 2x mint/approve/donate,
    // investIdle).
    uint256 internal constant MIN_ETH = 0.005 ether;
    uint16 internal constant MAX_BPS = 10_000; // mirrors CharityPool.MAX_BPS

    function run() external {
        string memory json = vm.readFile("./deployments/84532.json");
        CharityPool pool = CharityPool(vm.parseJsonAddress(json, ".CharityPool"));
        ReleaseController rc = ReleaseController(vm.parseJsonAddress(json, ".ReleaseController"));
        MockStablecoin musdc = MockStablecoin(vm.parseJsonAddress(json, ".mUSDC"));

        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk); // == owner of pool/rc/mocks; broadcast msg.sender

        bytes32 flagshipId = keccak256(bytes(FLAGSHIP_SLUG));
        bytes32 milestoneId = keccak256(bytes(MILESTONE_SLUG));
        bytes32 consentHash = keccak256("demo-consent"); // opaque salted commitment (demo); non-zero

        // 1. PREFLIGHT: fail fast BEFORE any broadcast tx if the owner key is underfunded.
        uint256 bal = deployer.balance;
        console2.log("DemoSeed: deployer      ", deployer);
        console2.log("DemoSeed: deployer ETH  ", bal);
        console2.log("DemoSeed: required floor ", MIN_ETH);
        require(bal >= MIN_ETH, "DemoSeed: deployer underfunded - top up DEPLOYER_PRIVATE_KEY on Base Sepolia");

        // Read current on-chain state (view calls) for idempotency.
        (bool flagshipRegistered,) = rc.campaignInfo(flagshipId);
        (bool milestoneRegistered,) = rc.campaignInfo(milestoneId);
        uint256 flagshipDonated = pool.donatedByCampaign(flagshipId);
        bool needDonation = flagshipDonated < SEED_AMOUNT;

        vm.startBroadcast(pk);

        // 2. Register BOTH campaigns idempotently.
        if (!flagshipRegistered) {
            rc.registerCampaign(flagshipId, IReleaseController.ReleaseType.PARAMETRIC);
            console2.log("DemoSeed: registered PARAMETRIC flagship (ph-typhoon-2025)");
        } else {
            console2.log("DemoSeed: flagship already registered - skip");
        }

        if (!milestoneRegistered) {
            rc.registerCampaign(milestoneId, IReleaseController.ReleaseType.MILESTONE);
            console2.log("DemoSeed: registered MILESTONE (id-rural-school-supplies)");
        } else {
            console2.log("DemoSeed: milestone already registered - skip");
        }

        // Scoped block: these locals are freed before the donation section below, so they
        // don't deepen the stack at the mint/approve/donate calls (avoids "stack too deep").
        {
            bytes32 fireId = keccak256(bytes(FIRE_SLUG));
            (bool fireRegistered,) = rc.campaignInfo(fireId);
            if (!fireRegistered) {
                rc.registerCampaign(fireId, IReleaseController.ReleaseType.PARAMETRIC);
                console2.log("DemoSeed: registered PARAMETRIC forest-fire (id-forest-fire-2026)");
            } else {
                console2.log("DemoSeed: forest-fire already registered - skip");
            }
        }

        // 3. Idempotent mint + approve + donate to the flagship. Guard on the
        // per-campaign cumulative tally (donatedByCampaign) — skip if already seeded.
        if (needDonation) {
            musdc.mint(deployer, SEED_AMOUNT);
            musdc.approve(address(pool), SEED_AMOUNT);
            uint256 baseOut = pool.donate(flagshipId, address(musdc), SEED_AMOUNT, consentHash);
            console2.log("DemoSeed: donated mUSDC to flagship, baseOut =", baseOut);
        } else {
            console2.log("DemoSeed: flagship already funded, donatedByCampaign =", flagshipDonated);
            console2.log("DemoSeed: donation skipped");
        }

        // 3b. Fund the forest-fire PARAMETRIC campaign above its console preset tranche so a
        // demo releaseTranche doesn't revert ExceedsCampaignFunds. (keccak inline — no local.)
        _seedDonation(pool, musdc, deployer, keccak256(bytes(FIRE_SLUG)), FIRE_SEED_AMOUNT, consentHash);

        // 4. Idempotent investIdle() (extracted to keep run()'s stack shallow).
        _investIdleIfSurplus(pool, musdc);

        vm.stopBroadcast();

        // 5. fire() intentionally NOT called: PARAMETRIC flagship left ARMED for the demo.
        console2.log("DemoSeed: done. Flagship left ARMED (not fired).");
    }

    // Idempotent mint+approve+donate bringing donatedByCampaign[campaignId] up to `amount`
    // (skips if already ≥). Own frame keeps run()'s stack shallow. Call within a broadcast.
    function _seedDonation(
        CharityPool pool,
        MockStablecoin token,
        address donor,
        bytes32 campaignId,
        uint256 amount,
        bytes32 consentHash
    ) internal {
        if (pool.donatedByCampaign(campaignId) >= amount) {
            console2.log("DemoSeed: campaign already funded - donation skipped");
            return;
        }
        token.mint(donor, amount);
        token.approve(address(pool), amount);
        uint256 baseOut = pool.donate(campaignId, address(token), amount, consentHash);
        console2.log("DemoSeed: donated mUSDC to campaign, baseOut =", baseOut);
    }

    // Deploy idle base above the liquidity buffer into the active adapter — only if
    // there is a surplus. Reconstructs the pool's own check so we never fire a pointless
    // tx, and short-circuits if the active adapter is unset (avoids AdapterNotSet revert).
    // Must be called within an active broadcast.
    function _investIdleIfSurplus(CharityPool pool, MockStablecoin musdc) internal {
        IYieldAdapter adapter = pool.halalMode() ? pool.halalAdapter() : pool.standardAdapter();
        if (address(adapter) == address(0)) {
            console2.log("DemoSeed: no active yield adapter set - investIdle skipped");
            return;
        }
        uint256 idle = musdc.balanceOf(address(pool)); // pool's idle base
        uint256 deployed = adapter.totalAssets(); // base currently in the adapter
        uint256 target = (idle + deployed) * pool.minLiquidityBufferBps() / MAX_BPS;
        if (idle > target) {
            pool.investIdle();
            console2.log("DemoSeed: investIdle deployed surplus base =", idle - target);
        } else {
            console2.log("DemoSeed: idle base at/below buffer - investIdle skipped (idle)", idle);
            console2.log("DemoSeed: buffer target was", target);
        }
    }
}
