// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

contract IDPToken is ERC20, Ownable2Step {
    
    address public vault;

    constructor(address admin) ERC20("Investment Decentralized Platform", "IDP") Ownable(admin) {}

    /**
     * @notice function to set {vault} address
     * @param newVault new {vault} address
     * @notice if {newVault} have non zero value called only once
     * @notice only {owner} available
     */
    function setVault(address newVault) external onlyOwner() {
        require(vault == address(0), "IDPToken: zero address");
        vault = newVault;
    }

    /**
     * @notice function to mint {IDPToken} tokens
     * @param to minted tokens receiver address
     * @param amount {IDPToken} tokens amount to mint
     * @notice only {vault} available
     */
    function mint(address to, uint256 amount) external {
        require(msg.sender == vault, "IDPToken: forbidden");
        _mint(to, amount);
    }
}