// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol"; 
import "@openzeppelin/contracts/access/Ownable2Step.sol"; 

import "../interfaces/IERC20Extended.sol";

contract IDPVault is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint public constant ACCURACY = 1e18;
    uint public constant DENOMINATOR = 1000000; // 100%

    uint public constant SUPPLY_UPDATE_KINK = 100000e18;
    uint public constant SUPPLY_UPDATE_AMOUNT = 1000000e18;

    uint public constant MAX_PROTOCOL_FEE_INTEREST = 1000; // 0.1%

    uint public protocolFeeInterest;
    uint public depositReserve;
    uint public protocolReserve;

    address public immutable protocolToken;
    address public immutable depositToken;

    address[] public feeReceivers;
    mapping(address => bool) public feeReceiverExist;

    event Purchased(address account, uint amountIn, uint amountOut, uint protocolFee);
    event Sold(address account, uint amountIn, uint amountOut);
    event FeeDistributed(address account, uint feeAmount);
    event SupplyUpdated(uint additionalAmount, uint newTotalSupply);

    constructor(
        address _admin, 
        address _protocolToken, 
        address _depositToken
    ) Ownable(_admin) {
        protocolToken = _protocolToken;
        depositToken = _depositToken;

        protocolFeeInterest = 1000; // 0.1%
    }

    /**
     * @notice function to purchase {protocolToken} for {depositToken}
     * @param amountIn {depositToken} amount to pay
     * @param expectedAmountOut expected {protocolToken} amount to receive
     * @notice one of params have to be zero
     * @notice one of params have to be non zero
     * @return amountOut purchased {protocolToken} amount
     * @return protocolFee stored {protocolToken} fee amount
     */
    function buyToken(
        uint amountIn, 
        uint expectedAmountOut
    ) external nonReentrant() returns(uint amountOut, uint protocolFee) {
        require(amountIn > 0 || expectedAmountOut > 0, "IDPVault: invalid inputs");
        require(amountIn == 0 || expectedAmountOut == 0, "IDPVault: invalid inputs");
        if(amountIn == 0) amountIn = getAmountIn(expectedAmountOut);
        (amountOut, protocolFee) = getAmountOut(amountIn);

        uint _poolAmountOut = amountOut + protocolFee;

        require(SUPPLY_UPDATE_AMOUNT >= _poolAmountOut, "IDPVault: invalid amountOut"); 

        supplyUpdate(_poolAmountOut);
        tokensTransfer(amountIn, amountOut, protocolFee);

        emit Purchased(msg.sender, amountIn, amountOut, protocolFee);
    }

    /**
     * @notice function to sell {protocolToken} for {depositToken}
     * @param amountIn {protocolToken} amount to pay
     * @return amountOut received {depositToken} amount
     */
    function sellToken(uint amountIn) external nonReentrant() returns(uint amountOut) {
        require(amountIn > 0, "IDPVault: invalid amountIn");

        amountOut = getDisposalAmountOut(amountIn);

        depositReserve -= amountOut;
        protocolReserve += amountIn;

        IERC20(depositToken).safeTransfer(msg.sender, amountOut);
        IERC20(protocolToken).safeTransferFrom(msg.sender, address(this), amountIn); 

        emit Sold(msg.sender, amountIn, amountOut);
    }

    /**
     * @notice function to set {protocolFeeInterest} value
     * @param newProtocolFeeInterest new {protocolFeeInterest} value
     * @notice only {owner} available
     * @notice DENOMINATOR == 1000000 == 100%
     */
    function setProtocolFeeInterest(uint newProtocolFeeInterest) external onlyOwner() {
        require(MAX_PROTOCOL_FEE_INTEREST >= newProtocolFeeInterest, "IDPVault: invalid value");
        protocolFeeInterest = newProtocolFeeInterest;
    }

    /**
     * @notice function to add {feeReceivers} address
     * @param feeReceiver new {feeReceivers} address
     * @notice only {owner} available
     */
    function setFeeReceiver(address feeReceiver) external onlyOwner() {
        require(!feeReceiverExist[feeReceiver], "IDPVault: included");
        feeReceivers.push(feeReceiver);
        feeReceiverExist[feeReceiver] = true;
    }

    /**
     * @notice function to delete {feeReceivers} address
     * @param feeReceiver {feeReceivers} address to delete
     * @notice only {owner} available
     */
    function deleteFeeReceiver(address feeReceiver) external onlyOwner() {
        require(feeReceiverExist[feeReceiver], "IDPVault: not included");

        for(uint i; feeReceivers.length > i; i++){
            if(feeReceivers[i] == feeReceiver){
                feeReceivers[i] = feeReceivers[feeReceivers.length - 1];
                feeReceivers.pop();
                feeReceiverExist[feeReceiver] = false;
                break;
            }
        }
    }

    /**
     * @notice function to withdraw excess token
     * @param token token address to withdraw
     * @param amount token amount to withdraw
     * @param receiver withdrawed tokens receiver
     * @notice only {owner} available
     */
    function withdrawExcessToken(address token, uint amount, address receiver) external nonReentrant() onlyOwner() {
        require(amount > 0, "IDPVault: invalid amount");
        require(receiver != address(0), "IDPVault: zero address");
        if(token == address(0)){
            (bool _success, ) = receiver.call{value: amount}(new bytes(0));
            require(_success, "IDPVault: ETH transfer failed");
        } else {
            if(token == protocolToken){
                require(IERC20(protocolToken).balanceOf(address(this)) > protocolReserve + amount, "IDPVault: excess token absent");
            }

            if(token == depositToken){
                require(IERC20(depositToken).balanceOf(address(this)) > depositReserve + amount, "IDPVault: excess token absent");
            }

            IERC20(token).safeTransfer(receiver, amount);
        }
    }

    /**
     * @notice function to distribute received {protocolToken} like fee among {IDPVault} and {feeReceivers}
     * @param feeAmount {protocolToken} amount to distribute
     * @param vaultFeeInterest fee interest to refill {protocolReserve}
     * @notice {protocolToken} tokens have to transfered to {IDPVault} before call
     */
    function distributeFee(uint feeAmount, uint vaultFeeInterest) external nonReentrant() {
        require(feeAmount > 0, "IDPVault: invalid feeAmount");
        require(DENOMINATOR >= vaultFeeInterest, "IDPVault: invalid vaultFeeInterest");
        require(IERC20(protocolToken).balanceOf(address(this)) >= protocolReserve + feeAmount, "IDPVault: invalid balance");

        (uint _feeReceiversLength, uint _protocolFee) = (feeReceivers.length, 0);

        if(_feeReceiversLength == 0){
            protocolReserve += feeAmount;
        } else {
            if(vaultFeeInterest > 0){
                _protocolFee = feeAmount * vaultFeeInterest / DENOMINATOR;
                protocolReserve += _protocolFee;
                feeAmount -= _protocolFee;
            } 

            if(feeAmount > 0){
                uint _amount = feeAmount / _feeReceiversLength;
                for(uint i; _feeReceiversLength > i; i++) IERC20(protocolToken).safeTransfer(feeReceivers[i], _amount);
            }
        }

        emit FeeDistributed(msg.sender, feeAmount + _protocolFee);
    }

    function renounceOwnership() public override onlyOwner() {
        revert();
    }

    /**
     * @notice view function to get {feeReceivers} array length
     * @return feeReceiversLength {feeReceivers} array length
     */
    function getFeeReceiversLength() external view returns(uint feeReceiversLength) {
        return feeReceivers.length;
    }

    /**
     * @notice view function to get current disposal {protocolToken} price
     * @return currentDisposalPrice current disposal {protocolToken} price
     */
    function getCurrentDisposalPrice() public view returns(uint currentDisposalPrice) {
        if(depositReserve == 0) return ACCURACY;
        uint _totalSupply = IERC20(protocolToken).totalSupply();
        uint _circulationSupply = _totalSupply > protocolReserve ? _totalSupply - protocolReserve : ACCURACY;
        return depositReserve * ACCURACY / _circulationSupply;
    }

    /**
     * @notice view function to get {depositToken} amount to pay for exact {protocolToken} received amount
     * @param amountOut exact {protocolToken} amount to receive
     * @return amountIn {depositToken} amount to pay
     */
    function getAmountIn(uint amountOut) public view returns(uint amountIn) {
        if(feeReceivers.length == 0) return amountOut;
        return amountOut * DENOMINATOR / (DENOMINATOR - protocolFeeInterest);
    }

    /**
     * @notice view function to get {protocolToken} amount to receive for exact {depositToken} payed amount
     * @param amountIn exact {depositToken} amount to pay
     * @return amountOut {protocolToken} amount to receive
     * @return protocolFee {protocolToken} fee amount to store
     */
    function getAmountOut(uint amountIn) public view returns(uint amountOut, uint protocolFee) {
        uint _protocolFeeInterest = feeReceivers.length > 0 ? protocolFeeInterest : 0;
        protocolFee = amountIn * _protocolFeeInterest / DENOMINATOR;
        amountOut = amountIn - protocolFee;
    }

    /**
     * @notice view function to get {depositToken} amount to receive for exact {protocolToken} payed amount
     * @param amountIn exact {protocolToken} amount to pay
     * @return amountOut {depositToken} amount to receive
     */
    function getDisposalAmountOut(uint amountIn) public view returns(uint amountOut) {
        return amountIn * getCurrentDisposalPrice() / ACCURACY;
    }

    function supplyUpdate(uint poolAmountOut) internal {
        if(poolAmountOut >= protocolReserve || SUPPLY_UPDATE_KINK >= protocolReserve - poolAmountOut){
            IERC20Extended(protocolToken).mint(address(this), SUPPLY_UPDATE_AMOUNT);
            protocolReserve += SUPPLY_UPDATE_AMOUNT;

            emit SupplyUpdated(SUPPLY_UPDATE_AMOUNT, IERC20(protocolToken).totalSupply());
        } 
    }

    function tokensTransfer(uint amountIn, uint userAmountOut, uint feeAmountOut) internal {
        IERC20(depositToken).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(protocolToken).safeTransfer(msg.sender, userAmountOut);

        depositReserve += amountIn;
        protocolReserve -= userAmountOut;

        uint _feeReceiversLength = feeReceivers.length;
        
        if(_feeReceiversLength > 0 && feeAmountOut > 0){
            uint _amount = feeAmountOut / _feeReceiversLength;
            protocolReserve -= feeAmountOut;
            for(uint i; _feeReceiversLength > i; i++) IERC20(protocolToken).safeTransfer(feeReceivers[i], _amount);

            emit FeeDistributed(msg.sender, feeAmountOut);
        }
    }
} 