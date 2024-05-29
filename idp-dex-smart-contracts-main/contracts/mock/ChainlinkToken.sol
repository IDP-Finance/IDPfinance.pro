// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ChainlinkToken is ERC20 {

    constructor() ERC20("ChainlinkToken", "ChainlinkToken") {
        _mint(msg.sender, 1000000000000000e18);
    }

    function transferAndCall(
        address _to, 
        uint _value, 
        bytes memory /*_data*/
    ) public returns(bool success) {
        super.transfer(_to, _value);
        return true;
    }
}