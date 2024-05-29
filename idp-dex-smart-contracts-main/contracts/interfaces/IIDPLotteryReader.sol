// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

interface IIDPLotteryReader {

    function lottery() external view returns(address);
    function oracle() external view returns(address);

    function getUnlclaimedLotteries(
        uint startIndex, 
        uint amount
    ) external view returns(uint[] memory unclaimedLotteries);

    function getParticipiatedLotteries(
        address user, 
        uint startIndex, 
        uint amount
    ) external view returns(uint[] memory participiatedLotteries);

    function getWonLotteries(
        address user, 
        uint startIndex, 
        uint amount
    ) external view returns(uint[] memory wonLotteries);

    function getUnclaimedWonLotteries(
        address user, 
        uint startIndex, 
        uint amount
    ) external view returns(uint[] memory unclaimedWonLotteries);

}