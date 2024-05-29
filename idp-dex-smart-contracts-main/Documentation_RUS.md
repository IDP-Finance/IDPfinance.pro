# Документация к IDP смарт контрактам  

## Смарт контракт Ownable2Step

Смарт контракт реализующий механизм владения контрактами.

### Переменные

`owner`  
Текущий владелец контракта

`pendingOwner`  
Ожидаемый владелец контракта

### Функции

`function transferOwnership(address newOwner) external onlyOwner()`  
Вызывается только текущим овнером контракта `owner`, метод начинает процесс передачи владения контрактом на указанный адрес `newOwner`, который становится `pendingOwner`.

`function acceptOwnership() external`  
Вызывается только ожидаемым владельцем `pendingOwner`. Функция передает владение контрактом новому владельцу `pendingOwner`, он становится текущим `owner`.

## Смарт контракт IDPToken

`IDPToken` является токеном стандарта ERC20, который имеет методы владения `Ownable2Step`.  
(наследуется от библиотек OpenZeppelin)

Контракт имеет одну дополнительную переменную - адрес `vault`.  

### Функции
`function setVault(address newVault) external onlyOwner()`  
Устанавливает адрес контракта `vault`. Вызывается только овнером. При установке ненулевого адреса, вызываться больше не может.

`function mint(address to, uint256 amount) external`  
Производит минт указанного кол-ва токенов `amount` на указанный адрес `to`. Функция вызывается только установленным адресом `vault`. 

### Ошибки

`IDPToken: zero address` - попытка переназначить уже установленный ненулевой адрес `vault`  
`IDPToken: forbidden` - попытка вызвать метод `mint` с адреса не являющимся адресом `vault`

## Смарт контракт IDPFactory

`IDPFactory` является фабрикой контрактов пулов ликвидности - UniswapV2. В контракте так же реализован механизм владения `Ownable2Step`.

### Переменные

`address public feeTo`  
Aдрес получателя комиссий с предоставления или изъятия ликвидности (0.05%), если адрес установлен на нулевой, комиссия не взимаются.

`address public protocolToken`  
Адрес токена платформы `IDPToken`.

`address public router`  
Адрес контракта `IDPRouter`.

`address[] public allPairs`  
Массив содержащий адреса всех созданных фабрикой пулов.

`mapping(address => bool) public stableToken`  
Сопоставление адреса токена и флага, является ли токен стейблкоином (влияет на комиссии).

`mapping(address => mapping(address => address)) public getPair`  
Принимает два адреса токенов, возвращает адрес пула, если такой существует.

### Функции

#### Функции управления (вызываются только овнером)

`function setRouter(address _router) external onlyOwner()`  
Устанавливает адрес контракта `IDPRouter`. **Рекомендуется вызывать только с утверждения разработчика.**

`function setFeeTo(address _feeTo) external onlyOwner()`  
Устанавливает адрес `feeTo`.
    
`function createPair(address tokenA, address tokenB, bool stableFeeToken) external returns(address pair)`  
Cоздает пул ликвидности из пары указанных токенов(один из токенов должен быть `IDPToken`). Также принимает флаг `stableFeeToken` - если true, парный токен считается стейблом(свапы в паре имеют сниженные комиссии), если false - то стандартные комиссии. Функция может вызываться только овнером или роутером.  

(Пулы рекомендуется создавать через методы добавления ликвидности в контракте `IDPRouter`, так как без одновременного добавления ликвидности любой может установить любую начальную цену в пуле при первичном добавлении ликвидности).

#### View функции

`function getStableTokenData(address[] calldata path) external view returns(bool[])`  
Функция возвращает значения false/true, являются ли указанные токены стейблами или нет.

`function allPairsLength() external view returns(uint)`  
Возвращает длину массива со всеми созданными парами, то есть кол-во всех созданных пулов.

### Ошибки

`IDPFactory: FORBIDDEN` - попытка вызвать метод `createPair` не овнером или не роутером.  
`IDPFactory: PROTOCOL_TOKEN_ABSENT` - попытка создания `createPair` пары токенов, ни один из которых не является `IDPToken`.    
`IDPFactory: IDENTICAL_ADDRESSES` - указанные токены в методе `createPair` являются одинаковыми.  
`IDPFactory: ZERO_ADDRESS` - один или оба из указанных токенов в методе `createPair` являются нулевыми.  
`IDPFactory: PAIR_EXISTS` - пара ликвидности указанных токенов в методе `createPair` уже существует.

