// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "../interfaces/IIDPLottery.sol";
import "../interfaces/IIDPOracle.sol";

contract IDPLotteryReader {

    address public immutable lottery;
    address public immutable oracle;

    constructor(address _lottery, address _oracle) {
        lottery = _lottery;
        oracle = _oracle;
    }
    
    function getUnlclaimedLotteries(
        uint startIndex, 
        uint amount
    ) external view returns(uint[] memory unclaimedLotteries) {
        uint _totalLotteries = IIDPLottery(lottery).totalLotteries();
        if(startIndex >= _totalLotteries) return unclaimedLotteries;
        if(startIndex + amount >= _totalLotteries) amount = _totalLotteries - startIndex;

        (uint _index, uint[] memory _lotteries) = (0, new uint[](amount));
        for(uint i = startIndex; startIndex + amount > i; i++){
            if(IIDPLottery(lottery).lotteries(i).winner == address(0)){
                _lotteries[_index] = i;
                _index++;
            }
        }

        unclaimedLotteries = new uint[](_index);
        for(uint i; _index > i; i++) unclaimedLotteries[i] = _lotteries[i];
    }

    function getParticipiatedLotteries(
        address user, 
        uint startIndex, 
        uint amount
    ) external view returns(uint[] memory participiatedLotteries) {
        uint _totalLotteries = IIDPLottery(lottery).totalLotteries();
        if(startIndex >= _totalLotteries) return participiatedLotteries;
        if(startIndex + amount >= _totalLotteries) amount = _totalLotteries - startIndex;

        (uint _index, uint[] memory _participiatedLotteries) = (0, new uint[](amount));
        for(uint i = startIndex; startIndex + amount > i; i++){
            address[10] memory _participantsList = IIDPLottery(lottery).getRoundParticipants(i);
            for(uint j; 10 > j; j++){
                if(_participantsList[j] == user){
                    _participiatedLotteries[_index] = i;
                    _index++;
                    break;
                }
            }
        }

        participiatedLotteries = new uint[](_index);
        for(uint i; _index > i; i++) participiatedLotteries[i] = _participiatedLotteries[i];
    }

    function getWonLotteries(
        address user, 
        uint startIndex, 
        uint amount
    ) external view returns(uint[] memory wonLotteries) {
        uint _totalLotteries = IIDPLottery(lottery).totalLotteries();
        if(startIndex >= _totalLotteries) return wonLotteries;
        if(startIndex + amount >= _totalLotteries) amount = _totalLotteries - startIndex;

        (uint _index, uint[] memory _wonLotteries) = (0, new uint[](amount));
        for(uint i = startIndex; startIndex + amount > i; i++){
            uint _requestId = IIDPLottery(lottery).lotteries(i).requestId;
            if(!IIDPOracle(oracle).s_requests(_requestId).fulfilled) continue;
            if(IIDPLottery(lottery).getTicketOwner(i, IIDPLottery(lottery).getRandomNumber(_requestId)) == user){
                _wonLotteries[_index] = i;
                _index++;
            }
        }

        wonLotteries = new uint[](_index);  
        for(uint i; _index > i; i++) wonLotteries[i] = _wonLotteries[i];
    }

    function getUnclaimedWonLotteries(
        address user, 
        uint startIndex, 
        uint amount
    ) external view returns(uint[] memory unclaimedWonLotteries) {
        uint _totalLotteries = IIDPLottery(lottery).totalLotteries();
        if(startIndex >= _totalLotteries) return unclaimedWonLotteries;
        if(startIndex + amount >= _totalLotteries) amount = _totalLotteries - startIndex;

        (uint _index, uint[] memory _wonLotteries) = (0, new uint[](amount));
        for(uint i = startIndex; startIndex + amount > i; i++){
            uint _requestId = IIDPLottery(lottery).lotteries(i).requestId;
            if(!IIDPOracle(oracle).s_requests(_requestId).fulfilled) continue;
            uint _ticket = IIDPLottery(lottery).getRandomNumber(_requestId);
            if(
                IIDPLottery(lottery).getTicketOwner(i, _ticket) == user && 
                IIDPLottery(lottery).lotteries(i).winner == address(0)
            ){
                _wonLotteries[_index] = i;
                _index++;
            }
        }

        unclaimedWonLotteries = new uint[](_index);
        for(uint i; _index > i; i++) unclaimedWonLotteries[i] = _wonLotteries[i];
    }
}