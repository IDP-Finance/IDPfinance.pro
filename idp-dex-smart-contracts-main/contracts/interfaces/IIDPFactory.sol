// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0;

interface IIDPFactory {
    event PairCreated(address indexed token0, address indexed token1, address pair, bool stableFeeType, uint allPairsLength);

    function feeTo() external view returns(address);

    function getPair(address tokenA, address tokenB) external view returns(address pair);
    function stableToken(address pair) external view returns(bool result);
    function getStableTokenData(address[] calldata path) external view returns(bool[] memory stableTokenData);
    function allPairs(uint index) external view returns(address pair);
    function allPairsLength() external view returns(uint);
    function router() external view returns(address); 
    function protocolToken() external view returns(address);

    function createPair(address tokenA, address tokenB, bool stableFeeToken) external returns(address pair);

    function setFeeTo(address) external;
}