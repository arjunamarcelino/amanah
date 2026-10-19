// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MockStablecoin} from "../src/mocks/MockStablecoin.sol";
import {MockSwap} from "../src/mocks/MockSwap.sol";

/// @dev Test-only 18-decimal token to exercise the decimals guard.
contract Token18 is ERC20 {
    constructor() ERC20("Token 18", "T18") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MocksTest is Test {
    MockStablecoin internal usdc;
    MockStablecoin internal xsgd;
    MockSwap internal swap;

    address internal alice = makeAddr("alice");

    // Mirrors of MockSwap events for vm.expectEmit.
    event Swapped(address indexed caller, address indexed tokenIn, uint256 amountIn, uint256 baseOut);
    event TokenSupported(address indexed token, bool supported);

    function setUp() public {
        usdc = new MockStablecoin("Mock USDC", "mUSDC");
        xsgd = new MockStablecoin("Mock XSGD", "mXSGD");
        swap = new MockSwap(address(usdc));

        // Allowlist the non-base token so it can be swapped.
        swap.setSupported(address(xsgd), true);

        // Seed the swap with base liquidity so it can cover non-base swaps.
        usdc.mint(address(swap), 1_000_000e6);
    }

    function test_RevertWhenBaseIsZeroAddress() public {
        vm.expectRevert(MockSwap.ZeroAddress.selector);
        new MockSwap(address(0));
    }

    function test_SixDecimals() public view {
        assertEq(usdc.decimals(), 6);
        assertEq(xsgd.decimals(), 6);
    }

    function test_PublicMint() public {
        usdc.mint(alice, 1_000e6);
        assertEq(usdc.balanceOf(alice), 1_000e6);
    }

    function test_SwapNonBaseReturnsEqualBase() public {
        uint256 amountIn = 500e6;
        xsgd.mint(alice, amountIn);

        uint256 swapBaseBefore = usdc.balanceOf(address(swap));

        vm.startPrank(alice);
        xsgd.approve(address(swap), amountIn);
        uint256 out = swap.swapToBase(address(xsgd), amountIn);
        vm.stopPrank();

        assertEq(out, amountIn, "1:1 base out");
        assertEq(usdc.balanceOf(alice), amountIn, "alice received base");
        assertEq(xsgd.balanceOf(alice), 0, "alice spent tokenIn");
        assertEq(xsgd.balanceOf(address(swap)), amountIn, "swap holds tokenIn");
        assertEq(usdc.balanceOf(address(swap)), swapBaseBefore - amountIn, "swap paid out base");
    }

    function test_SwapBaseIsPassthrough() public {
        uint256 amountIn = 250e6;
        usdc.mint(alice, amountIn);

        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 swapBefore = usdc.balanceOf(address(swap));

        vm.prank(alice);
        uint256 out = swap.swapToBase(address(usdc), amountIn);

        assertEq(out, amountIn, "passthrough returns amountIn");
        assertEq(usdc.balanceOf(alice), aliceBefore, "alice balance unchanged");
        assertEq(usdc.balanceOf(address(swap)), swapBefore, "swap balance unchanged");
    }

    function test_EmitsSwappedOnNonBase() public {
        uint256 amountIn = 100e6;
        xsgd.mint(alice, amountIn);

        vm.startPrank(alice);
        xsgd.approve(address(swap), amountIn);

        vm.expectEmit(true, true, false, true, address(swap));
        emit Swapped(alice, address(xsgd), amountIn, amountIn);
        swap.swapToBase(address(xsgd), amountIn);
        vm.stopPrank();
    }

    function test_EmitsSwappedOnPassthrough() public {
        uint256 amountIn = 100e6;
        usdc.mint(alice, amountIn);

        vm.expectEmit(true, true, false, true, address(swap));
        emit Swapped(alice, address(usdc), amountIn, amountIn);
        vm.prank(alice);
        swap.swapToBase(address(usdc), amountIn);
    }

    function test_RevertWhenTokenNotSupported() public {
        MockStablecoin idrx = new MockStablecoin("Mock IDRX", "mIDRX");
        uint256 amountIn = 100e6;
        idrx.mint(alice, amountIn);

        vm.startPrank(alice);
        idrx.approve(address(swap), amountIn);
        vm.expectRevert(abi.encodeWithSelector(MockSwap.UnsupportedToken.selector, address(idrx)));
        swap.swapToBase(address(idrx), amountIn);
        vm.stopPrank();
    }

    function test_RevertWhenDecimalsMismatch() public {
        Token18 weird = new Token18();
        swap.setSupported(address(weird), true);

        uint256 amountIn = 1e18;
        weird.mint(alice, amountIn);

        vm.startPrank(alice);
        weird.approve(address(swap), amountIn);
        vm.expectRevert(abi.encodeWithSelector(MockSwap.DecimalsMismatch.selector, address(weird), uint8(18), uint8(6)));
        swap.swapToBase(address(weird), amountIn);
        vm.stopPrank();
    }

    function test_OnlyOwnerCanSetSupported() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        swap.setSupported(address(xsgd), false);
    }

    function test_SetSupportedZeroAddressReverts() public {
        vm.expectRevert(MockSwap.ZeroAddress.selector);
        swap.setSupported(address(0), true);
    }

    function test_SetSupportedEmitsEvent() public {
        MockStablecoin idrx = new MockStablecoin("Mock IDRX", "mIDRX");

        vm.expectEmit(true, false, false, true, address(swap));
        emit TokenSupported(address(idrx), true);
        swap.setSupported(address(idrx), true);

        assertTrue(swap.isSupported(address(idrx)));
    }
}
