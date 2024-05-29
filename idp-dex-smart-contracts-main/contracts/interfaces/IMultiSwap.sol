// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

interface IRouter {

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns(uint[] memory amounts);

}

interface IPegSwap {

    function swap(
        uint256 amount,
        address source,
        address target
    ) external;

}

interface ILinkToken {

    function transferAndCall(
        address to, 
        uint value, 
        bytes memory data
    ) external returns(bool success);

}

interface IIDPRouter {

    function computeFeeAmount(
        uint amountIn, 
        address[] calldata path
    ) external view returns(uint feeOutAmount);

}