// SPDX-License-Identifier: MIT
pragma solidity >=0.5.16;

contract Ownable2Step {

    address private _owner;
    address private _pendingOwner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    constructor(address initialOwner) public {
        require(initialOwner != address(0), "Ownable2Step: zero address");

        _transferOwnership(initialOwner);
    }

    function transferOwnership(address newOwner) external onlyOwner() {
        _pendingOwner = newOwner;

        emit OwnershipTransferStarted(owner(), newOwner);
    }

    function acceptOwnership() external {
        address sender = msg.sender;
        require(pendingOwner() == sender, "Ownable2Step: you are not a pending owner");

        _transferOwnership(sender);
        delete _pendingOwner;
    }

    function owner() public view returns(address) {
        return _owner;
    }

    function pendingOwner() public view returns(address) {
        return _pendingOwner;
    }

    function _checkOwner() internal view {
        require(owner() == msg.sender, "Ownable2Step: you are not an owner");
    }

    function _transferOwnership(address newOwner) internal {
        address oldOwner = _owner;
        _owner = newOwner;

        emit OwnershipTransferred(oldOwner, newOwner);
    }
}