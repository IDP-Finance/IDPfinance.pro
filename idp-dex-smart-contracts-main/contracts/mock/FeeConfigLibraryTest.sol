// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0;

import "../libraries/FeeConfigLibrary.sol";

contract FeeConfigLibraryTest {

    function getLibraryFee(bool stableFee) external pure returns(uint fee) {
        return FeeConfigLibrary.getFee(stableFee);
    }

    function getLibraryPairFee(bool stableFee) external pure returns(uint fee) {
        return FeeConfigLibrary.getPairFee(stableFee);
    }

}