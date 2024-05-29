// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol"; 
import "@openzeppelin/contracts/access/Ownable2Step.sol"; 

import "../interfaces/IIDPVault.sol";
import "../interfaces/IIDPOracle.sol";
import "../interfaces/IMultiSwap.sol";

contract IDPLottery is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint public constant DENOMINATOR = 1000000; // 100%
    uint public constant FEE_INTEREST = 100000; // 10%

    uint public constant MAX_PARTICIPANTS = 10; 
    
    uint public vaultFeeInterest;
    uint public totalLotteries;
    uint public storedFee;

    address public immutable protocolToken;
    address public immutable vault;
    address public immutable oracle;

    bool public autoRefillEnabled;

    SwapConfig public swapConfig;

    mapping(uint => uint) public roundTypePaused;
    mapping(uint => uint) public roundTypeActive;
    mapping(uint => uint) public roundTypePrice;

    mapping(uint => Lottery) public lotteries;

    struct Lottery {
        uint startTime;
        uint endTime;
        uint ticketPrice;
        uint purchasedTickets;
        uint winningTicket;
        address winner;
        uint requestId;
        mapping(uint => address) ticketOwner;
    }

    struct SwapConfig {
        address router;
        address[] path;
        uint amountOutMin;
        uint deadline;
        bool useIdpDex;
        address pegSwap;
        address coordinator;
        address peggedLinkToken;
        address linkToken;
        bytes subscriptionId;
    }

    event AutoRefillSucceeds();
    event SubscriptionRefilled(uint amountToRefill);
    event AutoRefillFailed();
    event RoundStarted(address account, uint lotteryId, uint roundType);
    event TicketsPurchased(address account, uint lotteryId, uint ticketPrice, uint ticketsAmount);
    event RoundEnded(address account, uint lotteryId, uint roundType, uint requestId);
    event RewardClaimed(address account, uint lotteryId, uint winningTicket, address winner, uint reward);
    event FeeStored(uint feeAmount);

    constructor(
        address _admin, 
        address _protocolToken, 
        address _vault, 
        address _oracle
    ) Ownable(_admin) {
        protocolToken = _protocolToken;
        vault = _vault;
        oracle = _oracle;
        
        roundTypePrice[0] = 1e18;
        roundTypePrice[1] = 10e18;
        roundTypePrice[2] = 100e18;
        roundTypePrice[3] = 1000e18;
    }

    /**
     * @notice function to purchase {Lottery} tickets to participate for {protocolToken} reward
     * @param roundType ID of round type
     * @param ticketsAmount tickets amount to purchase
     * @return lotteryId {Lottery} ID which participation was
     */
    function buyTicket(uint roundType, uint ticketsAmount) external nonReentrant() returns(uint lotteryId) {
        uint _ticketPrice = roundTypePrice[roundType];

        require(_ticketPrice > 0, "IDPLottery: invalid roundType");
        require(ticketsAmount > 0, "IDPLottery: zero ticketsAmount");
        
        if(lotteries[roundTypeActive[roundType]].ticketPrice != _ticketPrice){
            roundTypeActive[roundType] = totalLotteries;
        }

        lotteryId = roundTypeActive[roundType];

        Lottery storage lottery = lotteries[lotteryId];

        if(roundTypePaused[roundType] > 0){
            require(lottery.startTime > 0 && roundTypePaused[roundType] >= lottery.startTime, "IDPLottery: paused");
        }

        require(MAX_PARTICIPANTS >= lottery.purchasedTickets + ticketsAmount, "IDPLottery: ticketsAmount exceeded");

        if(lottery.ticketPrice == 0){
            lottery.ticketPrice = _ticketPrice;
            lottery.startTime = block.timestamp;

            totalLotteries += 1;

            emit RoundStarted(msg.sender, lotteryId, roundType);
        }

        for(uint i = lottery.purchasedTickets; lottery.purchasedTickets + ticketsAmount > i; i++){
            lottery.ticketOwner[i] = msg.sender;
        }

        lottery.purchasedTickets += ticketsAmount;

        IERC20(protocolToken).safeTransferFrom(msg.sender, address(this), ticketsAmount * _ticketPrice);

        uint _feeAmount = getProtocolFee(ticketsAmount, _ticketPrice);

        if(!autoRefillEnabled){
            IERC20(protocolToken).safeTransferFrom(msg.sender, vault, _feeAmount);
            IIDPVault(vault).distributeFee(_feeAmount, vaultFeeInterest);
        } else {
            IERC20(protocolToken).safeTransferFrom(msg.sender, address(this), _feeAmount);
            storedFee += _feeAmount;

            emit FeeStored(_feeAmount);
        }

        emit TicketsPurchased(msg.sender, lotteryId, _ticketPrice, ticketsAmount);

        if(lottery.purchasedTickets == MAX_PARTICIPANTS){
            lottery.requestId = IIDPOracle(oracle).requestRandomWords();
            lottery.endTime = block.timestamp;

            roundTypeActive[roundType] = totalLotteries;

            emit RoundEnded(msg.sender, lotteryId, roundType, lottery.requestId);
        }
    }

    /**
     * @notice function to claim {protocolToken} rewards for a won {Lottery}
     * @param lotteryIds won {Lottery} IDs array
     */
    function claimRewards(uint[] memory lotteryIds) external nonReentrant() {
        require(lotteryIds.length > 0, "IDPLottery: invalid lotteryIds length");

        for(uint i; lotteryIds.length > i; i++){
            require(totalLotteries > lotteryIds[i], "IDPLottery: invalid lotteryId");

            Lottery storage lottery = lotteries[lotteryIds[i]];

            require(block.timestamp > lottery.endTime + 10, "IDPLottery: too soon");
            require(lottery.winner == address(0), "IDPLottery: claimed");

            uint _winningTicket = getRandomNumber(lottery.requestId);
            address _winner = lottery.ticketOwner[_winningTicket];

            lottery.winningTicket = _winningTicket;
            lottery.winner = _winner;

            IERC20(protocolToken).safeTransfer(_winner, MAX_PARTICIPANTS * lottery.ticketPrice);

            emit RewardClaimed(msg.sender, lotteryIds[i], _winningTicket, _winner, MAX_PARTICIPANTS * lottery.ticketPrice);
        }

        if(storedFee >= 10e18) try this.autoRefill() {
            emit AutoRefillSucceeds();
        } catch {
            emit AutoRefillFailed();
        }  
    }

    /**
     * @notice function to set {vaultFeeInterest} value
     * @param newVaultFeeInterest new {vaultFeeInterest} value
     * @notice only {owner} available
     * @notice DENOMINATOR == 1000000 == 100%
     */
    function setVaultFeeInterest(uint newVaultFeeInterest) external onlyOwner() {
        require(DENOMINATOR >= newVaultFeeInterest, "IDPLottery: exceeded max value");
        vaultFeeInterest = newVaultFeeInterest;
    }

    /**
     * @notice function to pause one of {Lottery} roundType
     * @param roundType round type to pause
     * @notice only {owner} available
     */
    function pauseRoundType(uint roundType) external onlyOwner() {
        require(roundTypePrice[roundType] > 0, "IDPLottery: invalid roundType");
        require(roundTypePaused[roundType] == 0, "IDPLottery: paused");
        roundTypePaused[roundType] = block.timestamp;
    } 

    /**
     * @notice function to unpause one of {Lottery} roundType
     * @param roundType round type to unpause
     * @notice only {owner} available
     */
    function unpauseRoundType(uint roundType) external onlyOwner() {
        require(roundTypePrice[roundType] > 0, "IDPLottery: invalid roundType");
        require(roundTypePaused[roundType] > 0, "IDPLottery: unpaused");
        delete roundTypePaused[roundType];
    } 

    /**
     * @notice function to withdraw excess token or distribute {protocolToken} {storedFee} 
     * @param token token address to withdraw
     * @param amount token amount to withdraw
     * @param receiver withdrawed tokens receiver
     * @notice only {owner} available
     */
    function withdrawExcessToken(address token, uint amount, address receiver) external nonReentrant() onlyOwner() {
        require(amount > 0, "IDPLottery: invalid amount");
        require(receiver != address(0), "IDPLottery: zero address");
        if(token == address(0)){
            (bool _success, ) = receiver.call{value: amount}(new bytes(0));
            require(_success, "IDPLottery: ETH transfer failed");
        } else {
            if(token == protocolToken){
                require(storedFee > amount, "IDPLottery: storedFee absent");
                IERC20(token).safeTransfer(vault, amount);
                IIDPVault(vault).distributeFee(amount, vaultFeeInterest);
                storedFee -= amount;
            } else {
                IERC20(token).safeTransfer(receiver, amount);
            }
        }
    }

    /**
     * @notice function to set {autoRefillEnabled} flag for {autoRefill} function
     * @param enabled new {autoRefillEnabled} flag value
     * @notice only {owner} available
     */
    function setAutoRefillEnabled(bool enabled) external onlyOwner() {
        autoRefillEnabled = enabled;
    }

    /**
     * @notice function to set {swapConfig} for {autoRefill} function
     * @param newConfig new {swapConfig} value
     * @notice only {owner} available
     * @notice should be called only by dev
     */
    function setSwapConfig(SwapConfig calldata newConfig) external onlyOwner() {
        swapConfig = newConfig;
    }

    function renounceOwnership() public override onlyOwner() {
        revert();
    }

    /**
     * @notice view function to get {Lottery} ticket owner
     * @param lotteryId {Lottery} ID
     * @param ticketNumber ticket number
     * @return owner {ticketNumber} owner address
     */
    function getTicketOwner(uint lotteryId, uint ticketNumber) external view returns(address owner) {
        return lotteries[lotteryId].ticketOwner[ticketNumber];
    }

    /**
     * @notice view function to get {Lottery} participants
     * @param lotteryId {Lottery} ID
     * @return participantsList {Lottery} participants array
     */
    function getRoundParticipants(uint lotteryId) external view returns(address[10] memory participantsList) {
        for(uint i; MAX_PARTICIPANTS > i; i++) participantsList[i] = lotteries[lotteryId].ticketOwner[i];
    }

    /**
     * @notice view function to get round type active round ID
     * @param roundType {Lottery} round type
     * @return activeRoundId round type active round ID
     */
    function getActiveRound(uint roundType) external view returns(uint activeRoundId) {
        return lotteries[roundTypeActive[roundType]].ticketPrice != roundTypePrice[roundType] ? totalLotteries : roundTypeActive[roundType];
    }

    /**
     * @notice view function to get requested random number of winning ticket
     * @param requestId ID of random value request
     * @return randomNumber requested random number of winning ticket
     */
    function getRandomNumber(uint requestId) public view returns(uint randomNumber) {
        (bool _fulfilled, uint256[] memory _randomWords) = IIDPOracle(oracle).getRequestStatus(requestId);

        require(_fulfilled, "IDPLottery: not fulfilled request");
        require(_randomWords[0] > 0, "IDPLottery: invalid random value");

        return _randomWords[0] % MAX_PARTICIPANTS;
    }

    /**
     * @notice view function to get {protocolToken} fee amount for purchasing tickets
     * @param ticketsAmount tickets amount to purchase
     * @param ticketPrice ticket price to purchase
     * @return feeAmount {protocolToken} fee amount
     */
    function getProtocolFee(uint ticketsAmount, uint ticketPrice) public pure returns(uint feeAmount) {
        return ticketsAmount * ticketPrice * FEE_INTEREST / DENOMINATOR;
    }

    /**
     * @notice function to auto swap {protocolFee} {storedFee} amount to {config.linkToken}
     * @notice only {address(this)} available
     */
    function autoRefill() external {
        require(msg.sender == address(this), "IDPLottery: forbidden");

        SwapConfig memory config = swapConfig;

        IERC20(protocolToken).approve(config.router, storedFee);

        uint _balanceBefore = IERC20(protocolToken).balanceOf(address(this));

        uint _additionalFee = config.useIdpDex ? IIDPRouter(config.router).computeFeeAmount(storedFee, config.path) : 0;

        IRouter(config.router).swapExactTokensForTokens(
            storedFee - _additionalFee,
            config.amountOutMin,
            config.path,
            address(this),
            block.timestamp + config.deadline
        );

        storedFee -= (_balanceBefore - IERC20(protocolToken).balanceOf(address(this)));

        IERC20(protocolToken).approve(config.router, 0);

        uint _receivedAmount = IERC20(config.peggedLinkToken).balanceOf(address(this));
        IERC20(config.peggedLinkToken).approve(config.pegSwap, _receivedAmount);
        IPegSwap(config.pegSwap).swap(
            _receivedAmount,
            config.peggedLinkToken,
            config.linkToken
        );

        _receivedAmount = IERC20(config.linkToken).balanceOf(address(this));
        (bool _success) = ILinkToken(config.linkToken).transferAndCall(
            config.coordinator, 
            _receivedAmount, 
            config.subscriptionId
        );

        require(_success, "IDPLottery: failed");

        emit SubscriptionRefilled(_receivedAmount);
    }
}