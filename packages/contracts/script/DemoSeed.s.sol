// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {MockStablecoin} from "../src/mocks/MockStablecoin.sol";
import {CharityPool} from "../src/CharityPool.sol";
import {ReleaseController} from "../src/release/ReleaseController.sol";
import {IReleaseController} from "../src/release/IReleaseController.sol";

// OPTIONAL demo seeding (off the critical path). Registers ONE seeded campaign
// on-chain and makes a real mUSDC donation on Base Sepolia so the indexer surfaces
// a genuine `confirmed` ledger row (never fabricate confirmed data offchain). Uses
// the SAME campaignId preimage as the offchain seed: keccak256(bytes("ph-typhoon-2025")).
//
// Requires a funded owner key in an untracked .env:
//   forge script script/DemoSeed.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL \
//     --private-key $DEPLOYER_PRIVATE_KEY --broadcast
contract DemoSeed is Script {
    function run() external {
        string memory json = vm.readFile("./deployments/84532.json");
        CharityPool pool = CharityPool(vm.parseJsonAddress(json, ".CharityPool"));
        ReleaseController rc = ReleaseController(vm.parseJsonAddress(json, ".ReleaseController"));
        MockStablecoin musdc = MockStablecoin(vm.parseJsonAddress(json, ".mUSDC"));

        bytes32 campaignId = keccak256(bytes("ph-typhoon-2025"));
        bytes32 consentHash = keccak256("demo-consent"); // opaque salted commitment (demo)
        uint256 amount = 100e6; // 100 mUSDC (6 decimals)

        vm.startBroadcast();

        (bool registered,) = rc.campaignInfo(campaignId);
        if (!registered) {
            rc.registerCampaign(campaignId, IReleaseController.ReleaseType.PARAMETRIC);
        }

        musdc.mint(msg.sender, amount);
        musdc.approve(address(pool), amount);
        uint256 baseOut = pool.donate(campaignId, address(musdc), amount, consentHash);

        vm.stopBroadcast();

        console2.log("DemoSeed: donated 100 mUSDC, baseOut =", baseOut);
    }
}
