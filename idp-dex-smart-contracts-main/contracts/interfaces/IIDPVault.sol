// SPDX-License-Identifier: MIT
pragma solidity >=0.6.6;

interface IIDPVault {

    function protocolFeeInterest() external view returns(uint);
    function depositReserve() external view returns(uint);
    function protocolReserve() external view returns(uint);
    function protocolToken() external view returns(address);
    function depositToken() external view returns(address);
    function feeReceivers(uint index) external view returns(address);
    function feeReceiverExist(address account) external view returns(bool);

    function buyToken(uint amountIn, uint expectedAmountOut) external returns(uint amountOut, uint protocolFee);

    function sellToken(uint amountIn) external returns(uint amountOut);

    function setProtocolFeeInterest(uint newProtocolFeeInterest) external;

    function setFeeReceiver(address feeReceiver) external;

    function deleteFeeReceiver(address feeReceiver) external;

    function withdrawExcessToken(address token, uint amount, address receiver) external;

    function distributeFee(uint feeAmount, uint vaultFeeInterest) external;

    function getFeeReceiversLength() external view returns(uint feeReceiversLength);

    function getCurrentDisposalPrice() external view returns(uint currentDisposalPrice);

    function getAmountIn(uint amountOut) external view returns(uint amountIn);

    function getAmountOut(uint amountIn) external view returns(uint amountOut, uint protocolFee);

    function getDisposalAmountOut(uint amountIn) external view returns(uint amountOut);

}