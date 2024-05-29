// SPDX-License-Identifier: MIT
pragma solidity =0.6.6;

import "../libraries/TransferHelper.sol";
import "../libraries/Ownable2Step.sol";
import "../libraries/IDPLibrary.sol";
import "../libraries/SafeMath.sol";

import "../interfaces/IIDPFactory.sol";
import "../interfaces/IIDPRouter.sol";
import "../interfaces/IIDPVault.sol";
import "../interfaces/IERC20.sol";
import "../interfaces/IWETH.sol";

contract IDPRouter is Ownable2Step, IIDPRouter {
    using SafeMath for uint;

    uint public constant DENOMINATOR = 1000000; // 100%
    uint public constant MAX_PROTOCOL_FEE = 1000; // 0.1%
    uint public constant PROTOCOL_SWAP_FEE_INTEREST = 100000; // 10%

    uint public override protocolBaseFee;
    uint public override protocolStableFee;

    address public immutable override vault;
    address public immutable override protocolToken;
    address public immutable override factory;
    address public immutable override WETH;

    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, "IDPRouter: EXPIRED");
        _;
    }

    constructor(
        address _admin, 
        address _factory, 
        address _WETH,
        address _vault,
        address _protocolToken
    ) public Ownable2Step(_admin) {
        factory = _factory;
        WETH = _WETH;
        vault = _vault;
        protocolToken = _protocolToken;

        protocolBaseFee = 1000; // 0.1%
        protocolStableFee = 100; // 0.01%
    }

    receive() external payable {
        assert(msg.sender == WETH); // only accept ETH via fallback from the WETH contract
    }

    // **** OWNER FUNCTIONS ****

    /**
     * @notice function to create {IDPPair} liquidity pool
     * @param tokenA first token
     * @param tokenB second token
     * @param stableFeeToken swap fee interest flag
     * @notice one of tokens have to be {protocolToken}
     * @notice only {owner} available
     */
    function createPair(address tokenA, address tokenB, bool stableFeeToken) external override onlyOwner() {
        IIDPFactory(factory).createPair(tokenA, tokenB, stableFeeToken);
    }

    /**
     * @notice function to set {protocolBaseFee} value
     * @param newProtocolBaseFee new {protocolBaseFee} value
     * @notice only {owner} available
     * @notice DENOMINATOR == 1000000 == 100%
     */
    function setProtocolBaseFee(uint newProtocolBaseFee) external override onlyOwner() {
        require(MAX_PROTOCOL_FEE >= newProtocolBaseFee, "IDPRouter: invalid value");
        protocolBaseFee = newProtocolBaseFee;
    }

    /**
     * @notice function to set {protocolStableFee} value
     * @param newProtocolStableFee new {protocolStableFee} value
     * @notice only {owner} available
     * @notice DENOMINATOR == 1000000 == 100%
     */
    function setProtocolStableFee(uint newProtocolStableFee) external override onlyOwner() {
        require(MAX_PROTOCOL_FEE >= newProtocolStableFee, "IDPRouter: invalid value");
        protocolStableFee = newProtocolStableFee;
    }

    // **** ADD LIQUIDITY ****
    function addLiquidity( 
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline,
        bool stableFeeToken // meaningless param if pair already created
    ) external override ensure(deadline) returns(uint amountA, uint amountB, uint liquidity) {
        (amountA, amountB) = _addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin, stableFeeToken);
        address pair = IDPLibrary.pairFor(factory, tokenA, tokenB);
        TransferHelper.safeTransferFrom(tokenA, msg.sender, pair, amountA);
        TransferHelper.safeTransferFrom(tokenB, msg.sender, pair, amountB);
        liquidity = IIDPPair(pair).mint(to); 
    }

    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline,
        bool stableFeeToken // meaningless param if pair already created
    ) external override payable ensure(deadline) returns(uint amountToken, uint amountETH, uint liquidity) {
        (amountToken, amountETH) = _addLiquidity(
            token,
            WETH,
            amountTokenDesired,
            msg.value,
            amountTokenMin,
            amountETHMin,
            stableFeeToken
        );
        address pair = IDPLibrary.pairFor(factory, token, WETH);
        TransferHelper.safeTransferFrom(token, msg.sender, pair, amountToken);
        IWETH(WETH).deposit{value: amountETH}();
        assert(IWETH(WETH).transfer(pair, amountETH));
        liquidity = IIDPPair(pair).mint(to);
        // refund dust eth, if any
        if (msg.value > amountETH) TransferHelper.safeTransferETH(msg.sender, msg.value - amountETH);
    }

    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        bool stableFeeToken
    ) internal returns(uint amountA, uint amountB) {
        // create the pair if it doesn"t exist yet
        if (IIDPFactory(factory).getPair(tokenA, tokenB) == address(0)) { 
            _checkOwner();
            IIDPFactory(factory).createPair(tokenA, tokenB, stableFeeToken);
        }
        (uint reserveA, uint reserveB) = IDPLibrary.getReserves(factory, tokenA, tokenB);
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint amountBOptimal = IDPLibrary.quote(amountADesired, reserveA, reserveB); 
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "IDPRouter: INSUFFICIENT_B_AMOUNT");
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint amountAOptimal = IDPLibrary.quote(amountBDesired, reserveB, reserveA);
                assert(amountAOptimal <= amountADesired);
                require(amountAOptimal >= amountAMin, "IDPRouter: INSUFFICIENT_A_AMOUNT");
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }

    // **** REMOVE LIQUIDITY ****
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) public override ensure(deadline) returns(uint amountA, uint amountB) {
        address pair = IDPLibrary.pairFor(factory, tokenA, tokenB);
        TransferHelper.safeTransferFrom(pair, msg.sender, pair, liquidity); // send liquidity to pair 
        (uint amount0, uint amount1) = IIDPPair(pair).burn(to);
        (address token0,) = IDPLibrary.sortTokens(tokenA, tokenB);
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
        require(amountA >= amountAMin, "IDPRouter: INSUFFICIENT_A_AMOUNT");
        require(amountB >= amountBMin, "IDPRouter: INSUFFICIENT_B_AMOUNT");
    }

    function removeLiquidityETH(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) public override ensure(deadline) returns(uint amountToken, uint amountETH) {
        (amountToken, amountETH) = removeLiquidity(
            token,
            WETH,
            liquidity,
            amountTokenMin,
            amountETHMin,
            address(this),
            deadline
        );
        TransferHelper.safeTransfer(token, to, amountToken);
        IWETH(WETH).withdraw(amountETH);
        TransferHelper.safeTransferETH(to, amountETH);
    }

    function removeLiquidityWithPermit(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline,
        bool approveMax, uint8 v, bytes32 r, bytes32 s
    ) external override returns(uint amountA, uint amountB) {
        address pair = IDPLibrary.pairFor(factory, tokenA, tokenB);
        uint value = approveMax ? uint(-1) : liquidity;
        IIDPPair(pair).permit(msg.sender, address(this), value, deadline, v, r, s);
        (amountA, amountB) = removeLiquidity(tokenA, tokenB, liquidity, amountAMin, amountBMin, to, deadline);
    }

    function removeLiquidityETHWithPermit(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline,
        bool approveMax, uint8 v, bytes32 r, bytes32 s
    ) external override returns(uint amountToken, uint amountETH) {
        address pair = IDPLibrary.pairFor(factory, token, WETH);
        uint value = approveMax ? uint(-1) : liquidity;
        IIDPPair(pair).permit(msg.sender, address(this), value, deadline, v, r, s);
        (amountToken, amountETH) = removeLiquidityETH(token, liquidity, amountTokenMin, amountETHMin, to, deadline);
    }

    // **** REMOVE LIQUIDITY (supporting fee-on-transfer tokens) ****
    function removeLiquidityETHSupportingFeeOnTransferTokens(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) public override ensure(deadline) returns(uint amountETH) {
        (, amountETH) = removeLiquidity(
            token,
            WETH,
            liquidity,
            amountTokenMin,
            amountETHMin,
            address(this),
            deadline
        );
        TransferHelper.safeTransfer(token, to, IERC20(token).balanceOf(address(this)));
        IWETH(WETH).withdraw(amountETH);
        TransferHelper.safeTransferETH(to, amountETH);
    }

    function removeLiquidityETHWithPermitSupportingFeeOnTransferTokens(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline,
        bool approveMax, uint8 v, bytes32 r, bytes32 s
    ) external override returns(uint amountETH) {
        address pair = IDPLibrary.pairFor(factory, token, WETH);
        uint value = approveMax ? uint(-1) : liquidity;
        IIDPPair(pair).permit(msg.sender, address(this), value, deadline, v, r, s);
        amountETH = removeLiquidityETHSupportingFeeOnTransferTokens(
            token, liquidity, amountTokenMin, amountETHMin, to, deadline
        );
    }

    // **** SWAP ****
    // requires the initial amount to have already been sent to the first pair
    function _swap(uint[] memory amounts, address[] memory path, address _to) internal {
        for (uint i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0,) = IDPLibrary.sortTokens(input, output);
            uint amountOut = amounts[i + 1];
            (uint amount0Out, uint amount1Out) = input == token0 ? (uint(0), amountOut) : (amountOut, uint(0));
            address to = i < path.length - 2 ? IDPLibrary.pairFor(factory, output, path[i + 2]) : _to;
            IIDPPair(IDPLibrary.pairFor(factory, input, output)).swap(
                amount0Out, amount1Out, to, new bytes(0)
            );
        }
    }
    
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external override ensure(deadline) returns(uint[] memory amounts) {
        amounts = IDPLibrary.getAmountsOut(factory, amountIn, path, IIDPFactory(factory).getStableTokenData(path));
        require(amounts[amounts.length - 1] >= amountOutMin, "IDPRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        transferAdditionalFee(computeFeeAmount(amounts[0], path));
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, IDPLibrary.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, to);
    }

    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external override ensure(deadline) returns(uint[] memory amounts) {
        amounts = IDPLibrary.getAmountsIn(factory, amountOut, path, IIDPFactory(factory).getStableTokenData(path));
        require(amounts[0] <= amountInMax, "IDPRouter: EXCESSIVE_INPUT_AMOUNT");
        transferAdditionalFee(computeFeeAmount(amounts[0], path));
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, IDPLibrary.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, to);
    }

    function swapExactETHForTokens(
        uint amountOutMin, 
        address[] calldata path, 
        address to, 
        uint deadline
    ) external override payable ensure(deadline) returns(uint[] memory amounts) {
        require(path[0] == WETH, "IDPRouter: INVALID_PATH");
        amounts = IDPLibrary.getAmountsOut(factory, msg.value, path, IIDPFactory(factory).getStableTokenData(path));
        require(amounts[amounts.length - 1] >= amountOutMin, "IDPRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        transferAdditionalFee(computeFeeAmount(amounts[0], path));
        IWETH(WETH).deposit{value: amounts[0]}();
        assert(IWETH(WETH).transfer(IDPLibrary.pairFor(factory, path[0], path[1]), amounts[0]));
        _swap(amounts, path, to);
    }

    function swapTokensForExactETH(
        uint amountOut, 
        uint amountInMax, 
        address[] calldata path, 
        address to, 
        uint deadline
    ) external override ensure(deadline) returns(uint[] memory amounts) {
        require(path[path.length - 1] == WETH, "IDPRouter: INVALID_PATH");
        amounts = IDPLibrary.getAmountsIn(factory, amountOut, path, IIDPFactory(factory).getStableTokenData(path));
        require(amounts[0] <= amountInMax, "IDPRouter: EXCESSIVE_INPUT_AMOUNT");
        transferAdditionalFee(computeFeeAmount(amounts[0], path));
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, IDPLibrary.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, address(this));
        IWETH(WETH).withdraw(amounts[amounts.length - 1]);
        TransferHelper.safeTransferETH(to, amounts[amounts.length - 1]);
    }

    function swapExactTokensForETH(
        uint amountIn, 
        uint amountOutMin, 
        address[] calldata path, 
        address to, 
        uint deadline
    ) external override ensure(deadline) returns(uint[] memory amounts) {
        require(path[path.length - 1] == WETH, "IDPRouter: INVALID_PATH");
        amounts = IDPLibrary.getAmountsOut(factory, amountIn, path, IIDPFactory(factory).getStableTokenData(path));
        require(amounts[amounts.length - 1] >= amountOutMin, "IDPRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        transferAdditionalFee(computeFeeAmount(amounts[0], path));
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, IDPLibrary.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, address(this));
        IWETH(WETH).withdraw(amounts[amounts.length - 1]);
        TransferHelper.safeTransferETH(to, amounts[amounts.length - 1]);
    }

    function swapETHForExactTokens(
        uint amountOut, 
        address[] calldata path, 
        address to, 
        uint deadline
    ) external override payable ensure(deadline) returns(uint[] memory amounts) {
        require(path[0] == WETH, "IDPRouter: INVALID_PATH");
        amounts = IDPLibrary.getAmountsIn(factory, amountOut, path, IIDPFactory(factory).getStableTokenData(path));
        require(amounts[0] <= msg.value, "IDPRouter: EXCESSIVE_INPUT_AMOUNT");
        transferAdditionalFee(computeFeeAmount(amounts[0], path));
        IWETH(WETH).deposit{value: amounts[0]}();
        assert(IWETH(WETH).transfer(IDPLibrary.pairFor(factory, path[0], path[1]), amounts[0]));
        _swap(amounts, path, to);
        // refund dust eth, if any
        if (msg.value > amounts[0]) TransferHelper.safeTransferETH(msg.sender, msg.value - amounts[0]);
    }

    // **** SWAP (supporting fee-on-transfer tokens) ****
    // requires the initial amount to have already been sent to the first pair
    function _swapSupportingFeeOnTransferTokens(address[] memory path, address _to) internal {
        for (uint i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0,) = IDPLibrary.sortTokens(input, output);
            IIDPPair pair = IIDPPair(IDPLibrary.pairFor(factory, input, output));
            uint amountInput;
            uint amountOutput;
            
            { // scope to avoid stack too deep errors
            (bool stableFeeTokenIn, bool stableFeeTokenOut) = (IIDPFactory(factory).stableToken(path[i]), IIDPFactory(factory).stableToken(path[i + 1]));
            (uint reserve0, uint reserve1,) = pair.getReserves();
            (uint reserveInput, uint reserveOutput) = input == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
            amountInput = IERC20(input).balanceOf(address(pair)).sub(reserveInput);
            amountOutput = IDPLibrary.getAmountOut(
                amountInput, 
                reserveInput, 
                reserveOutput, 
                stableFeeTokenIn, 
                stableFeeTokenOut
                );
            }
            (uint amount0Out, uint amount1Out) = input == token0 ? (uint(0), amountOutput) : (amountOutput, uint(0));
            address to = i < path.length - 2 ? IDPLibrary.pairFor(factory, output, path[i + 2]) : _to;
            pair.swap(amount0Out, amount1Out, to, new bytes(0));
        }
    }

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external override ensure(deadline) {
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, IDPLibrary.pairFor(factory, path[0], path[1]), amountIn
        );
        uint balanceBefore = IERC20(path[path.length - 1]).balanceOf(to);
        _swapSupportingFeeOnTransferTokens(path, to);
        require(
            IERC20(path[path.length - 1]).balanceOf(to).sub(balanceBefore) >= amountOutMin,
            "IDPRouter: INSUFFICIENT_OUTPUT_AMOUNT"
        );
        transferAdditionalFee(computeFeeAmount(amountIn, path));
    }

    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external override payable ensure(deadline) {
        require(path[0] == WETH, "IDPRouter: INVALID_PATH");
        uint amountIn = msg.value;
        IWETH(WETH).deposit{value: amountIn}();
        assert(IWETH(WETH).transfer(IDPLibrary.pairFor(factory, path[0], path[1]), amountIn));
        uint balanceBefore = IERC20(path[path.length - 1]).balanceOf(to);
        _swapSupportingFeeOnTransferTokens(path, to);
        require(
            IERC20(path[path.length - 1]).balanceOf(to).sub(balanceBefore) >= amountOutMin,
            "IDPRouter: INSUFFICIENT_OUTPUT_AMOUNT"
        );
        transferAdditionalFee(computeFeeAmount(amountIn, path));
    }

    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external override ensure(deadline) {
        require(path[path.length - 1] == WETH, "IDPRouter: INVALID_PATH");
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, IDPLibrary.pairFor(factory, path[0], path[1]), amountIn
        );
        _swapSupportingFeeOnTransferTokens(path, address(this));
        uint amountOut = IERC20(WETH).balanceOf(address(this));
        require(amountOut >= amountOutMin, "IDPRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        IWETH(WETH).withdraw(amountOut);
        TransferHelper.safeTransferETH(to, amountOut);
        transferAdditionalFee(computeFeeAmount(amountIn, path));
    }

    // **** ADDITIONAL FEE **** 

    /**
     * @notice view function to get additional {protocolToken} fee amount
     * @param amountIn token amount to swap in
     * @param path tokens path to swap array
     * @return feeOutAmount {protocolToken} fee amount
     */
    function computeFeeAmount(uint amountIn, address[] memory path) public override view returns(uint feeOutAmount) {
        bool _stablePool = IIDPFactory(factory).stableToken(path[0]) || IIDPFactory(factory).stableToken(path[path.length - 1]);
        uint _feeInterest = _stablePool ? protocolStableFee : protocolBaseFee;
        if(_feeInterest == 0) return 0;
        uint _feeInAmount = amountIn * _feeInterest / DENOMINATOR;
        uint _feeReceivers = IIDPVault(vault).getFeeReceiversLength();
        
        if(path[0] != protocolToken){
            address[] memory pathNew = new address[](2);
            (pathNew[0], pathNew[1]) = (path[0], protocolToken);
            uint[] memory amounts = getAmountsOut(_feeInAmount, pathNew);
            feeOutAmount = _feeReceivers > 0 ? amounts[amounts.length - 1] : amounts[amounts.length - 1] / 10;
        } else {
            feeOutAmount = _feeReceivers > 0 ? _feeInAmount : _feeInAmount / 10;
        }
    }
    
    function transferAdditionalFee(uint feeAmount) internal {
        if(feeAmount > 0){
            TransferHelper.safeTransferFrom(protocolToken, msg.sender, vault, feeAmount);
            IIDPVault(vault).distributeFee(feeAmount, PROTOCOL_SWAP_FEE_INTEREST);
        }
    }

    // **** LIBRARY FUNCTIONS ****
    function quote(uint amountA, uint reserveA, uint reserveB) public pure override returns(uint amountB) {
        return IDPLibrary.quote(amountA, reserveA, reserveB);
    }

    function getAmountOut(
        uint amountIn, 
        uint reserveIn, 
        uint reserveOut,
        bool stableFeeIn,
        bool stableFeeOut
    ) public pure override returns(uint amountOut) {
        return IDPLibrary.getAmountOut(amountIn, reserveIn, reserveOut, stableFeeIn, stableFeeOut);
    }

    function getAmountIn(
        uint amountOut,
        uint reserveIn, 
        uint reserveOut,
        bool stableFeeIn,
        bool stableFeeOut
    ) public pure override returns(uint amountIn) {
        return IDPLibrary.getAmountIn(amountOut, reserveIn, reserveOut, stableFeeIn, stableFeeOut);
    }

    function getAmountsOut(
        uint amountIn, 
        address[] memory path
    ) public view override returns(uint[] memory amounts) {
        return IDPLibrary.getAmountsOut(factory, amountIn, path, IIDPFactory(factory).getStableTokenData(path));
    }

    function getAmountsIn(
        uint amountOut, 
        address[] memory path
    ) public view override returns(uint[] memory amounts) {
        return IDPLibrary.getAmountsIn(factory, amountOut, path, IIDPFactory(factory).getStableTokenData(path));
    }
}