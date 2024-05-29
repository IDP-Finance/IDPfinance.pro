// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "@openzeppelin/contracts/access/Ownable2Step.sol"; 

import { VRFCoordinatorV2Interface } from "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import { VRFConsumerBaseV2 } from "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";

contract IDPOracle is VRFConsumerBaseV2, Ownable2Step {

    uint32 public constant MAX_NUM_WORDS = 500;

    uint16 public constant MAX_REQUEST_CONFIRMATIONS = 200;
    uint16 public constant MIN_REQUEST_CONFIRMATIONS = 3;

    uint32 public constant MAX_GAS_LIMIT = 2500000;
    uint32 public constant MIN_GAS_LIMIT = 200000;

    VRFCoordinatorV2Interface public COORDINATOR;

    uint64 private s_subscriptionId;

    uint256[] public requestIds;
    uint256 public lastRequestId;

    // testnet values
    bytes32 public keyHash = 0xd4bb89654db74673a187bd804519e65e3f71a52bc55f11da7601a13dcf505314;
    uint32 public callbackGasLimit = 200000;
    uint16 public requestConfirmations = 5;
    uint32 public numWords = 1;

    mapping(address => bool) public allowedCaller;
    mapping(uint256 => address) public requestCaller;
    mapping(uint256 => RequestStatus) public s_requests;
    
    struct RequestStatus {
        bool fulfilled;
        bool exists;
        uint256[] randomWords;
    }

    event RequestSent(uint256 requestId, uint32 numWords);
    event RequestFulfilled(uint256 requestId, uint256[] randomWords);

    constructor(
        address admin, 
        address coordinator, 
        uint64 subscriptionId
    ) VRFConsumerBaseV2(coordinator) Ownable(admin) {
        COORDINATOR = VRFCoordinatorV2Interface(coordinator);
        s_subscriptionId = subscriptionId;
    }

    /**
     * @notice function to add or delete {allowedCaller} address  
     * @param target allowed address 
     * @notice only {owner} available
     */
    function setAllowedCaller(address target) external onlyOwner() {
        allowedCaller[target] = !allowedCaller[target];
    }

    /**
     * @notice function to set new {keyHash} value 
     * @param newKeyHash new {keyHash} value
     * @notice only {owner} available
     * @notice should be called only by dev
     */
    function setKeyHash(bytes32 newKeyHash) external onlyOwner() {
        keyHash = newKeyHash;
    }

    /**
     * @notice function to set new {callbackGasLimit} value 
     * @param newCallbackGasLimit new {callbackGasLimit} value
     * @notice only {owner} available
     * @notice should be called only by dev
     */
    function setCallbackGasLimit(uint32 newCallbackGasLimit) external onlyOwner() {
        require(MAX_GAS_LIMIT > newCallbackGasLimit, "IDPOracle: exceeded max");
        require(newCallbackGasLimit >= MIN_GAS_LIMIT, "IDPOracle: below min");
        callbackGasLimit = newCallbackGasLimit;
    }

    /**
     * @notice function to set new {requestConfirmations} value 
     * @param newRequestConfirmations new {requestConfirmations} value
     * @notice only {owner} available
     * @notice should be called only by dev
     */
    function setRequestConfirmations(uint16 newRequestConfirmations) external onlyOwner() {
        require(MAX_REQUEST_CONFIRMATIONS > newRequestConfirmations, "IDPOracle: exceeded max");
        require(newRequestConfirmations >= MIN_REQUEST_CONFIRMATIONS, "IDPOracle: below min");
        requestConfirmations = newRequestConfirmations;
    }

    /**
     * @notice function to set new {numWords} value 
     * @param newNumWords new {numWords} value
     * @notice only {owner} available
     * @notice should be called only by dev
     */
    function setNumWords(uint32 newNumWords) external onlyOwner() {
        require(MAX_NUM_WORDS > newNumWords, "IDPOracle: exceeded max");
        require(newNumWords > 0, "IDPOracle: below min");
        numWords = newNumWords;
    }

    /**
     * @notice function to request for a new random value 
     * @notice only {allowedCaller} available
     * @return requestId ID of random value request
     */
    function requestRandomWords() external returns(uint256 requestId) {
        require(allowedCaller[msg.sender], "IDPOracle: forbidden");

        requestId = COORDINATOR.requestRandomWords(
            keyHash,
            s_subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            numWords
        );

        s_requests[requestId] = RequestStatus({
            randomWords: new uint256[](0),
            exists: true,
            fulfilled: false
        });

        requestIds.push(requestId);
        lastRequestId = requestId;
        requestCaller[requestId] = msg.sender;

        emit RequestSent(requestId, numWords);
    }

    /**
     * @notice view function to get data about random value request
     * @param requestId ID of random value request
     * @return fulfilled response ready flag
     * @return randomWords requested random values array
     */
    function getRequestStatus(uint256 requestId) external view returns(bool fulfilled, uint256[] memory randomWords) {
        require(s_requests[requestId].exists, "IDPOracle: request not found");
        RequestStatus memory request = s_requests[requestId];
        return (request.fulfilled, request.randomWords);
    }

    function renounceOwnership() public override onlyOwner() {
        revert();
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        require(s_requests[requestId].exists, "IDPOracle: request not found");
        s_requests[requestId].fulfilled = true;
        s_requests[requestId].randomWords = randomWords;

        emit RequestFulfilled(requestId, randomWords);
    }
}