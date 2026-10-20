// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReleaseController} from "../src/release/ReleaseController.sol";
import {IReleaseController} from "../src/release/IReleaseController.sol";

contract ReleaseControllerTest is Test {
    ReleaseController internal rc;

    address internal owner = address(this);
    address internal stranger = makeAddr("stranger");

    bytes32 internal constant PARAM = keccak256("disaster-campaign");
    bytes32 internal constant MILE = keccak256("education-campaign");

    // Mirrors for vm.expectEmit.
    event CampaignRegistered(bytes32 indexed campaignId, IReleaseController.ReleaseType releaseType);
    event TriggerFired(bytes32 indexed campaignId, string detail);
    event MilestoneApproved(bytes32 indexed campaignId, string detail);
    event TriggerRevoked(bytes32 indexed campaignId);

    function setUp() public {
        rc = new ReleaseController(owner);
        vm.warp(1_000_000); // non-zero, known timestamp so activatedAt assertions are meaningful
    }

    function _registerParam() internal {
        rc.registerCampaign(PARAM, IReleaseController.ReleaseType.PARAMETRIC);
    }

    function _registerMile() internal {
        rc.registerCampaign(MILE, IReleaseController.ReleaseType.MILESTONE);
    }

    // --- initial state / registration ---------------------------------------------------

    function test_InitialState() public view {
        assertEq(rc.owner(), owner, "owner set");
        assertFalse(rc.canRelease(PARAM), "unregistered not releasable");
        assertEq(rc.activatedAt(PARAM), 0, "unregistered activatedAt 0");
    }

    function test_Register_EmitsAndStores() public {
        vm.expectEmit(true, false, false, true, address(rc));
        emit CampaignRegistered(PARAM, IReleaseController.ReleaseType.PARAMETRIC);
        _registerParam();
        (bool registered, IReleaseController.ReleaseType t) = rc.campaignInfo(PARAM);
        assertTrue(registered, "registered");
        assertEq(uint8(t), uint8(IReleaseController.ReleaseType.PARAMETRIC), "type stored");
        assertFalse(rc.canRelease(PARAM), "registered but not yet active");
    }

    function test_Register_RevertZeroId() public {
        vm.expectRevert(ReleaseController.ZeroId.selector);
        rc.registerCampaign(bytes32(0), IReleaseController.ReleaseType.PARAMETRIC);
    }

    function test_Register_RevertAlreadyRegistered() public {
        _registerParam();
        vm.expectRevert(abi.encodeWithSelector(ReleaseController.AlreadyRegistered.selector, PARAM));
        rc.registerCampaign(PARAM, IReleaseController.ReleaseType.MILESTONE);
    }

    function test_Register_RevertNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        rc.registerCampaign(PARAM, IReleaseController.ReleaseType.PARAMETRIC);
    }

    // --- fire (parametric) --------------------------------------------------------------

    function test_Fire_ActivatesStampsEmits() public {
        _registerParam();
        vm.expectEmit(true, false, false, true, address(rc));
        emit TriggerFired(PARAM, "PAGASA signal #4");
        rc.fire(PARAM, "PAGASA signal #4");
        assertTrue(rc.canRelease(PARAM), "releasable after fire");
        assertEq(rc.activatedAt(PARAM), block.timestamp, "activatedAt == now");
    }

    function test_Fire_RevertNotRegistered() public {
        vm.expectRevert(abi.encodeWithSelector(ReleaseController.NotRegistered.selector, PARAM));
        rc.fire(PARAM, "x");
    }

    function test_Fire_RevertWrongType() public {
        _registerMile();
        vm.expectRevert(abi.encodeWithSelector(ReleaseController.WrongReleaseType.selector, MILE));
        rc.fire(MILE, "x");
    }

    function test_Fire_RevertAlreadyActive() public {
        _registerParam();
        rc.fire(PARAM, "first");
        vm.expectRevert(abi.encodeWithSelector(ReleaseController.AlreadyActive.selector, PARAM));
        rc.fire(PARAM, "second");
    }

    function test_Fire_RevertNonOwner() public {
        _registerParam();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        rc.fire(PARAM, "x");
    }

    // --- approveMilestone ---------------------------------------------------------------

    function test_ApproveMilestone_Activates() public {
        _registerMile();
        vm.expectEmit(true, false, false, true, address(rc));
        emit MilestoneApproved(MILE, "term 1 complete");
        rc.approveMilestone(MILE, "term 1 complete");
        assertTrue(rc.canRelease(MILE), "releasable after approve");
        assertEq(rc.activatedAt(MILE), block.timestamp, "activatedAt == now");
    }

    function test_ApproveMilestone_RevertWrongType() public {
        _registerParam();
        vm.expectRevert(abi.encodeWithSelector(ReleaseController.WrongReleaseType.selector, PARAM));
        rc.approveMilestone(PARAM, "x");
    }

    // --- revoke -------------------------------------------------------------------------

    function test_Revoke_ClearsAndAllowsReArm() public {
        _registerParam();
        rc.fire(PARAM, "first");
        uint256 firstAt = rc.activatedAt(PARAM);

        vm.expectEmit(true, false, false, false, address(rc));
        emit TriggerRevoked(PARAM);
        rc.revoke(PARAM);
        assertFalse(rc.canRelease(PARAM), "not releasable after revoke");
        assertEq(rc.activatedAt(PARAM), 0, "activatedAt cleared");

        // Re-arm re-stamps the clock at the new time.
        vm.warp(firstAt + 5 days);
        rc.fire(PARAM, "re-armed");
        assertTrue(rc.canRelease(PARAM), "releasable again");
        assertEq(rc.activatedAt(PARAM), block.timestamp, "clock re-stamped");
    }

    function test_Revoke_RevertNotRegistered() public {
        vm.expectRevert(abi.encodeWithSelector(ReleaseController.NotRegistered.selector, PARAM));
        rc.revoke(PARAM);
    }

    function test_Revoke_RevertNonOwner() public {
        _registerParam();
        rc.fire(PARAM, "x");
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        rc.revoke(PARAM);
    }

    // --- ownership ----------------------------------------------------------------------

    function test_RenounceOwnership_Reverts() public {
        vm.expectRevert(ReleaseController.OwnershipCannotBeRenounced.selector);
        rc.renounceOwnership();
    }
}
