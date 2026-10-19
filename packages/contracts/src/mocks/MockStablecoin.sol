// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockStablecoin
/// @notice Testnet-only ERC20 with 6 decimals and a PUBLIC faucet-style mint.
///         Deployed as mUSDC, mXSGD, mIDRX for the demo. Not for production use.
contract MockStablecoin is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    /// @inheritdoc ERC20
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Public mint — anyone can mint for testnet/demo convenience.
    /// @param to Recipient of the newly minted tokens.
    /// @param amount Amount to mint (6 decimals).
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
