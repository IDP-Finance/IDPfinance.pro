// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

interface IIDPOracle {

    function COORDINATOR() external view returns(address);
    function requestIds(uint index) external view returns(uint);
    function lastRequestId() external view returns(uint);

    function keyHash() external view returns(bytes32);
    function callbackGasLimit() external view returns(uint32);
    function requestConfirmations() external view returns(uint16);
    function numWords() external view returns(uint32);

    function allowedCaller(address target) external view returns(bool);
    function requestCaller(uint requestId) external view returns(address);
    function s_requests(uint requestId) external view returns(RequestStatus memory);

    struct RequestStatus {
        bool fulfilled; 
        bool exists; 
    }

    function setAllowedCaller(address target) external;

    function setKeyHash(bytes32 newKeyHash) external;

    function setCallbackGasLimit(uint32 newCallbackGasLimit) external;

    function setRequestConfirmations(uint16 newRequestConfirmations) external;

    function setNumWords(uint32 newNumWords) external;

    function requestRandomWords() external returns(uint256 requestId);

    function getRequestStatus(uint256 requestId) external view returns(bool fulfilled, uint256[] memory randomWords);

}