## Смарт контракт IDPRouter

Контракт является маршрутизатором для свапов, добавления ликвидности и ее вывода между пулами созданными контрактом `IDPFactory`. 
В контракте так же реализован механизм владения `Ownable2Step`.

### Переменные

`uint public constant DENOMINATOR = 1000000 = 100%`  
Значение равное 100%, используется для точности вычислений.

`uint public constant MAX_PROTOCOL_FEE = 1000 = 0.1%`  
Максимальное значение комиссиии протокола для свапов.

`uint public constant PROTOCOL_SWAP_FEE_INTEREST = 100000 = 10%`  
Процент от комиссий протокола, который направляется в резерв контракта `IDPVault`.

`uint public protocolBaseFee`  
Значение комиссии для свапов не стейблкоинов (дефолт 1000 = 0.1%).

`uint public protocolStableFee`  
Значение комиссии для свапов стейблкоинов (дефолт 100 = 0.01%).

`address public immutable vault`  
Адрес контракта `IDPVault`.

`address public immutable protocolToken`  
Адрес контракта `IDPToken`.

`address public immutable factory`  
Адрес контракта `IDPFactory`.

`address public immutable WETH`  
Адрес контракта `WBNB`.

### Функции

#### Функции управления (вызываются только овнером)

`function createPair(address tokenA, address tokenB, bool stableFeeToken) external onlyOwner()`  
Аналогичный метод создания пары контракта `IDPFactory`.

`function setProtocolBaseFee(uint newProtocolBaseFee) external override onlyOwner()`  
Устанавливает значение комиссии для не стейблкоинов (пр. 10000 = 1%).

`function setProtocolStableFee(uint newProtocolStableFee) external override onlyOwner()`  
Устанавливает значение комиссии для стейблкоинов (пр. 10000 = 1%).

#### View функции

`function computeFeeAmount(uint amountIn, address[] memory path) public view returns(uint feeOutAmount)`  
Функция вычисления комиссии за свап на основе кол-ва токенов для свапа `amountIn` и пути свапа(`path`: массив адресов токенов, где первый токен - который передается для свапа, последний - токен для получения). Возвращает размер комиссии: кол-во токенов `IDPToken`.

#### Все остальные функции, не присутствующие здесь

