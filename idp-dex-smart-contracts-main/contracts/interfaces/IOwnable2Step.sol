// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

interface IOwnable2Step {

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);

    function transferOwnership(address newOwner) external;

    function acceptOwnership() external;

    function owner() external view returns(address);

    function pendingOwner() external view returns(address);
    
}