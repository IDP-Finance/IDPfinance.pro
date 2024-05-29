// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract PegSwap {
    using SafeERC20 for IERC20;

    function swap(
        uint256 amount,
        address source,
        address target
    ) external {

        IERC20(source).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(target).safeTransfer(msg.sender, amount);
        
    }
}