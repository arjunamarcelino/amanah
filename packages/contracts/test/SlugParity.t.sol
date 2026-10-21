// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

// Cross-language parity: the on-chain campaignId derivation (keccak256 of the
// UTF-8 slug bytes) MUST equal what the shared campaignIdFromSlug helper produces
// off-chain, or indexed events won't join to seeded metadata. The expected value
// is locked in packages/shared/test/shared.test.ts.
contract SlugParityTest is Test {
    function test_campaignIdFromSlug_parity() public pure {
        bytes32 expected = 0xbf7a34a4229c6d591cdbe7c0bb1287e840a73126b5758d58ae14f270ab9913d2;
        assertEq(keccak256(bytes("ph-typhoon-2025")), expected, "slug->campaignId drift vs @amanah/shared");
    }
}