Остальные функции являются методами, предоставленными контрактами Router01 и Router02 от UniswapV2. [Подробная документация](https://docs.uniswap.org/contracts/v2/reference/smart-contracts/router-02).

### Ошибки

`IDPRouter: invalid value` - попытка изменить значение комиссии в методах на значение превыщающее значение `MAX_PROTOCOL_FEE = 1000 = 0.1%`.  
`IDPRouter: EXPIRED` - `deadline` транзакции истек  
`IDPRouter: INSUFFICIENT_B_AMOUNT` - недостаточное кол-во `tokenB` получаемое или отдаваемое при изъятии/добавлении ликвидности  
`IDPRouter: INSUFFICIENT_A_AMOUNT` - недостаточное кол-во `tokenA` получаемое или отдаваемое при изъятии/добавлении ликвидности  
`IDPRouter: INSUFFICIENT_OUTPUT_AMOUNT` - получаемое кол-во токенов меньше, чем указанное кол-во `amountOutMin`  
`IDPRouter: EXCESSIVE_INPUT_AMOUNT` - отдаваемое кол-во токенов больше, чем указанное кол-во `amountInMax`  
`IDPRouter: INVALID_PATH` - указан не действительный `path` токенов для свапа  

## Смарт контракт IDPVault

Основной контракт выпуска токенов `IDPToken`, который позволяет покупать `IDPToken` за токены `USDT`, а также продавать их обратно по динамической цене.
В контракте так же реализован механизм владения `Ownable2Step`.

### Переменные

`uint public constant DENOMINATOR = 1000000 = 100%`  
Значение равное 100%, используется для точности вычислений.

`uint public constant SUPPLY_UPDATE_KINK = 100000e18`  
Кол-во токенов `IDPToken` на балансе `IDPVault`, при котором производится дополнительный минт токенов `IDPToken` (100 тыс. токенов).

`uint public constant SUPPLY_UPDATE_AMOUNT = 1000000e18`  
Размер дополнительного минта `IDPToken` токенов при нехватке в резерве (1 млн. токенов).

`uint public constant MAX_PROTOCOL_FEE_INTEREST = 1000 = 0.1%`  
Максимально допустимый процент комиссий при покупке `IDPToken`.

`uint public protocolFeeInterest`  
Текущий процент комиссий при покупке `IDPToken`.

`uint public depositReserve`  
Кол-во `USDT` токенов в резерве.

`uint public protocolReserve`  
Кол-во `IDPToken` токенов в резерве.

`address public immutable protocolToken`  
Адрес контракта `IDPToken`.

`address public immutable depositToken`  
Адрес контракта `USDT`.

`address[] public feeReceivers`  
Массив содержащий адреса получателей комиссий (по дефолту пустой).

`mapping(address => bool) public feeReceiverExist`  
Сопоставление адреса флагу, является ли адрес получателем комиссий (возвращает true - адрес является получателем).

### Функции

`function distributeFee(uint feeAmount) external`  
Распределяет присланные `IDPToken` в виде комиссий между `IDPVault` и получателями комиссий (вызывается контрактами `IDPRouter` и `IDPLottery`).

#### Пользовательские функции

`function buyToken(uint amountIn, uint expectedAmountOut) external`  
Позволяет купить `IDPToken` за токены `USDT`. Принимает на вход значение `amountIn` - желаемое кол-во `USDT` для оплаты и `expectedAmountOut` - ожидаемое кол-во `IDPToken` для получения. Работает в двух режимах, один из инпутов должен быть 0, то есть либо будет потрачено ровное кол-во `amountIn` `USDT`, либо контракт сам посчитает сколько `USDT` нужно заплатить, чтобы получить ровное кол-во `IDPToken` `expectedAmountOut`.

`function sellToken(uint amountIn) external`  
Позволяет продать `IDPToken` и получить обратно токены `USDT` по текущей цене продажи `getCurrentDisposalPrice`.

#### Функции управления (вызываются только овнером)

`function setProtocolFeeInterest(uint newProtocolFeeInterest) external onlyOwner()`  
Устанавливает процент комиссий при покупке `IDPToken` (пр. 1000 = 0.1%).

`function setFeeReceiver(address feeReceiver) external onlyOwner()`  
Добавляет указанный адрес в список получателей комиссий.

`function deleteFeeReceiver(address feeReceiver) external onlyOwner()`  
Удаляет указанный адрес из списка получателей комиссий.

`function withdrawExcessToken(address token, uint amount, address receiver) external onlyOwner()`  
Выводит нативный `BNB` или любой токен с баланса контракта (в случае `USDT` или `IDPToken` - только лишние токены, не являющиеся резервом контракта).

#### View функции

`function getFeeReceiversLength() external view returns(uint feeReceiversLength)`  
Возвращает кол-во получателей комиссий.

`function getCurrentDisposalPrice() public view returns(uint currentDisposalPrice)`  
Возвращает текущую цену продажи `IDPToken`.

`function getAmountIn(uint amountOut) public view returns(uint amountIn)`  
Возвращает необходимое кол-во `USDT` для покупки указанного кол-ва `IDPToken`.

`function getAmountOut(uint amountIn) public view returns(uint amountOut, uint protocolFee)`  
Возвращает ожидаемое кол-во получаемых `IDPToken` и кол-во комиссии за покупку при переданном значении кол-ва `USDT` `amountIn`.

`function getDisposalAmountOut(uint amountIn) public view returns(uint amountOut)`  
Расчитывает кол-во получаемых `IDPToken` за их продажу по текущей цене продажи на основании переданного кол-во `USDT` токенов `amountIn`.

### События

`event Purchased(address account, uint amountIn, uint amountOut, uint protocolFee)` - вызывается при покупке `IDPToken`  
`event Sold(address account, uint amountIn, uint amountOut)`  - вызывается при продаже `IDPToken`  
`event FeeDistributed(address account, uint feeAmount)` - вызывается при распределении комиссий `IDPToken`  
`event SupplyUpdated(uint additionalAmount, uint newTotalSupply)` - вызывается при дополнительном минте `IDPToken`  

### Ошибки

`IDPVault: invalid inputs` - в методе `buyToken` один из инпутов должен быть равен нуль, а второй не должен быть равен нулю  
`IDPVault: invalid amountOut` - в методе `buyToken` превышен порог на кол-во покупки токена `IDPToken` в одной транзакции  
`IDPVault: invalid amountIn` - в методе `sellToken` указано значение `amountIn` равное нулю  
`IDPVault: invalid value` - в методе `setProtocolFeeInterest` указано значение `newProtocolFeeInterest` превыщающее значение `MAX_PROTOCOL_FEE_INTEREST`  
`IDPVault: included` - указанный адрес получателя комиссий уже является им  
`IDPVault: not included`  - указанный адрес получателя комиссий уже не является им  
`IDPVault: invalid amount` - в методе `withdrawExcessToken` указано значение `amount` равное нулю  
`IDPVault: zero address` - в методе `withdrawExcessToken` указан получатель `receiver` равный нулевому адресу  
`IDPVault: ETH transfer failed` - в методе `withdrawExcessToken` указанный получатель не может получить нативный `BNB`  
`IDPVault: excess token absent` - для вывода `USDT` или `IDPToken` не хватает лишних токенов  
`IDPVault: invalid feeAmount` - в методе `distributeFee` указано значение `feeAmount` равное нулю  
`IDPVault: invalid vaultFeeInterest` - в методе `distributeFee` указано значение `vaultFeeInterest` превыщающее значение `DENOMINATOR = 1000000 = 100%`   
`IDPVault: invalid balance` - для распределения комиссий методом `distributeFee` недостаточно токенов `IDPToken` на контракте  

## Смарт контракт IDPOracle

Контракт запроса случайных чисел у сервиса `Chainlink`.
В контракте так же реализован механизм владения `Ownable2Step`.

### Переменные

`uint32 public constant MAX_NUM_WORDS = 500`  
Максимальное значение кол-ва чисел, которое можно запросить в одном запросе.

`uint16 public constant MAX_REQUEST_CONFIRMATIONS = 200`  
Максимальное кол-во подтверждений, которое можно ожидать для валидности запроса.

`uint16 public constant MIN_REQUEST_CONFIRMATIONS = 3`  
Минимальное кол-во подтверждений, которое можно ожидать для валидности запроса.

`uint32 public constant MAX_GAS_LIMIT = 2500000`  
Максимальное кол-во газа, которое может быть потрачено при получении рандомного числа в ответ на запрос.

`uint32 public constant MIN_GAS_LIMIT = 200000`  
Минимальное кол-во газа, которое может быть потрачено при получении рандомного числа в ответ на запрос.

`VRFCoordinatorV2Interface public COORDINATOR`  
Объект интерфейса `Chainlink` координатора по адресу `COORDINATOR`.

`uint64 private s_subscriptionId`  
Идентификатор подписки на `VRF Chainlink`.

`uint256[] public requestIds`  
Массив содержащий идентификаторы всех запросов случайных чисел.

`uint256 public lastRequestId`  
Идентификатор последнего совершенного запроса случайных чисел.

`bytes32 public keyHash = 0xd4bb89654db74673a187bd804519e65e3f71a52bc55f11da7601a13dcf505314`  
Идентификатор определения стоимости газа ответа на запрос случайных чисел от `COORDINATOR`.  
Указано тестовое значение.

`uint32 public callbackGasLimit = 200000`  
Кол-во газа, которое может быть потрачено при получении рандомного числа в ответ на запрос.  
Указано тестовое значение.

`uint16 public requestConfirmations = 5`  
Кол-во подтверждений, которое будет использовано для ожидания валидности запроса.  
Указано тестовое значение.

`uint32 public numWords = 1`  
Кол-во чисел, которое будет получено в одном запросе случайных чисел.  
Указано тестовое значение.

`mapping(address => bool) public allowedCaller`  
Сопоставление адреса флагу true/false, если true - адрес может создавать запросы случайных чисел.

`mapping(uint256 => address) public requestCaller`  
Сопоставление идентификатора запроса адресу, который его создал. 

`mapping(uint256 => RequestStatus) public s_requests`  
Содержит данные о совершенных запросах по их идентификаторах.

### Функции

`function requestRandomWords() external returns(uint256 requestId)`  
Создает запрос случайного числа у `COORDINATOR`. Вызывается только `allowedCaller`.

#### Функции управления (вызываются только овнером)

`function setAllowedCaller(address target) external onlyOwner()`  
Добавляет или удаляет указанный адрес в `allowedCaller`.

`function setKeyHash(bytes32 newKeyHash) external onlyOwner()`  
Устанавливает новое значение `keyHash`. **Рекомендуется вызывать только с утверждения разработчика.**

`function setCallbackGasLimit(uint32 newCallbackGasLimit) external onlyOwner()`  
Устанавливает новое значение `callbackGasLimit`. **Рекомендуется вызывать только с утверждения разработчика.**

`function setRequestConfirmations(uint16 newRequestConfirmations) external onlyOwner()`  
Устанавливает новое значение `requestConfirmations`. **Рекомендуется вызывать только с утверждения разработчика.**

`function setNumWords(uint32 newNumWords) external onlyOwner()`  
Устанавливает новое значение `numWords`. **Рекомендуется вызывать только с утверждения разработчика.**

#### View функции

`function getRequestStatus(uint256 requestId) external view returns(bool fulfilled, uint256[] memory randomWords)`  
Возвращает массив случайных чисел полученных от `COORDINATOR` и флаг их готовности по указанному идентификатору запроса.

### Ошибки

`IDPOracle: exceeded max` - указанное значение превышает допустимое  
`IDPOracle: below min` - указанное значение ниже допустимого  
`IDPOracle: forbidden` - попытка создать запрос случайных чисел адресом, не являющимся `allowedCaller`  
`IDPOracle: request not found` - указанный идентификатор запроса не существует  

## Смарт контракт IDPLottery

Контракт лотереи `IDPToken`. Позволяет участвовать в различных по стоимости билетов лотереях и получать выигрыш, в случае победы.
Случайность выигрышного билета обеспечивается случайными числами от `Chainlink`.

### Переменные

`uint public constant DENOMINATOR = 1000000 = 100%`  
Значение равное 100%, используется для точности вычислений.

`uint public constant FEE_INTEREST = 100000 = 10%`  
Процент комиссии, взимаемый с каждой покупки билетов лотереи.

`uint public constant MAX_PARTICIPANTS = 10`   
Максимальное кол-во участников в одном раунде лотереи. 

`uint public vaultFeeInterest`  
Процент от комиссии, который направляется в резерв контракта `IDPVault`.

`uint public totalLotteries`  
Кол-во всех созданных раундов лотерей.

`uint public storedFee`  
Кол-во собранных и доступных для распределения токенов `IDPToken` в виде комиссий.

`address public immutable protocolToken`  
Адрес контракта `IDPToken`.

`address public immutable vault`  
Адрес контракта `IDPVault`.

`address public immutable oracle`  
Адрес контракта `IDPOracle`.

`bool public autoRefillEnabled`  
Флаг режима авто-пополнения подписки `Chainlink` за счет собранных комиссий `storedFee`.

`SwapConfig public swapConfig`  
Конфигурация `SwapConfig` авто-пополнения подписки `Chainlink` за счет собранных комиссий `storedFee`.

`mapping(uint => uint) public roundTypePaused`  
Содержит метку времени начала паузы указанного раунда лотереи.

`mapping(uint => uint) public roundTypeActive`  
Содержит предполагаемый идентификатор следующего раунда лотереи по ее указанному типу. 

`mapping(uint => uint) public roundTypePrice`  
Содержит цену одного билета лотереи по ее указанному типу.

`mapping(uint => Lottery) public lotteries`  
Содержит всю информацию по каждому раунду лотереи `Lottery` по ее указанному идентификатору.

struct `Lottery` {  
    uint `startTime` - временная метка начала раунда  
    uint `endTime` - временная метка конца раунда  
    uint `ticketPrice` - цена одного билета раунда  
    uint `purchasedTickets` - кол-во уже купленных билетов в этом раунде  
    uint `winningTicket` - номер выигрышного билета в этом раунде  
    address `winner` -  адрес победителя в этом раунде  
    uint `requestId` - идентификатор запроса случайного числа, сделанного для этого раунда  
    mapping(uint => address) `ticketOwner` - сопоставление номера билета его владельцу  
}

struct `SwapConfig` {  
    address `router` - адрес используемого для авто свапа роутера `UniswapV2` протокола  
    address[] `path` - путь токенов для обмена, от `IDPToken` до `peggedLinkToken`  
    uint `amountOutMin` - минимальное кол-во для получения `peggedLinkToken` при свапе   
    uint `deadline` - добавочный `deadline` для транзакции свапа  
    bool `useIdpDex` - флаг, используется ли `IDPRouter` или иной  
    address `pegSwap` - контракт `PegSwap`, для обмена `peggedLinkToken` на `linkToken`  
    address `coordinator` - адрес координатора, к которому подключен `IDPOracle`  
    address `peggedLinkToken` - адрес контракта `peggedLinkToken`  
    address `linkToken` - адрес контракта `linkToken`  
    bytes `subscriptionId` - идентификатор подписки `IDPOracle`   
}

### Функции

`function autoRefill() external`  
Метод автоматического свапа `IDPToken` собранных комиссий `storedFee` на `linkToken` и пополнения подписки `IDPOracle`.
Вызываетя только при `storedFee` более 10 токенов и во время клейма выигрыша лотереи `claimRewards`.

#### Пользовательские функции

`function buyTicket(uint roundType, uint ticketsAmount) external nonReentrant() returns(uint lotteryId)`  
Метод для покупки билетов лотереи в определенном раунде `roundType`. Билеты покупаются либо в уже начатом раунде, либо создается новый раунд.
Метод принимает тип раунда `roundType` (по стоимости билетов) и кол-во покупаемых билетов `ticketsAmount`, возвращает идентификатор раунда лотереи, в котором происходит участие.

`function claimRewards(uint[] memory lotteryIds) external nonReentrant()`  
Метод для клейма выигрыша от выигранных лотерей. Метод принимает массив идентификаторов раундов лотерей. 
Метод может вызвать кто угодно, не зависимо от того, является ли он победителем указанных раундов.

#### Функции управления (вызываются только овнером)

`function setVaultFeeInterest(uint newVaultFeeInterest) external onlyOwner()`  
Устанавливает новое значение `vaultFeeInterest`, процент от комиссий который направляется в резерв контракта `IDPVault`.
То есть устанавливается процент от комиссий, а не от изначальной суммы. Пример: пользователь покупает 10 билетов по 10 токенов. Сумма оплаты 100 токенов.
Комиссия протокола в этом случае составляет 10 токенов(10%). Значение `vaultFeeInterest` равняется `500000` (50%), в этом случае 5 токенов будут отправлены получателям комиссий, а еще 5 токенов будут направлены в резерв контракта `IDPVault`. Соответственно при значении 0%, вся комиссия распределяется среди получателей, а при значении 100%, вся комиссия  направляется в резерв контракта `IDPVault`.

`function pauseRoundType(uint roundType) external onlyOwner()`  
Останавливает определенный тип раундов лотереи. Если раунд уже начался, его можно закончить, но следующий не начнется, пока пауза не будет снята.

`function unpauseRoundType(uint roundType) external onlyOwner()`  
Возобновляет определенный тип раундов лотереи после паузы. 

`function withdrawExcessToken(address token, uint amount, address receiver) external nonReentrant() onlyOwner()`  
Выводит нативный `BNB` или любой токен с контракта. Если указанный токен является `protocolToken`, то он распределяется как комиссия по стандартным правилам распределения.

`function setAutoRefillEnabled(bool enabled) external onlyOwner()`  
Включает или выключает режим `autoRefillEnabled` автоматического свапа `IDPToken` собранных комиссий `storedFee` на `linkToken` и пополнения подписки `IDPOracle` во время клейма выигрыша лотереи `claimRewards`.

`function setSwapConfig(SwapConfig calldata newConfig) external onlyOwner()`  
Устанавливает `swapConfig` автоматического свапа `autoRefill`. **Рекомендуется вызывать только с утверждения разработчика.**

#### View функции

`function getTicketOwner(uint lotteryId, uint ticketNumber) external view returns(address owner)`  
Функция принимает идентификатор раунда лотереи `lotteryId` и номер билета `ticketNumber`, возвращает адрес владельце этого билета. 
Если возвращается нулевой адрес - билет еще не куплен.

`function getRoundParticipants(uint lotteryId) external view returns(address[10] memory participantsList)`  
Возвращает массив, состоящий из 10 адресов участников указанного раунда лотереи `lotteryId`. 
Индекс массива соответствует номеру билета.
Все адреса нулевые - раунд лотереи еще не начался.
Дублирующиеся адреса - один пользователь приобрел несколько билетов.
Нулевой адрес - билет не куплен.

`function getActiveRound(uint roundType) external view returns(uint activeRoundId)`  
Возвращает либо текущий идентификатор лотереи, либо предполагаемый следующий для указанного типа раунда `roundType`. 
Если он будет занят другим раундом, то предполагаемый так же изменится.

`function getRandomNumber(uint requestId) public view returns(uint randomNumber)`  
Возвращает номер выигрышного билета (0-9) по указанному идентификатору запроса случайного числа `requestId`.
У каждой завершенной лотереи свой уникальный идентификатор запроса `requestId`.

`function getProtocolFee(uint ticketsAmount, uint ticketPrice) public pure returns(uint feeAmount)`  
Возвращает размер комиссии в `IDPToken`, зависимо от указанных кол-ва билетов `ticketsAmount` и стоимости одного билета `ticketPrice`.

### События

`event AutoRefillSucceeds()` - вызывается при успешном авто пополнении подписки `IDPOracle`  
`event SubscriptionRefilled(uint amountToRefill)` - вызывается при успешном авто пополнении подписки `IDPOracle`, отдает кол-во пополненных токенов `linkToken`  
`event AutoRefillFailed()` - вызывается при неудачном авто пополнении подписки `IDPOracle`  
`event RoundStarted(address account, uint lotteryId, uint roundType)` - вызывается при начале нового раунда лотереи  
`event TicketsPurchased(address account, uint lotteryId, uint ticketPrice, uint ticketsAmount)` - вызывается при покупке билетов лотереи  
`event RoundEnded(address account, uint lotteryId, uint roundType, uint requestId)` - вызывается при окончании нового раунда лотереи  
`event RewardClaimed(address account, uint lotteryId, uint winningTicket, address winner, uint reward)` - вызывается при клейме выигрыша лотереи  
`event FeeStored(uint feeAmount)` - вызывается при пополнении `storedFee` комиссиями при покупке билетов `buyTicket` при включенном `autoRefillEnabled`  

### Ошибки

`IDPLottery: invalid roundType` - указан не существующий тип раунда `roundType` лотереи  
`IDPLottery: zero ticketsAmount` - указанное кол-во билетов для покупки равно нулю  
`IDPLottery: paused` - указанный тип раунда лотереи `roundType` остановлен  
`IDPLottery: ticketsAmount exceeded` - превышено максимальное кол-во билетов для покупки  
`IDPLottery: invalid lotteryIds length` - указан пустой массив лотерей для клейма выигрышей  
`IDPLottery: invalid lotteryId` - указан идентификатор лотереи, которая еще не начата  
`IDPLottery: too soon` - клейм выигрыша доступен только после получения случайного числа, 10сек.+  
`IDPLottery: claimed` - выигрыш по указанному идентификатору лотереи уже был отправлен  
`IDPLottery: exceeded max value` - новое значение `newVaultFeeInterest` превышает допустимое `DENOMINATOR == 1000000 == 100%`  
`IDPLottery: unpaused` - работа указанного типа раунда `roundType` лотереи уже возобновлена  
`IDPLottery: invalid amount` - в методе `withdrawExcessToken` указано значение `amount` равное нулю  
`IDPLottery: zero address` - в методе `withdrawExcessToken` указан получатель `receiver` равный нулевому адресу  
`IDPLottery: ETH transfer failed` - в методе `withdrawExcessToken` указанный получатель не может получить нативный `BNB`  
`IDPLottery: storedFee absent` - указанный `amount` меньше собранных комиссий `storedFee`  
`IDPLottery: not fulfilled request` - ответ на запрос случайных чисел еще не получен  
`IDPLottery: invalid random value` - полученное случайное число равно 0  
`IDPLottery: forbidden` - метод `autoRefill` может вызываться только через метод `claimRewards`  