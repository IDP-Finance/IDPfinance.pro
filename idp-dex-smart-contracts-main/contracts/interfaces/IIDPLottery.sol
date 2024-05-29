// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

interface IIDPLottery {

    function vaultFeeInterest() external view returns(uint);
    function totalLotteries() external view returns(uint);
    function storedFee() external view returns(uint);
    function protocolToken() external view returns(address);
    function vault() external view returns(address);
    function oracle() external view returns(address);
    function autoRefillEnabled() external view returns(bool); 
    function swapConfig() external view returns(SwapConfig memory);

    function roundTypePaused(uint roundType) external view returns(uint);
    function roundTypeActive(uint roundType) external view returns(uint);
    function roundTypePrice(uint roundType) external view returns(uint);
    function lotteries(uint lotteryId) external view returns(Lottery memory);

    struct Lottery {
        uint startTime;
        uint endTime;
        uint ticketPrice;
        uint purchasedTickets;
        uint winningTicket;
        address winner;
        uint requestId;
    }

    struct SwapConfig {
        address router;
        uint amountOutMin;
        uint deadline;
        bool useIdpDex;
        address pegSwap;
        address coordinator;
        address peggedLinkToken;
        address linkToken;
        bytes subscriptionId;
    }

    function buyTicket(uint roundType, uint ticketsAmount) external returns(uint lotteryId);

    function claimRewards(uint[] memory lotteryIds) external;

    function setVaultFeeInterest(uint newVaultFeeInterest) external;

    function pauseRoundType(uint roundType) external;

    function unpauseRoundType(uint roundType) external; 

    function withdrawExcessToken(address token, uint amount, address receiver) external;

    function setAutoRefillEnabled(bool enabled) external;

    function setSwapConfig(SwapConfig calldata newConfig) external;

    function getTicketOwner(uint lotteryId, uint ticketNumber) external view returns(address owner);

    function getRoundParticipants(uint lotteryId) external view returns(address[10] memory participantsList);

    function getActiveRound(uint roundType) external view returns(uint activeRoundId);

    function getRandomNumber(uint requestId) external view returns(uint randomNumber);

    function getProtocolFee(uint ticketsAmount, uint ticketPrice) external pure returns(uint feeAmount);

}