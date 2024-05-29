// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IERC20Extended is IERC20 {

    function mint(address to, uint amount) external;

    function burn(uint value) external;

    function burnFrom(address account, uint value) external;

}