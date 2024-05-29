// SPDX-License-Identifier: MIT
pragma solidity =0.5.16;

import "./IDPPair.sol";

import "../interfaces/IIDPFactory.sol";

import "../libraries/Ownable2Step.sol";
import "../libraries/FeeConfigLibrary.sol";

contract IDPFactory is Ownable2Step, IIDPFactory {

    address public feeTo;
    address public protocolToken;
    address public router;

    address[] public allPairs;

    mapping(address => bool) public stableToken;
    mapping(address => mapping(address => address)) public getPair;
    
    event PairCreated(address indexed token0, address indexed token1, address pair, bool stableFeeType, uint allPairsLength);

    constructor(address admin, address _protocolToken) public Ownable2Step(admin) {
        protocolToken = _protocolToken;
    }

    /**
     * @notice function to set {router} address
     * @param _router new {router} address
     * @notice only {owner} available
     * @notice should be called only by dev
     */
    function setRouter(address _router) external onlyOwner() {
        router = _router;
    }

    /**
     * @notice function to set {feeTo} address
     * @param _feeTo new {feeTo} address
     * @notice only {owner} available
     */
    function setFeeTo(address _feeTo) external onlyOwner() {
        feeTo = _feeTo;
    }
    
    /**
     * @notice function to create {IDPPair} liquidity pool
     * @param tokenA first token
     * @param tokenB second token
     * @param stableFeeToken swap fee interest flag
     * @notice one of tokens have to be {protocolToken}
     * @notice only {owner} or {router} available
     * @return pair {IDPPair} liquidity pool address
     */
    function createPair(address tokenA, address tokenB, bool stableFeeToken) external returns(address pair) {
        require(msg.sender == router || msg.sender == owner(), "IDPFactory: FORBIDDEN");
        if(tokenA == protocolToken){
            if(stableFeeToken) stableToken[tokenB] = true;
        } else {
            require(tokenB == protocolToken, "IDPFactory: PROTOCOL_TOKEN_ABSENT");
            if(stableFeeToken) stableToken[tokenA] = true;
        }
        require(tokenA != tokenB, "IDPFactory: IDENTICAL_ADDRESSES");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "IDPFactory: ZERO_ADDRESS");
        require(getPair[token0][token1] == address(0), "IDPFactory: PAIR_EXISTS"); // single check is sufficient
        bytes memory bytecode = type(IDPPair).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        IIDPPair(pair).initialize(token0, token1, FeeConfigLibrary.getPairFee(stableFeeToken));
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair; // populate mapping in the reverse direction
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, stableFeeToken, allPairs.length);
    }

    /**
     * @notice view function to get {stableToken} data
     * @param path tokens array
     * @return stableTokenData {stableToken} data array
     */
    function getStableTokenData(address[] calldata path) external view returns(bool[] memory stableTokenData) {
        stableTokenData = new bool[](path.length);
        for(uint i; path.length > i; i++) stableTokenData[i] = stableToken[path[i]];
    }

    /**
     * @notice view function to get {allPairs} array length
     * @return {allPairs} array length
     */
    function allPairsLength() external view returns(uint) {
        return allPairs.length;
    }
} 