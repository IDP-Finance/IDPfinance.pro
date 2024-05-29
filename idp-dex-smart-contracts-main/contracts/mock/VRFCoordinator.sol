// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

interface VRFv2Consumer {

    function rawFulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external;

}

contract VRFCoordinator {

    uint public nonce = 1;

    function requestRandomWords(
        bytes32 /*keyHash*/,
        uint64 /*subId*/,
        uint16 /*requestConfirmations*/,
        uint32 /*callbackGasLimit*/,
        uint32 /*numWords*/
    ) external returns(uint256 requestId) {
        requestId = nonce++;
    }

    function provideRandomData(address target, uint256 requestId, uint256[] memory randomWords) external {
        VRFv2Consumer(target).rawFulfillRandomWords(requestId, randomWords);
    }

}