// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract StableToken is ERC20 {

    constructor() ERC20("StableToken", "StableToken") {
        _mint(msg.sender, 1000000000000000e18);
    }

    function transferEth(address payable receiver) external payable {
        selfdestruct(receiver);
    }

}