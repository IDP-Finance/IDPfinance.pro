// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0;

library FeeConfigLibrary {

    uint internal constant BASE_FEE = 9980;
    uint internal constant STABLE_FEE = 9998;
    uint internal constant PAIR_BASE_FEE = 1;
    uint internal constant PAIR_STABLE_FEE = 10;

    function getFee(bool stableFee) internal pure returns(uint fee) {
        return stableFee ? STABLE_FEE : BASE_FEE;
    }

    function getPairFee(bool stableFee) internal pure returns(uint fee) {
        return stableFee ? PAIR_STABLE_FEE : PAIR_BASE_FEE;
    }

}