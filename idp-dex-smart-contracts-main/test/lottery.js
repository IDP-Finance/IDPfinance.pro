const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const helpers = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const withDecimals = ethers.parseEther;
const withoutDecimals = ethers.formatEther;

describe("IDP Lottery", function () {
    async function deployLotteryFixture() {

        const [deployer, admin, userOne, userTwo, userThree, userFour, userFive] = await ethers.getSigners();

        const StableToken = await ethers.getContractFactory("StableToken", admin);
        const stable = await StableToken.deploy(admin);
        await stable.waitForDeployment();

        const IDPToken = await ethers.getContractFactory("IDPToken", deployer);
        const token = await IDPToken.deploy(admin);
        await token.waitForDeployment();

        const BEP20USDT = await ethers.getContractFactory("BEP20USDT", admin);
        const usdt = await BEP20USDT.deploy();
        await usdt.waitForDeployment();

        const IDPFactory = await ethers.getContractFactory("IDPFactory", deployer);
        const factory = await IDPFactory.deploy(admin, token.target);
        await factory.waitForDeployment();

        const WBNB = await ethers.getContractFactory("WBNB", deployer);
        const wbnb = await WBNB.deploy();
        await wbnb.waitForDeployment();

        const IDPVault = await ethers.getContractFactory("IDPVault", deployer);
        const vault = await IDPVault.deploy(admin, token.target, usdt.target);
        await vault.waitForDeployment();

        const IDPRouter = await ethers.getContractFactory("IDPRouter", deployer);
        const router = await IDPRouter.deploy(admin, factory.target, wbnb.target, vault.target, token.target);
        await router.waitForDeployment();

        const VRFCoordinator = await ethers.getContractFactory("contracts/mock/VRFCoordinator.sol:VRFCoordinator", deployer);
        const coordinator = await VRFCoordinator.deploy();
        await coordinator.waitForDeployment();

        const subscriptionId = 797;

        const IDPOracle = await ethers.getContractFactory("IDPOracle", deployer);
        const oracle = await IDPOracle.deploy(admin, coordinator.target, subscriptionId);
        await oracle.waitForDeployment();

        const IDPLottery = await ethers.getContractFactory("IDPLottery", deployer);
        const lottery = await IDPLottery.deploy(admin, token.target, vault.target, oracle.target);
        await lottery.waitForDeployment();

        const PegSwap = await ethers.getContractFactory("PegSwap", deployer);
        const pegSwap = await PegSwap.deploy();
        await pegSwap.waitForDeployment();

        const ChainlinkToken = await ethers.getContractFactory("ChainlinkToken", admin);
        const linkToken = await ChainlinkToken.deploy();
        await linkToken.waitForDeployment();

        await factory.connect(admin).setRouter(router.target);
        await oracle.connect(admin).setAllowedCaller(lottery.target);

        await usdt.connect(admin).mint(withDecimals("20000000000"));

        const zeroAddress = ethers.ZeroAddress;

        return {
            deployer, admin, userOne, userTwo, userThree, userFour, userFive, usdt, factory, wbnb, router, coordinator,
            zeroAddress, token, vault, oracle, lottery, stable, pegSwap, linkToken
        };
    };

    describe("Deployment", function () {
        it("Init storage check", async () => {
            const { lottery, admin, token, vault, oracle, zeroAddress } = await loadFixture(deployLotteryFixture);

            expect(await lottery.owner()).to.equal(admin);
            expect(await lottery.protocolToken()).to.equal(token.target);
            expect(await lottery.vault()).to.equal(vault.target);
            expect(await lottery.oracle()).to.equal(oracle.target);
            expect(await lottery.vaultFeeInterest()).to.equal(0);
            expect(await lottery.totalLotteries()).to.equal(0);
            expect(await lottery.autoRefillEnabled()).to.equal(false);
            expect(await lottery.storedFee()).to.equal(0);
            expect(await lottery.roundTypePrice(0)).to.equal(withDecimals("1"));
            expect(await lottery.roundTypePrice(1)).to.equal(withDecimals("10"));
            expect(await lottery.roundTypePrice(2)).to.equal(withDecimals("100"));
            expect(await lottery.roundTypePrice(3)).to.equal(withDecimals("1000"));
            expect(await lottery.roundTypePrice(4)).to.equal(0);

            expect(await lottery.roundTypePaused(0)).to.equal(0);
            expect(await lottery.roundTypePaused(1)).to.equal(0);
            expect(await lottery.roundTypePaused(2)).to.equal(0);
            expect(await lottery.roundTypePaused(3)).to.equal(0);
            expect(await lottery.roundTypePaused(4)).to.equal(0);

            expect(await lottery.roundTypeActive(0)).to.equal(0);
            expect(await lottery.roundTypeActive(1)).to.equal(0);
            expect(await lottery.roundTypeActive(2)).to.equal(0);
            expect(await lottery.roundTypeActive(3)).to.equal(0);
            expect(await lottery.roundTypeActive(4)).to.equal(0);

            const config = await lottery.swapConfig();

            expect(config.router).to.equal(zeroAddress);
            expect(config.deadline).to.equal(0);
            expect(config.pegSwap).to.equal(zeroAddress);
            expect(config.coordinator).to.equal(zeroAddress);
            expect(config.peggedLinkToken).to.equal(zeroAddress);
            expect(config.linkToken).to.equal(zeroAddress);
            expect(config.subscriptionId).to.equal("0x");
        });
    });

    describe("Owner functions", function () {
        describe("setVaultFeeInterest", function () {
            it("Should revert call by not an owner", async () => {
                const { lottery, userOne } = await loadFixture(deployLotteryFixture);

                await expect(lottery.connect(userOne).setVaultFeeInterest(1)).to.be.
                    revertedWithCustomError(lottery, "OwnableUnauthorizedAccount").withArgs(userOne);
            });

            it("Should revert call by max value exceeded", async () => {
                const { lottery, admin } = await loadFixture(deployLotteryFixture);

                await expect(lottery.connect(admin).setVaultFeeInterest(1000001)).to.be.revertedWith(
                    "IDPLottery: exceeded max value"
                );
            });

            it("Should store right value", async () => {
                const { lottery, admin } = await loadFixture(deployLotteryFixture);

                await lottery.connect(admin).setVaultFeeInterest(999967);

                expect(await lottery.vaultFeeInterest()).to.equal(999967);

                await lottery.connect(admin).setVaultFeeInterest(0);

                expect(await lottery.vaultFeeInterest()).to.equal(0);

                await lottery.connect(admin).setVaultFeeInterest(111999);

                expect(await lottery.vaultFeeInterest()).to.equal(111999);
            });
        });

        describe("pauseRoundType", function () {
            it("Should revert call by not an owner", async () => {
                const { lottery, userOne } = await loadFixture(deployLotteryFixture);

                await expect(lottery.connect(userOne).pauseRoundType(1)).to.be.
                    revertedWithCustomError(lottery, "OwnableUnauthorizedAccount").withArgs(userOne);
            });

            it("Should revert call by invalidRoundType", async () => {
                const { lottery, admin } = await loadFixture(deployLotteryFixture);

                await expect(lottery.connect(admin).pauseRoundType(4)).to.be.revertedWith(
                    "IDPLottery: invalid roundType"
                );
            });

            it("Should revert call by paused already", async () => {
                const { lottery, admin } = await loadFixture(deployLotteryFixture);

                await lottery.connect(admin).pauseRoundType(1);

                await expect(lottery.connect(admin).pauseRoundType(1)).to.be.revertedWith(
                    "IDPLottery: paused"
                );
            });

            it("Should store right value", async () => {
                const { lottery, admin } = await loadFixture(deployLotteryFixture);

                await lottery.connect(admin).pauseRoundType(1);

                expect(await lottery.roundTypePaused(1)).to.equal(await helpers.time.latest());

                await lottery.connect(admin).unpauseRoundType(1);

                expect(await lottery.roundTypePaused(1)).to.equal(0);

                await helpers.time.increase(1000);

                await lottery.connect(admin).pauseRoundType(1);

                expect(await lottery.roundTypePaused(1)).to.equal(await helpers.time.latest());
            });
        });

        describe("unpauseRoundType", function () {
            it("Should revert call by not an owner", async () => {
                const { lottery, userOne } = await loadFixture(deployLotteryFixture);

                await expect(lottery.connect(userOne).unpauseRoundType(1)).to.be.
                    revertedWithCustomError(lottery, "OwnableUnauthorizedAccount").withArgs(userOne);
            });

            it("Should revert call by invalidRoundType", async () => {
                const { lottery, admin } = await loadFixture(deployLotteryFixture);

                await expect(lottery.connect(admin).unpauseRoundType(4)).to.be.revertedWith(
                    "IDPLottery: invalid roundType"
                );
            });

            it("Should revert call by unpaused already", async () => {
                const { lottery, admin } = await loadFixture(deployLotteryFixture);

                await expect(lottery.connect(admin).unpauseRoundType(1)).to.be.revertedWith(
                    "IDPLottery: unpaused"
                );
            });

            it("Should store right value", async () => {
                const { lottery, admin } = await loadFixture(deployLotteryFixture);

                await lottery.connect(admin).pauseRoundType(1);

                expect(await lottery.roundTypePaused(1)).to.equal(await helpers.time.latest());

                await lottery.connect(admin).unpauseRoundType(1);

                expect(await lottery.roundTypePaused(1)).to.equal(0);

                await helpers.time.increase(1000);

                await lottery.connect(admin).pauseRoundType(1);

                expect(await lottery.roundTypePaused(1)).to.equal(await helpers.time.latest());

                await lottery.connect(admin).unpauseRoundType(1);

                expect(await lottery.roundTypePaused(1)).to.equal(0);

                await helpers.time.increase(1000);

                await lottery.connect(admin).pauseRoundType(2);

                expect(await lottery.roundTypePaused(2)).to.equal(await helpers.time.latest());

                await lottery.connect(admin).unpauseRoundType(2);

                expect(await lottery.roundTypePaused(2)).to.equal(0);
            });
        });

        describe("withdrawExcessToken", function () {
            it("Should revert call by not an owner", async () => {
                const { lottery, userOne } = await loadFixture(deployLotteryFixture);

                await expect(lottery.connect(userOne).withdrawExcessToken(userOne, 1, userOne)).to.be.
                    revertedWithCustomError(lottery, "OwnableUnauthorizedAccount").withArgs(userOne);
            });

            it("Should revert call by zero amount", async () => {
                const { lottery, admin } = await loadFixture(deployLotteryFixture);

                await expect(lottery.connect(admin).withdrawExcessToken(admin, 0, admin)).to.be.revertedWith(
                    "IDPLottery: invalid amount"
                );
            });

            it("Should revert call by zero receiver address", async () => {
                const { lottery, admin, zeroAddress } = await loadFixture(deployLotteryFixture);

                await expect(lottery.connect(admin).withdrawExcessToken(admin, 1, zeroAddress)).to.be.revertedWith(
                    "IDPLottery: zero address"
                );
            });

            describe("ether withdraw", function () {
                it("Should revert call by zero eth balance", async () => {
                    const { lottery, admin, zeroAddress } = await loadFixture(deployLotteryFixture);

                    await expect(lottery.connect(admin).withdrawExcessToken(zeroAddress, 1, admin)).to.be.revertedWith(
                        "IDPLottery: ETH transfer failed"
                    );
                });

                it("Should revert call by transfer to non receiver", async () => {
                    const { lottery, admin, zeroAddress, stable } = await loadFixture(deployLotteryFixture);

                    const amountToTransfer = withDecimals("1");

                    await stable.connect(admin).transferEth(lottery.target, { value: amountToTransfer });

                    expect(await ethers.provider.getBalance(lottery.target)).to.equal(amountToTransfer);

                    await expect(lottery.connect(admin).withdrawExcessToken(zeroAddress, amountToTransfer, lottery)).to.be.revertedWith(
                        "IDPLottery: ETH transfer failed"
                    );
                });

                it("Should pass ether withdraw", async () => {
                    const { lottery, admin, zeroAddress, stable, userOne } = await loadFixture(deployLotteryFixture);

                    const amountToTransfer = withDecimals("1");

                    await stable.connect(admin).transferEth(lottery.target, { value: amountToTransfer });

                    expect(await ethers.provider.getBalance(lottery.target)).to.equal(amountToTransfer);

                    const etherBalanceBefore = await ethers.provider.getBalance(userOne);

                    await lottery.connect(admin).withdrawExcessToken(zeroAddress, amountToTransfer, userOne);

                    const etherBalanceAfter = await ethers.provider.getBalance(userOne);

                    expect(etherBalanceBefore + amountToTransfer).to.equal(etherBalanceAfter);

                    expect(await ethers.provider.getBalance(lottery.target)).to.equal(0);
                });
            });

            describe("external token withdraw", function () {
                it("Should revert call by zero token balance", async () => {
                    const { lottery, admin, stable } = await loadFixture(deployLotteryFixture);

                    await expect(lottery.connect(admin).withdrawExcessToken(stable, 1, admin)).to.be.
                        revertedWithCustomError(stable, "ERC20InsufficientBalance").withArgs(lottery.target, 0, 1);
                });

                it("Should pass token withdraw", async () => {
                    const { lottery, admin, stable, userOne } = await loadFixture(deployLotteryFixture);

                    const amountToTransfer = withDecimals("100");

                    await stable.connect(admin).transfer(lottery.target, amountToTransfer);

                    expect(await stable.balanceOf(lottery.target)).to.equal(amountToTransfer);

                    const stableBalanceBefore = await stable.balanceOf(userOne);

                    await lottery.connect(admin).withdrawExcessToken(stable.target, amountToTransfer, userOne);

                    const stableBalanceAfter = await stable.balanceOf(userOne);

                    expect(stableBalanceBefore + amountToTransfer).to.equal(stableBalanceAfter);
                    expect(await stable.balanceOf(lottery.target)).to.equal(0);
                });
            });

            describe("protocol token withdraw", function () {
                it("Should revert call by storedFee absent", async () => {
                    const { lottery, admin, token, userOne } = await loadFixture(deployLotteryFixture);

                    await expect(lottery.connect(admin).withdrawExcessToken(token, 1, admin)).to.be.revertedWith(
                        "IDPLottery: storedFee absent"
                    );

                    const amountToMint = withDecimals("100000");

                    await token.connect(admin).setVault(admin);
                    await token.connect(admin).mint(admin, amountToMint);
                    await token.connect(admin).approve(lottery.target, amountToMint);

                    await token.connect(admin).mint(userOne, amountToMint);
                    await token.connect(userOne).approve(lottery.target, amountToMint);

                    await lottery.connect(admin).setAutoRefillEnabled(true);

                    await lottery.connect(userOne).buyTicket(1, 10);

                    expect(await lottery.storedFee()).to.equal(withDecimals("10"));

                    await expect(lottery.connect(admin).withdrawExcessToken(token, withDecimals("10"), admin)).to.be.revertedWith(
                        "IDPLottery: storedFee absent"
                    );
                });

                it("Should pass with store right data", async () => {
                    const { lottery, admin, token, userOne, vault } = await loadFixture(deployLotteryFixture);

                    const amountToMint = withDecimals("100000");

                    await token.connect(admin).setVault(admin);
                    await token.connect(admin).mint(admin, amountToMint);
                    await token.connect(admin).approve(lottery.target, amountToMint);

                    await token.connect(admin).mint(userOne, amountToMint);
                    await token.connect(userOne).approve(lottery.target, amountToMint);

                    await lottery.connect(admin).setAutoRefillEnabled(true);

                    await lottery.connect(userOne).buyTicket(1, 10);

                    expect(await lottery.storedFee()).to.equal(withDecimals("10"));

                    const amountToWithdraw = withDecimals("10") - 1n;

                    const vaultBalanceBefore = await token.balanceOf(vault.target);
                    const adminBalanceBefore = await token.balanceOf(admin);
                    const lotteryBalanceBefore = await token.balanceOf(lottery.target);

                    await lottery.connect(admin).withdrawExcessToken(token, amountToWithdraw, admin);

                    const vaultBalanceAfter = await token.balanceOf(vault.target);
                    const adminBalanceAfter = await token.balanceOf(admin);
                    const lotteryBalanceAfter = await token.balanceOf(lottery.target);

                    expect(vaultBalanceBefore + amountToWithdraw).to.equal(vaultBalanceAfter);
                    expect(adminBalanceBefore).to.equal(adminBalanceAfter);
                    expect(lotteryBalanceBefore - amountToWithdraw).to.equal(lotteryBalanceAfter);

                    expect(await lottery.storedFee()).to.equal(1n);

                    await expect(lottery.connect(admin).withdrawExcessToken(token, 1, admin)).to.be.revertedWith(
                        "IDPLottery: storedFee absent"
                    );
                });
            });
        });

        describe("setAutoRefillEnabled", function () {
            it("Should revert call by not an owner", async () => {
                const { lottery, userOne } = await loadFixture(deployLotteryFixture);

                await expect(lottery.connect(userOne).setAutoRefillEnabled(true)).to.be.
                    revertedWithCustomError(lottery, "OwnableUnauthorizedAccount").withArgs(userOne);
            });

            it("Should store right value", async () => {
                const { lottery, admin } = await loadFixture(deployLotteryFixture);

                await lottery.connect(admin).setAutoRefillEnabled(true);

                expect(await lottery.autoRefillEnabled()).to.equal(true);

                await lottery.connect(admin).setAutoRefillEnabled(true);

                expect(await lottery.autoRefillEnabled()).to.equal(true);

                await lottery.connect(admin).setAutoRefillEnabled(false);

                expect(await lottery.autoRefillEnabled()).to.equal(false);

                await lottery.connect(admin).setAutoRefillEnabled(true);

                expect(await lottery.autoRefillEnabled()).to.equal(true);
            });
        });

        describe("setSwapConfig", function () {
            it("Should revert call by not an owner", async () => {
                const { lottery, userOne, userTwo, userThree, router, token, stable, coordinator } = await loadFixture(deployLotteryFixture);

                const subscriptionId = "0x0000000000000000000000000000000000000000000000000000000000000001";

                await expect(lottery.connect(userOne).setSwapConfig([
                    router.target,
                    [token.target, stable.target],
                    0,
                    999999999999,
                    false,
                    userOne,
                    coordinator.target,
                    userTwo,
                    userThree,
                    subscriptionId
                ])).to.be.revertedWithCustomError(lottery, "OwnableUnauthorizedAccount").withArgs(userOne);
            });

            it("Should store right value", async () => {
                const { lottery, admin, userOne, userTwo, userThree, router, token, stable, coordinator } = await loadFixture(deployLotteryFixture);

                const subscriptionId = "0x0000000000000000000000000000000000000000000000000000000000000001";

                await lottery.connect(admin).setSwapConfig([
                    router.target,
                    [token.target, stable.target],
                    0,
                    999999999999,
                    true,
                    userOne,
                    coordinator.target,
                    userTwo,
                    userThree,
                    subscriptionId
                ]);

                const config = await lottery.swapConfig();

                expect(config.router).to.equal(router.target);
                expect(config.amountOutMin).to.equal(0);
                expect(config.deadline).to.equal(999999999999);
                expect(config.useIdpDex).to.equal(true);
                expect(config.pegSwap).to.equal(userOne);
                expect(config.coordinator).to.equal(coordinator.target);
                expect(config.peggedLinkToken).to.equal(userTwo);
                expect(config.linkToken).to.equal(userThree);
                expect(config.subscriptionId).to.equal(subscriptionId);
            });
        });

        describe("renounceOwnership", function () {
            it("Should revert call by not an owner", async () => {
                const { lottery, userOne } = await loadFixture(deployLotteryFixture);

                await expect(lottery.connect(userOne).renounceOwnership()).to.be.
                    revertedWithCustomError(lottery, "OwnableUnauthorizedAccount").withArgs(userOne);
            });

            it("Should revert call by an owner", async () => {
                const { lottery, admin } = await loadFixture(deployLotteryFixture);

                await expect(lottery.connect(admin).renounceOwnership()).to.be.reverted;
            });
        });
    });

    describe("View functions", function () {
        describe("getTicketOwner", function () {
            it("Should returns zero address before round starts", async () => {
                const { lottery, zeroAddress } = await loadFixture(deployLotteryFixture);

                for (let i = 0; 10 > i; i++) {
                    expect(await lottery.getTicketOwner(0, i)).to.equal(zeroAddress);
                }
            });

            it("Should returns right addresses", async () => {
                const { token, lottery, zeroAddress, admin, userOne, userTwo } = await loadFixture(deployLotteryFixture);

                const amountToMint = withDecimals("1000000");

                await token.connect(admin).setVault(admin);
                await token.connect(admin).mint(admin, amountToMint);
                await token.connect(admin).approve(lottery.target, amountToMint);

                await token.connect(admin).mint(userOne, amountToMint);
                await token.connect(userOne).approve(lottery.target, amountToMint);

                await token.connect(admin).mint(userTwo, amountToMint);
                await token.connect(userTwo).approve(lottery.target, amountToMint);

                await lottery.connect(admin).buyTicket(0, 2);
                await lottery.connect(userOne).buyTicket(0, 3);
                await lottery.connect(userTwo).buyTicket(0, 4);

                expect(await lottery.getTicketOwner(0, 0)).to.equal(admin);
                expect(await lottery.getTicketOwner(0, 1)).to.equal(admin);
                expect(await lottery.getTicketOwner(0, 2)).to.equal(userOne);
                expect(await lottery.getTicketOwner(0, 3)).to.equal(userOne);
                expect(await lottery.getTicketOwner(0, 4)).to.equal(userOne);
                expect(await lottery.getTicketOwner(0, 5)).to.equal(userTwo);
                expect(await lottery.getTicketOwner(0, 6)).to.equal(userTwo);
                expect(await lottery.getTicketOwner(0, 7)).to.equal(userTwo);
                expect(await lottery.getTicketOwner(0, 8)).to.equal(userTwo);
                expect(await lottery.getTicketOwner(0, 9)).to.equal(zeroAddress);
                expect(await lottery.getTicketOwner(0, 10)).to.equal(zeroAddress);

                await lottery.connect(admin).buyTicket(1, 2);
                await lottery.connect(userOne).buyTicket(2, 3);
                await lottery.connect(userTwo).buyTicket(3, 4);

                expect(await lottery.getTicketOwner(1, 0)).to.equal(admin);
                expect(await lottery.getTicketOwner(1, 1)).to.equal(admin);
                expect(await lottery.getTicketOwner(2, 0)).to.equal(userOne);
                expect(await lottery.getTicketOwner(2, 1)).to.equal(userOne);
                expect(await lottery.getTicketOwner(2, 2)).to.equal(userOne);
                expect(await lottery.getTicketOwner(3, 0)).to.equal(userTwo);
                expect(await lottery.getTicketOwner(3, 1)).to.equal(userTwo);
                expect(await lottery.getTicketOwner(3, 2)).to.equal(userTwo);
                expect(await lottery.getTicketOwner(3, 3)).to.equal(userTwo);

                expect(await lottery.getTicketOwner(1, 2)).to.equal(zeroAddress);
                expect(await lottery.getTicketOwner(2, 3)).to.equal(zeroAddress);
                expect(await lottery.getTicketOwner(3, 4)).to.equal(zeroAddress);

                expect(await lottery.getTicketOwner(0, 0)).to.equal(admin);
                expect(await lottery.getTicketOwner(0, 1)).to.equal(admin);
                expect(await lottery.getTicketOwner(0, 2)).to.equal(userOne);
                expect(await lottery.getTicketOwner(0, 3)).to.equal(userOne);
                expect(await lottery.getTicketOwner(0, 4)).to.equal(userOne);
                expect(await lottery.getTicketOwner(0, 5)).to.equal(userTwo);
                expect(await lottery.getTicketOwner(0, 6)).to.equal(userTwo);
                expect(await lottery.getTicketOwner(0, 7)).to.equal(userTwo);
                expect(await lottery.getTicketOwner(0, 8)).to.equal(userTwo);
                expect(await lottery.getTicketOwner(0, 9)).to.equal(zeroAddress);
                expect(await lottery.getTicketOwner(0, 10)).to.equal(zeroAddress);
            });
        });

        describe("getRoundParticipants", function () {
            it("Should returns zero address before round starts", async () => {
                const { lottery, zeroAddress } = await loadFixture(deployLotteryFixture);

                const participantsList = await lottery.getRoundParticipants(0);

                for (let i = 0; 10 > i; i++) {
                    expect(participantsList[i]).to.equal(zeroAddress);
                }
            });

            it("Should returns right addresses", async () => {
                const { token, lottery, zeroAddress, admin, userOne, userTwo } = await loadFixture(deployLotteryFixture);

                const amountToMint = withDecimals("1000000");

                await token.connect(admin).setVault(admin);
                await token.connect(admin).mint(admin, amountToMint);
                await token.connect(admin).approve(lottery.target, amountToMint);

                await token.connect(admin).mint(userOne, amountToMint);
                await token.connect(userOne).approve(lottery.target, amountToMint);

                await token.connect(admin).mint(userTwo, amountToMint);
                await token.connect(userTwo).approve(lottery.target, amountToMint);

                await lottery.connect(admin).buyTicket(0, 2);
                await lottery.connect(userOne).buyTicket(0, 3);
                await lottery.connect(userTwo).buyTicket(0, 4);

                const participantsListZero = await lottery.getRoundParticipants(0);

                expect(participantsListZero[0]).to.equal(admin);
                expect(participantsListZero[1]).to.equal(admin);
                expect(participantsListZero[2]).to.equal(userOne);
                expect(participantsListZero[3]).to.equal(userOne);
                expect(participantsListZero[4]).to.equal(userOne);
                expect(participantsListZero[5]).to.equal(userTwo);
                expect(participantsListZero[6]).to.equal(userTwo);
                expect(participantsListZero[7]).to.equal(userTwo);
                expect(participantsListZero[8]).to.equal(userTwo);
                expect(participantsListZero[9]).to.equal(zeroAddress);

                await lottery.connect(admin).buyTicket(1, 2);
                await lottery.connect(userOne).buyTicket(2, 3);
                await lottery.connect(userTwo).buyTicket(3, 4);

                const participantsListOne = await lottery.getRoundParticipants(1);
                const participantsListTwo = await lottery.getRoundParticipants(2);
                const participantsListThree = await lottery.getRoundParticipants(3);

                expect(participantsListOne[0]).to.equal(admin);
                expect(participantsListOne[1]).to.equal(admin);
                expect(participantsListOne[2]).to.equal(zeroAddress);
                expect(participantsListOne[3]).to.equal(zeroAddress);
                expect(participantsListOne[4]).to.equal(zeroAddress);
                expect(participantsListOne[5]).to.equal(zeroAddress);
                expect(participantsListOne[6]).to.equal(zeroAddress);
                expect(participantsListOne[7]).to.equal(zeroAddress);
                expect(participantsListOne[8]).to.equal(zeroAddress);
                expect(participantsListOne[9]).to.equal(zeroAddress);

                expect(participantsListTwo[0]).to.equal(userOne);
                expect(participantsListTwo[1]).to.equal(userOne);
                expect(participantsListTwo[2]).to.equal(userOne);
                expect(participantsListTwo[3]).to.equal(zeroAddress);
                expect(participantsListTwo[4]).to.equal(zeroAddress);
                expect(participantsListTwo[5]).to.equal(zeroAddress);
                expect(participantsListTwo[6]).to.equal(zeroAddress);
                expect(participantsListTwo[7]).to.equal(zeroAddress);
                expect(participantsListTwo[8]).to.equal(zeroAddress);
                expect(participantsListTwo[9]).to.equal(zeroAddress);

                expect(participantsListThree[0]).to.equal(userTwo);
                expect(participantsListThree[1]).to.equal(userTwo);
                expect(participantsListThree[2]).to.equal(userTwo);
                expect(participantsListThree[3]).to.equal(userTwo);
                expect(participantsListThree[4]).to.equal(zeroAddress);
                expect(participantsListThree[5]).to.equal(zeroAddress);
                expect(participantsListThree[6]).to.equal(zeroAddress);
                expect(participantsListThree[7]).to.equal(zeroAddress);
                expect(participantsListThree[8]).to.equal(zeroAddress);
                expect(participantsListThree[9]).to.equal(zeroAddress);

                const participantsListZeroSecond = await lottery.getRoundParticipants(0);

                expect(participantsListZeroSecond[0]).to.equal(admin);
                expect(participantsListZeroSecond[1]).to.equal(admin);
                expect(participantsListZeroSecond[2]).to.equal(userOne);
                expect(participantsListZeroSecond[3]).to.equal(userOne);
                expect(participantsListZeroSecond[4]).to.equal(userOne);
                expect(participantsListZeroSecond[5]).to.equal(userTwo);
                expect(participantsListZeroSecond[6]).to.equal(userTwo);
                expect(participantsListZeroSecond[7]).to.equal(userTwo);
                expect(participantsListZeroSecond[8]).to.equal(userTwo);
                expect(participantsListZeroSecond[9]).to.equal(zeroAddress);
            });
        });

        describe("getActiveRound", function () {
            it("Should returns totalLotteries before round starts", async () => {
                const { lottery } = await loadFixture(deployLotteryFixture);

                expect(await lottery.getActiveRound(0)).to.equal(0);
                expect(await lottery.getActiveRound(1)).to.equal(0);
                expect(await lottery.getActiveRound(2)).to.equal(0);
                expect(await lottery.getActiveRound(3)).to.equal(0);
            });

            it("Should returns right values after round starts", async () => {
                const { lottery, token, admin } = await loadFixture(deployLotteryFixture);

                const amountToMint = withDecimals("1000000");

                await token.connect(admin).setVault(admin);
                await token.connect(admin).mint(admin, amountToMint);
                await token.connect(admin).approve(lottery.target, amountToMint);

                await lottery.connect(admin).buyTicket(1, 2);
                await lottery.connect(admin).buyTicket(0, 3);
                await lottery.connect(admin).buyTicket(3, 4);
                await lottery.connect(admin).buyTicket(2, 4);

                expect(await lottery.getActiveRound(0)).to.equal(1);
                expect(await lottery.getActiveRound(1)).to.equal(0);
                expect(await lottery.getActiveRound(2)).to.equal(3);
                expect(await lottery.getActiveRound(3)).to.equal(2);
            });

            it("Should returns right values after round ends", async () => {
                const { lottery, token, admin } = await loadFixture(deployLotteryFixture);

                const amountToMint = withDecimals("1000000");

                await token.connect(admin).setVault(admin);
                await token.connect(admin).mint(admin, amountToMint);
                await token.connect(admin).approve(lottery.target, amountToMint);

                await lottery.connect(admin).buyTicket(1, 2);
                await lottery.connect(admin).buyTicket(0, 3);
                await lottery.connect(admin).buyTicket(3, 4);
                await lottery.connect(admin).buyTicket(2, 4);

                expect(await lottery.getActiveRound(0)).to.equal(1);
                expect(await lottery.getActiveRound(1)).to.equal(0);
                expect(await lottery.getActiveRound(2)).to.equal(3);
                expect(await lottery.getActiveRound(3)).to.equal(2);

                await lottery.connect(admin).buyTicket(0, 7);
                await lottery.connect(admin).buyTicket(3, 6);

                expect(await lottery.getActiveRound(0)).to.equal(4);
                expect(await lottery.getActiveRound(1)).to.equal(0);
                expect(await lottery.getActiveRound(2)).to.equal(3);
                expect(await lottery.getActiveRound(3)).to.equal(4);

                await lottery.connect(admin).buyTicket(1, 8);
                await lottery.connect(admin).buyTicket(2, 6);

                expect(await lottery.getActiveRound(0)).to.equal(4);
                expect(await lottery.getActiveRound(1)).to.equal(4);
                expect(await lottery.getActiveRound(2)).to.equal(4);
                expect(await lottery.getActiveRound(3)).to.equal(4);

                await lottery.connect(admin).buyTicket(0, 2);
                await lottery.connect(admin).buyTicket(1, 2);

                expect(await lottery.getActiveRound(0)).to.equal(4);
                expect(await lottery.getActiveRound(1)).to.equal(5);
                expect(await lottery.getActiveRound(2)).to.equal(6);
                expect(await lottery.getActiveRound(3)).to.equal(6);

                await lottery.connect(admin).buyTicket(3, 1);

                expect(await lottery.getActiveRound(0)).to.equal(4);
                expect(await lottery.getActiveRound(1)).to.equal(5);
                expect(await lottery.getActiveRound(2)).to.equal(7);
                expect(await lottery.getActiveRound(3)).to.equal(6);
            });
        });

        describe("getRandomNumber", function () {
            it("Should revert call by invalid requestId", async () => {
                const { lottery, oracle } = await loadFixture(deployLotteryFixture);

                const requestNumber = 1;

                const requestOne = await oracle.s_requests(requestNumber);

                expect(requestOne.fulfilled).to.equal(false);
                expect(requestOne.exists).to.equal(false);

                await expect(lottery.getRandomNumber(requestNumber)).to.be.revertedWith(
                    "IDPOracle: request not found"
                );
            });

            it("Should revert call by not fulfilled request", async () => {
                const { lottery, oracle, admin } = await loadFixture(deployLotteryFixture);

                await oracle.connect(admin).setAllowedCaller(admin);

                const requestNumber = 1;

                const requestOne = await oracle.s_requests(requestNumber);

                expect(requestOne.fulfilled).to.equal(false);
                expect(requestOne.exists).to.equal(false);

                await oracle.connect(admin).requestRandomWords();

                const requestTwo = await oracle.s_requests(requestNumber);

                expect(requestTwo.fulfilled).to.equal(false);
                expect(requestTwo.exists).to.equal(true);

                await expect(lottery.getRandomNumber(requestNumber)).to.be.revertedWith(
                    "IDPLottery: not fulfilled request"
                );
            });

            it("Should revert call by invalid randomNumber", async () => {
                const { lottery, oracle, admin, coordinator } = await loadFixture(deployLotteryFixture);

                await oracle.connect(admin).setAllowedCaller(admin);

                const requestNumber = 1;

                const requestOne = await oracle.s_requests(requestNumber);

                expect(requestOne.fulfilled).to.equal(false);
                expect(requestOne.exists).to.equal(false);

                await oracle.connect(admin).requestRandomWords();

                const requestTwo = await oracle.s_requests(requestNumber);

                expect(requestTwo.fulfilled).to.equal(false);
                expect(requestTwo.exists).to.equal(true);

                await coordinator.provideRandomData(oracle.target, requestNumber, [0]);

                const requestThree = await oracle.s_requests(requestNumber);

                expect(requestThree.fulfilled).to.equal(true);
                expect(requestThree.exists).to.equal(true);

                await expect(lottery.getRandomNumber(requestNumber)).to.be.revertedWith(
                    "IDPLottery: invalid random value"
                );
            });

            it("Should returns right values", async () => {
                const { lottery, oracle, admin, coordinator } = await loadFixture(deployLotteryFixture);

                await oracle.connect(admin).setAllowedCaller(admin);

                for (let i = 1; 33 > i; i++) {
                    const requestNumber = i;
                    const randomNumber = i + 1;
                    await oracle.connect(admin).requestRandomWords();
                    await coordinator.provideRandomData(oracle.target, requestNumber, [randomNumber]);

                    expect(await lottery.getRandomNumber(requestNumber)).to.equal(randomNumber % 10);
                }
            });
        });

        describe("getProtocolFee", function () {
            it("Should returns zero by 0 ticketsAmount", async () => {
                const { lottery } = await loadFixture(deployLotteryFixture);

                expect(await lottery.getProtocolFee(0, withDecimals("10"))).to.equal(0);
            });

            it("Should returns zero by 0 ticketPrice", async () => {
                const { lottery } = await loadFixture(deployLotteryFixture);

                expect(await lottery.getProtocolFee(10, 0)).to.equal(0);
            });

            it("Should returns right values", async () => {
                const { lottery } = await loadFixture(deployLotteryFixture);

                expect(await lottery.getProtocolFee(1, withDecimals("1"))).to.equal(withDecimals("0.1"));
                expect(await lottery.getProtocolFee(2, withDecimals("1"))).to.equal(withDecimals("0.2"));
                expect(await lottery.getProtocolFee(2, withDecimals("0.5"))).to.equal(withDecimals("0.1"));
                expect(await lottery.getProtocolFee(3, withDecimals("3"))).to.equal(withDecimals("0.9"));
                expect(await lottery.getProtocolFee(3, withDecimals("10"))).to.equal(withDecimals("3"));
                expect(await lottery.getProtocolFee(4, withDecimals("0.3"))).to.equal(withDecimals("0.12"));
                expect(await lottery.getProtocolFee(4, withDecimals("27"))).to.equal(withDecimals("10.8"));
                expect(await lottery.getProtocolFee(5, withDecimals("10"))).to.equal(withDecimals("5"));
                expect(await lottery.getProtocolFee(5, withDecimals("3.3"))).to.equal(withDecimals("1.65"));
                expect(await lottery.getProtocolFee(17, withDecimals("2"))).to.equal(withDecimals("3.4"));
                expect(await lottery.getProtocolFee(23, withDecimals("5.5"))).to.equal(withDecimals("12.65"));
                expect(await lottery.getProtocolFee(77, withDecimals("1.33"))).to.equal(withDecimals("10.241"));
            });
        });
    });

    describe("Main", function () {
        describe("buyTicket", function () {
            it("Should revert call by invalidRoundType", async () => {
                const { lottery, userOne } = await loadFixture(deployLotteryFixture);

                await expect(lottery.connect(userOne).buyTicket(4, 1)).to.be.revertedWith(
                    "IDPLottery: invalid roundType"
                );

                await expect(lottery.connect(userOne).buyTicket(5, 1)).to.be.revertedWith(
                    "IDPLottery: invalid roundType"
                );

                await expect(lottery.connect(userOne).buyTicket(6, 1)).to.be.revertedWith(
                    "IDPLottery: invalid roundType"
                );

                await expect(lottery.connect(userOne).buyTicket(10, 1)).to.be.revertedWith(
                    "IDPLottery: invalid roundType"
                );
            });

            it("Should revert call by zero ticketsAmount", async () => {
                const { lottery, userOne } = await loadFixture(deployLotteryFixture);

                await expect(lottery.connect(userOne).buyTicket(0, 0)).to.be.revertedWith(
                    "IDPLottery: zero ticketsAmount"
                );

                await expect(lottery.connect(userOne).buyTicket(1, 0)).to.be.revertedWith(
                    "IDPLottery: zero ticketsAmount"
                );

                await expect(lottery.connect(userOne).buyTicket(2, 0)).to.be.revertedWith(
                    "IDPLottery: zero ticketsAmount"
                );

                await expect(lottery.connect(userOne).buyTicket(3, 0)).to.be.revertedWith(
                    "IDPLottery: zero ticketsAmount"
                );
            });

            it("Should revert new round by paused", async () => {
                const { lottery, userOne, admin } = await loadFixture(deployLotteryFixture);

                await lottery.connect(admin).pauseRoundType(0);

                await expect(lottery.connect(userOne).buyTicket(0, 1)).to.be.revertedWith(
                    "IDPLottery: paused"
                );

                await lottery.connect(admin).pauseRoundType(1);

                await expect(lottery.connect(userOne).buyTicket(1, 1)).to.be.revertedWith(
                    "IDPLottery: paused"
                );

                await lottery.connect(admin).pauseRoundType(2);

                await expect(lottery.connect(userOne).buyTicket(2, 1)).to.be.revertedWith(
                    "IDPLottery: paused"
                );

                await lottery.connect(admin).pauseRoundType(3);

                await expect(lottery.connect(userOne).buyTicket(3, 1)).to.be.revertedWith(
                    "IDPLottery: paused"
                );
            });

            it("Should revert new round by paused after round ended", async () => {
                const { lottery, userOne, admin, token } = await loadFixture(deployLotteryFixture);

                const amountToMint = withDecimals("100000");

                await token.connect(admin).setVault(admin);
                await token.connect(admin).mint(admin, amountToMint);
                await token.connect(admin).approve(lottery.target, amountToMint);
                await token.connect(admin).mint(userOne, amountToMint);
                await token.connect(userOne).approve(lottery.target, amountToMint);

                await lottery.connect(userOne).buyTicket(0, 10);
                await lottery.connect(userOne).buyTicket(1, 10);
                await lottery.connect(userOne).buyTicket(2, 10);
                await lottery.connect(userOne).buyTicket(3, 10);

                await lottery.connect(admin).pauseRoundType(0);

                await expect(lottery.connect(userOne).buyTicket(0, 1)).to.be.revertedWith(
                    "IDPLottery: paused"
                );

                await lottery.connect(admin).pauseRoundType(1);

                await expect(lottery.connect(userOne).buyTicket(1, 1)).to.be.revertedWith(
                    "IDPLottery: paused"
                );

                await lottery.connect(admin).pauseRoundType(2);

                await expect(lottery.connect(userOne).buyTicket(2, 1)).to.be.revertedWith(
                    "IDPLottery: paused"
                );

                await lottery.connect(admin).pauseRoundType(3);

                await expect(lottery.connect(userOne).buyTicket(3, 1)).to.be.revertedWith(
                    "IDPLottery: paused"
                );
            });

            it("Should pass round after start and pause", async () => {
                const { lottery, userOne, admin, token } = await loadFixture(deployLotteryFixture);

                const amountToMint = withDecimals("100000");

                await token.connect(admin).setVault(admin);
                await token.connect(admin).mint(admin, amountToMint);
                await token.connect(admin).approve(lottery.target, amountToMint);
                await token.connect(admin).mint(userOne, amountToMint);
                await token.connect(userOne).approve(lottery.target, amountToMint);

                await lottery.connect(userOne).buyTicket(0, 7);
                await lottery.connect(userOne).buyTicket(1, 7);
                await lottery.connect(userOne).buyTicket(2, 7);
                await lottery.connect(userOne).buyTicket(3, 7);

                await lottery.connect(admin).pauseRoundType(0);
                await lottery.connect(admin).pauseRoundType(1);
                await lottery.connect(admin).pauseRoundType(2);
                await lottery.connect(admin).pauseRoundType(3);

                await lottery.connect(userOne).buyTicket(0, 3);
                await lottery.connect(userOne).buyTicket(1, 3);
                await lottery.connect(userOne).buyTicket(2, 3);
                await lottery.connect(userOne).buyTicket(3, 3);
            });

            it("Should revert call after start and pause", async () => {
                const { lottery, userOne, admin, token } = await loadFixture(deployLotteryFixture);

                const amountToMint = withDecimals("100000");

                await token.connect(admin).setVault(admin);
                await token.connect(admin).mint(admin, amountToMint);
                await token.connect(admin).approve(lottery.target, amountToMint);
                await token.connect(admin).mint(userOne, amountToMint);
                await token.connect(userOne).approve(lottery.target, amountToMint);

                await lottery.connect(userOne).buyTicket(0, 7);
                await lottery.connect(userOne).buyTicket(1, 7);
                await lottery.connect(userOne).buyTicket(2, 7);
                await lottery.connect(userOne).buyTicket(3, 7);

                await lottery.connect(admin).pauseRoundType(0);
                await lottery.connect(admin).pauseRoundType(1);
                await lottery.connect(admin).pauseRoundType(2);
                await lottery.connect(admin).pauseRoundType(3);

                await lottery.connect(userOne).buyTicket(0, 3);
                await lottery.connect(userOne).buyTicket(1, 3);
                await lottery.connect(userOne).buyTicket(2, 3);
                await lottery.connect(userOne).buyTicket(3, 3);

                await expect(lottery.connect(userOne).buyTicket(0, 1)).to.be.revertedWith(
                    "IDPLottery: paused"
                );

                await expect(lottery.connect(userOne).buyTicket(1, 1)).to.be.revertedWith(
                    "IDPLottery: paused"
                );

                await expect(lottery.connect(userOne).buyTicket(2, 1)).to.be.revertedWith(
                    "IDPLottery: paused"
                );

                await expect(lottery.connect(userOne).buyTicket(3, 1)).to.be.revertedWith(
                    "IDPLottery: paused"
                );
            });

            it("Should revert call by ticketsAmount exceeded", async () => {
                const { lottery, userOne, admin, token } = await loadFixture(deployLotteryFixture);

                const amountToMint = withDecimals("100000");

                await token.connect(admin).setVault(admin);
                await token.connect(admin).mint(admin, amountToMint);
                await token.connect(admin).approve(lottery.target, amountToMint);
                await token.connect(admin).mint(userOne, amountToMint);
                await token.connect(userOne).approve(lottery.target, amountToMint);

                await expect(lottery.connect(userOne).buyTicket(0, 11)).to.be.revertedWith(
                    "IDPLottery: ticketsAmount exceeded"
                );

                await expect(lottery.connect(userOne).buyTicket(1, 11)).to.be.revertedWith(
                    "IDPLottery: ticketsAmount exceeded"
                );

                await expect(lottery.connect(userOne).buyTicket(2, 11)).to.be.revertedWith(
                    "IDPLottery: ticketsAmount exceeded"
                );

                await expect(lottery.connect(userOne).buyTicket(3, 11)).to.be.revertedWith(
                    "IDPLottery: ticketsAmount exceeded"
                );

                await lottery.connect(userOne).buyTicket(0, 1);
                await lottery.connect(userOne).buyTicket(1, 3);
                await lottery.connect(userOne).buyTicket(2, 5);
                await lottery.connect(userOne).buyTicket(3, 7);

                await expect(lottery.connect(userOne).buyTicket(0, 10)).to.be.revertedWith(
                    "IDPLottery: ticketsAmount exceeded"
                );

                await expect(lottery.connect(userOne).buyTicket(1, 8)).to.be.revertedWith(
                    "IDPLottery: ticketsAmount exceeded"
                );

                await expect(lottery.connect(userOne).buyTicket(2, 6)).to.be.revertedWith(
                    "IDPLottery: ticketsAmount exceeded"
                );

                await expect(lottery.connect(userOne).buyTicket(3, 4)).to.be.revertedWith(
                    "IDPLottery: ticketsAmount exceeded"
                );

                await lottery.connect(userOne).buyTicket(0, 2);
                await lottery.connect(userOne).buyTicket(1, 3);
                await lottery.connect(userOne).buyTicket(2, 4);
                await lottery.connect(userOne).buyTicket(3, 2);

                await expect(lottery.connect(userOne).buyTicket(0, 8)).to.be.revertedWith(
                    "IDPLottery: ticketsAmount exceeded"
                );

                await expect(lottery.connect(userOne).buyTicket(1, 5)).to.be.revertedWith(
                    "IDPLottery: ticketsAmount exceeded"
                );

                await expect(lottery.connect(userOne).buyTicket(2, 2)).to.be.revertedWith(
                    "IDPLottery: ticketsAmount exceeded"
                );

                await expect(lottery.connect(userOne).buyTicket(3, 2)).to.be.revertedWith(
                    "IDPLottery: ticketsAmount exceeded"
                );
            });

            it("Should pass update round info after round starts", async () => {
                const { lottery, userOne, admin, token } = await loadFixture(deployLotteryFixture);

                const amountToMint = withDecimals("100000");

                await token.connect(admin).setVault(admin);
                await token.connect(admin).mint(admin, amountToMint);
                await token.connect(admin).approve(lottery.target, amountToMint);
                await token.connect(admin).mint(userOne, amountToMint);
                await token.connect(userOne).approve(lottery.target, amountToMint);

                await lottery.connect(userOne).buyTicket(0, 3);
                let lotteryZero = await lottery.lotteries(0);
                const lotteryZeroStartTime = await helpers.time.latest();

                expect(await lottery.totalLotteries()).to.equal(1);
                expect(lotteryZero.ticketPrice).to.equal(withDecimals("1"));
                expect(lotteryZero.startTime).to.equal(lotteryZeroStartTime);

                await helpers.time.increase(30);

                await lottery.connect(userOne).buyTicket(1, 4);
                let lotteryOne = await lottery.lotteries(1);
                const lotteryOneStartTime = await helpers.time.latest();

                expect(await lottery.totalLotteries()).to.equal(2);
                expect(lotteryOne.ticketPrice).to.equal(withDecimals("10"));
                expect(lotteryOne.startTime).to.equal(lotteryOneStartTime);

                await helpers.time.increase(30);

                await lottery.connect(userOne).buyTicket(2, 5);
                let lotteryTwo = await lottery.lotteries(2);
                const lotteryTwoStartTime = await helpers.time.latest();

                expect(await lottery.totalLotteries()).to.equal(3);
                expect(lotteryTwo.ticketPrice).to.equal(withDecimals("100"));
                expect(lotteryTwo.startTime).to.equal(lotteryTwoStartTime);

                await helpers.time.increase(30);

                await lottery.connect(userOne).buyTicket(3, 6);
                let lotteryThree = await lottery.lotteries(3);
                const lotteryThreeStartTime = await helpers.time.latest();

                expect(await lottery.totalLotteries()).to.equal(4);
                expect(lotteryThree.ticketPrice).to.equal(withDecimals("1000"));
                expect(lotteryThree.startTime).to.equal(lotteryThreeStartTime);

                await lottery.connect(userOne).buyTicket(0, 3);
                lotteryZero = await lottery.lotteries(0);

                expect(await lottery.totalLotteries()).to.equal(4);
                expect(lotteryZero.ticketPrice).to.equal(withDecimals("1"));
                expect(lotteryZero.startTime).to.equal(lotteryZeroStartTime);

                await helpers.time.increase(30);

                await lottery.connect(userOne).buyTicket(1, 4);
                lotteryOne = await lottery.lotteries(1);

                expect(await lottery.totalLotteries()).to.equal(4);
                expect(lotteryOne.ticketPrice).to.equal(withDecimals("10"));
                expect(lotteryOne.startTime).to.equal(lotteryOneStartTime);

                await helpers.time.increase(30);

                await lottery.connect(userOne).buyTicket(2, 5);
                lotteryTwo = await lottery.lotteries(2);

                expect(await lottery.totalLotteries()).to.equal(4);
                expect(lotteryTwo.ticketPrice).to.equal(withDecimals("100"));
                expect(lotteryTwo.startTime).to.equal(lotteryTwoStartTime);

                await helpers.time.increase(30);

                await lottery.connect(userOne).buyTicket(3, 4);
                lotteryThree = await lottery.lotteries(3);

                expect(await lottery.totalLotteries()).to.equal(4);
                expect(lotteryThree.ticketPrice).to.equal(withDecimals("1000"));
                expect(lotteryThree.startTime).to.equal(lotteryThreeStartTime);

                await helpers.time.increase(30);

                await lottery.connect(userOne).buyTicket(2, 3);
                lotteryFour = await lottery.lotteries(4);

                expect(await lottery.totalLotteries()).to.equal(5);
                expect(lotteryFour.ticketPrice).to.equal(withDecimals("100"));
                expect(lotteryFour.startTime).to.equal(await helpers.time.latest());
            });

            it("Should store right tickets owners and purchased tickets", async () => {
                const { lottery, userOne, userTwo, userThree, admin, token, zeroAddress } = await loadFixture(deployLotteryFixture);

                const amountToMint = withDecimals("100000");

                await token.connect(admin).setVault(admin);
                await token.connect(admin).mint(admin, amountToMint);
                await token.connect(admin).approve(lottery.target, amountToMint);

                await token.connect(admin).mint(userOne, amountToMint);
                await token.connect(userOne).approve(lottery.target, amountToMint);

                await token.connect(admin).mint(userTwo, amountToMint);
                await token.connect(userTwo).approve(lottery.target, amountToMint);

                await token.connect(admin).mint(userThree, amountToMint);
                await token.connect(userThree).approve(lottery.target, amountToMint);

                await lottery.connect(userOne).buyTicket(0, 1);
                await lottery.connect(userOne).buyTicket(1, 3);
                await lottery.connect(userOne).buyTicket(2, 5);

                await lottery.connect(userTwo).buyTicket(0, 2);
                await lottery.connect(userTwo).buyTicket(1, 3);
                await lottery.connect(userTwo).buyTicket(2, 3);
                await lottery.connect(userTwo).buyTicket(3, 4);

                await lottery.connect(userThree).buyTicket(2, 1);
                await lottery.connect(userThree).buyTicket(3, 3);

                const lotteryZero = await lottery.lotteries(0);
                const lotteryOne = await lottery.lotteries(1);
                const lotteryTwo = await lottery.lotteries(2);
                const lotteryThree = await lottery.lotteries(3);

                expect(lotteryZero.purchasedTickets).to.equal(3);
                expect(lotteryOne.purchasedTickets).to.equal(6);
                expect(lotteryTwo.purchasedTickets).to.equal(9);
                expect(lotteryThree.purchasedTickets).to.equal(7);

                expect(await lottery.getTicketOwner(0, 0)).to.equal(userOne);
                expect(await lottery.getTicketOwner(0, 1)).to.equal(userTwo);
                expect(await lottery.getTicketOwner(0, 2)).to.equal(userTwo);
                expect(await lottery.getTicketOwner(0, 3)).to.equal(zeroAddress);
                expect(await lottery.getTicketOwner(0, 4)).to.equal(zeroAddress);
                expect(await lottery.getTicketOwner(0, 5)).to.equal(zeroAddress);
                expect(await lottery.getTicketOwner(0, 6)).to.equal(zeroAddress);
                expect(await lottery.getTicketOwner(0, 7)).to.equal(zeroAddress);
                expect(await lottery.getTicketOwner(0, 8)).to.equal(zeroAddress);
                expect(await lottery.getTicketOwner(0, 9)).to.equal(zeroAddress);

                expect(await lottery.getTicketOwner(1, 0)).to.equal(userOne);
                expect(await lottery.getTicketOwner(1, 1)).to.equal(userOne);
                expect(await lottery.getTicketOwner(1, 2)).to.equal(userOne);
                expect(await lottery.getTicketOwner(1, 3)).to.equal(userTwo);
                expect(await lottery.getTicketOwner(1, 4)).to.equal(userTwo);
                expect(await lottery.getTicketOwner(1, 5)).to.equal(userTwo);
                expect(await lottery.getTicketOwner(1, 6)).to.equal(zeroAddress);
                expect(await lottery.getTicketOwner(1, 7)).to.equal(zeroAddress);
                expect(await lottery.getTicketOwner(1, 8)).to.equal(zeroAddress);
                expect(await lottery.getTicketOwner(1, 9)).to.equal(zeroAddress);

                expect(await lottery.getTicketOwner(2, 0)).to.equal(userOne);
                expect(await lottery.getTicketOwner(2, 1)).to.equal(userOne);
                expect(await lottery.getTicketOwner(2, 2)).to.equal(userOne);
                expect(await lottery.getTicketOwner(2, 3)).to.equal(userOne);
                expect(await lottery.getTicketOwner(2, 4)).to.equal(userOne);
                expect(await lottery.getTicketOwner(2, 5)).to.equal(userTwo);
                expect(await lottery.getTicketOwner(2, 6)).to.equal(userTwo);
                expect(await lottery.getTicketOwner(2, 7)).to.equal(userTwo);
                expect(await lottery.getTicketOwner(2, 8)).to.equal(userThree);
                expect(await lottery.getTicketOwner(2, 9)).to.equal(zeroAddress);

                expect(await lottery.getTicketOwner(3, 0)).to.equal(userTwo);
                expect(await lottery.getTicketOwner(3, 1)).to.equal(userTwo);
                expect(await lottery.getTicketOwner(3, 2)).to.equal(userTwo);
                expect(await lottery.getTicketOwner(3, 3)).to.equal(userTwo);
                expect(await lottery.getTicketOwner(3, 4)).to.equal(userThree);
                expect(await lottery.getTicketOwner(3, 5)).to.equal(userThree);
                expect(await lottery.getTicketOwner(3, 6)).to.equal(userThree);
                expect(await lottery.getTicketOwner(3, 7)).to.equal(zeroAddress);
                expect(await lottery.getTicketOwner(3, 8)).to.equal(zeroAddress);
                expect(await lottery.getTicketOwner(3, 9)).to.equal(zeroAddress);
            });

            it("Should requestRandomWords after round fulfilled", async () => {
                const { lottery, userOne, admin, token } = await loadFixture(deployLotteryFixture);

                const amountToMint = withDecimals("100000");

                await token.connect(admin).setVault(admin);
                await token.connect(admin).mint(admin, amountToMint);
                await token.connect(admin).approve(lottery.target, amountToMint);
                await token.connect(admin).mint(userOne, amountToMint);
                await token.connect(userOne).approve(lottery.target, amountToMint);

                await lottery.connect(userOne).buyTicket(0, 7);
                await lottery.connect(userOne).buyTicket(1, 7);
                await lottery.connect(userOne).buyTicket(2, 7);
                await lottery.connect(userOne).buyTicket(3, 7);

                let lotteryZero = await lottery.lotteries(0);
                let lotteryOne = await lottery.lotteries(1);
                let lotteryTwo = await lottery.lotteries(2);
                let lotteryThree = await lottery.lotteries(3);

                expect(lotteryZero.requestId).to.equal(0);
                expect(lotteryOne.requestId).to.equal(0);
                expect(lotteryTwo.requestId).to.equal(0);
                expect(lotteryThree.requestId).to.equal(0);

                await lottery.connect(userOne).buyTicket(0, 2);
                await lottery.connect(userOne).buyTicket(1, 3);
                await lottery.connect(userOne).buyTicket(2, 2);
                await lottery.connect(userOne).buyTicket(3, 3);

                lotteryZero = await lottery.lotteries(0);
                lotteryOne = await lottery.lotteries(1);
                lotteryTwo = await lottery.lotteries(2);
                lotteryThree = await lottery.lotteries(3);

                expect(lotteryZero.requestId).to.equal(0);
                expect(lotteryOne.requestId).to.equal(1);
                expect(lotteryTwo.requestId).to.equal(0);
                expect(lotteryThree.requestId).to.equal(2);

                await lottery.connect(userOne).buyTicket(0, 1);
                await lottery.connect(userOne).buyTicket(1, 5);
                await lottery.connect(userOne).buyTicket(2, 1);
                await lottery.connect(userOne).buyTicket(3, 5);

                lotteryZero = await lottery.lotteries(0);
                lotteryOne = await lottery.lotteries(1);
                lotteryTwo = await lottery.lotteries(2);
                lotteryThree = await lottery.lotteries(3);
                let lotteryFour = await lottery.lotteries(4);
                let lotteryFive = await lottery.lotteries(5);

                expect(lotteryZero.requestId).to.equal(3);
                expect(lotteryOne.requestId).to.equal(1);
                expect(lotteryTwo.requestId).to.equal(4);
                expect(lotteryThree.requestId).to.equal(2);
                expect(lotteryFour.requestId).to.equal(0);
                expect(lotteryFive.requestId).to.equal(0);
            });

            it("Should store endTime after round fulfilled", async () => {
                const { lottery, userOne, admin, token } = await loadFixture(deployLotteryFixture);

                const amountToMint = withDecimals("100000");

                await token.connect(admin).setVault(admin);
                await token.connect(admin).mint(admin, amountToMint);
                await token.connect(admin).approve(lottery.target, amountToMint);
                await token.connect(admin).mint(userOne, amountToMint);
                await token.connect(userOne).approve(lottery.target, amountToMint);

                await lottery.connect(userOne).buyTicket(0, 7);
                let lotteryZero = await lottery.lotteries(0);
                expect(lotteryZero.endTime).to.equal(0);

                await lottery.connect(userOne).buyTicket(1, 7);
                let lotteryOne = await lottery.lotteries(1);
                expect(lotteryOne.endTime).to.equal(0);

                await lottery.connect(userOne).buyTicket(2, 7);
                let lotteryTwo = await lottery.lotteries(2);
                expect(lotteryTwo.endTime).to.equal(0);

                await lottery.connect(userOne).buyTicket(3, 7);
                let lotteryThree = await lottery.lotteries(3);
                expect(lotteryThree.endTime).to.equal(0);

                await lottery.connect(userOne).buyTicket(0, 2);
                lotteryZero = await lottery.lotteries(0);
                expect(lotteryZero.endTime).to.equal(0);

                await lottery.connect(userOne).buyTicket(1, 3);
                lotteryOne = await lottery.lotteries(1);
                let lotteryTwoEndTime = await helpers.time.latest();
                expect(lotteryOne.endTime).to.equal(lotteryTwoEndTime);

                await lottery.connect(userOne).buyTicket(2, 2);
                lotteryTwo = await lottery.lotteries(2);
                expect(lotteryTwo.endTime).to.equal(0);

                await lottery.connect(userOne).buyTicket(3, 3);
                lotteryThree = await lottery.lotteries(3);
                let lotteryThreeEndTime = await helpers.time.latest();
                expect(lotteryThree.endTime).to.equal(lotteryThreeEndTime);
            });

            it("Should store roundTypeActive after round fulfilled", async () => {
                const { lottery, userOne, admin, token } = await loadFixture(deployLotteryFixture);

                const amountToMint = withDecimals("100000");

                await token.connect(admin).setVault(admin);
                await token.connect(admin).mint(admin, amountToMint);
                await token.connect(admin).approve(lottery.target, amountToMint);
                await token.connect(admin).mint(userOne, amountToMint);
                await token.connect(userOne).approve(lottery.target, amountToMint);

                await lottery.connect(userOne).buyTicket(1, 7);
                await lottery.connect(userOne).buyTicket(3, 7);
                await lottery.connect(userOne).buyTicket(0, 7);
                await lottery.connect(userOne).buyTicket(2, 7);

                expect(await lottery.roundTypeActive(0)).to.equal(2);
                expect(await lottery.roundTypeActive(1)).to.equal(0);
                expect(await lottery.roundTypeActive(2)).to.equal(3);
                expect(await lottery.roundTypeActive(3)).to.equal(1);

                await lottery.connect(userOne).buyTicket(0, 2);
                await lottery.connect(userOne).buyTicket(1, 3);
                await lottery.connect(userOne).buyTicket(2, 2);
                await lottery.connect(userOne).buyTicket(3, 3);

                expect(await lottery.roundTypeActive(0)).to.equal(2);
                expect(await lottery.roundTypeActive(1)).to.equal(4);
                expect(await lottery.roundTypeActive(2)).to.equal(3);
                expect(await lottery.roundTypeActive(3)).to.equal(4);

                await lottery.connect(userOne).buyTicket(0, 1);

                expect(await lottery.roundTypeActive(0)).to.equal(4);

                await lottery.connect(userOne).buyTicket(1, 5);
                await lottery.connect(userOne).buyTicket(2, 1);
                await lottery.connect(userOne).buyTicket(3, 5);

                expect(await lottery.roundTypeActive(0)).to.equal(4);
                expect(await lottery.roundTypeActive(1)).to.equal(4);
                expect(await lottery.roundTypeActive(2)).to.equal(5);
                expect(await lottery.roundTypeActive(3)).to.equal(5);
            });

            it("Should pass call with right balances", async () => {
                const { lottery, userOne, userTwo, userThree, admin, token, vault, coordinator, oracle } = await loadFixture(deployLotteryFixture);

                const amountToMint = withDecimals("100000");

                await token.connect(admin).setVault(admin);
                await token.connect(admin).mint(admin, amountToMint);
                await token.connect(admin).approve(lottery.target, amountToMint);

                await token.connect(admin).mint(userOne, amountToMint);
                await token.connect(userOne).approve(lottery.target, amountToMint);

                await token.connect(admin).mint(userTwo, amountToMint);
                await token.connect(userTwo).approve(lottery.target, amountToMint);

                await token.connect(admin).mint(userThree, amountToMint);
                await token.connect(userThree).approve(lottery.target, amountToMint);

                const lotteryBalanceBefore = await token.balanceOf(lottery.target);
                const vaultBalanceBefore = await token.balanceOf(vault.target);
                const userOneBalanceBefore = await token.balanceOf(userOne);
                const userTwoBalanceBefore = await token.balanceOf(userTwo);
                const userThreeBalanceBefore = await token.balanceOf(userThree);

                await lottery.connect(userOne).buyTicket(1, 1);
                await lottery.connect(userTwo).buyTicket(1, 3);
                await lottery.connect(userTwo).buyTicket(0, 2);
                await lottery.connect(userThree).buyTicket(0, 2);
                await lottery.connect(userThree).buyTicket(3, 10);

                const lotteryBalanceAfter = await token.balanceOf(lottery.target);
                const vaultBalanceAfter = await token.balanceOf(vault.target);
                const userOneBalanceAfter = await token.balanceOf(userOne);
                const userTwoBalanceAfter = await token.balanceOf(userTwo);
                const userThreeBalanceAfter = await token.balanceOf(userThree);
                const adminBalanceAfter = await token.balanceOf(admin);

                expect(lotteryBalanceBefore + withDecimals("10044")).to.equal(lotteryBalanceAfter);
                expect(vaultBalanceBefore + withDecimals("1004.4")).to.equal(vaultBalanceAfter);
                expect(userOneBalanceBefore - withDecimals("11")).to.equal(userOneBalanceAfter);
                expect(userTwoBalanceBefore - withDecimals("35.2")).to.equal(userTwoBalanceAfter);
                expect(userThreeBalanceBefore - withDecimals("11002.2")).to.equal(userThreeBalanceAfter);

                await coordinator.provideRandomData(oracle.target, 1, [9]);

                await helpers.time.increase(20);

                await lottery.connect(admin).claimRewards([2]);

                expect(await token.balanceOf(lottery.target)).to.equal(lotteryBalanceAfter - withDecimals("10000"));
                expect(await token.balanceOf(vault.target)).to.equal(vaultBalanceAfter);
                expect(await token.balanceOf(userOne)).to.equal(userOneBalanceAfter);
                expect(await token.balanceOf(userTwo)).to.equal(userTwoBalanceAfter);
                expect(await token.balanceOf(userThree)).to.equal(userThreeBalanceAfter + withDecimals("10000"));
                expect(await token.balanceOf(admin)).to.equal(adminBalanceAfter);
            });
        });

        describe("claimRewards", function () {
            it("Should revert call by invalid lotteryIds length", async () => {
                const { lottery, userOne } = await loadFixture(deployLotteryFixture);

                await expect(lottery.connect(userOne).claimRewards([])).to.be.revertedWith(
                    "IDPLottery: invalid lotteryIds length"
                );
            });

            it("Should revert call by invalid lotteryId", async () => {
                const { lottery, userOne, token, admin } = await loadFixture(deployLotteryFixture);

                await expect(lottery.connect(userOne).claimRewards([0])).to.be.revertedWith(
                    "IDPLottery: invalid lotteryId"
                );

                await expect(lottery.connect(userOne).claimRewards([1])).to.be.revertedWith(
                    "IDPLottery: invalid lotteryId"
                );

                const amountToMint = withDecimals("100000");

                await token.connect(admin).setVault(admin);
                await token.connect(admin).mint(admin, amountToMint);
                await token.connect(admin).approve(lottery.target, amountToMint);

                await token.connect(admin).mint(userOne, amountToMint);
                await token.connect(userOne).approve(lottery.target, amountToMint);

                await lottery.connect(userOne).buyTicket(1, 1);

                await expect(lottery.connect(userOne).claimRewards([1])).to.be.revertedWith(
                    "IDPLottery: invalid lotteryId"
                );

                await lottery.connect(userOne).buyTicket(1, 2);

                await expect(lottery.connect(userOne).claimRewards([1])).to.be.revertedWith(
                    "IDPLottery: invalid lotteryId"
                );

                await lottery.connect(userOne).buyTicket(3, 2);

                await expect(lottery.connect(userOne).claimRewards([2])).to.be.revertedWith(
                    "IDPLottery: invalid lotteryId"
                );
            });

            it("Should revert call by too fast claim after round ends", async () => {
                const { lottery, userOne, token, admin } = await loadFixture(deployLotteryFixture);

                const amountToMint = withDecimals("100000");

                await token.connect(admin).setVault(admin);
                await token.connect(admin).mint(admin, amountToMint);
                await token.connect(admin).approve(lottery.target, amountToMint);

                await token.connect(admin).mint(userOne, amountToMint);
                await token.connect(userOne).approve(lottery.target, amountToMint);

                await lottery.connect(userOne).buyTicket(1, 10);

                await expect(lottery.connect(userOne).claimRewards([0])).to.be.revertedWith(
                    "IDPLottery: too soon"
                );

                await helpers.time.increase(3);

                await expect(lottery.connect(userOne).claimRewards([0])).to.be.revertedWith(
                    "IDPLottery: too soon"
                );
            });

            it("Should revert call by claimed round", async () => {
                const { lottery, userOne, token, admin, oracle, coordinator } = await loadFixture(deployLotteryFixture);

                const amountToMint = withDecimals("100000");

                await token.connect(admin).setVault(admin);
                await token.connect(admin).mint(admin, amountToMint);
                await token.connect(admin).approve(lottery.target, amountToMint);

                await token.connect(admin).mint(userOne, amountToMint);
                await token.connect(userOne).approve(lottery.target, amountToMint);

                await lottery.connect(userOne).buyTicket(1, 10);

                await coordinator.provideRandomData(oracle.target, 1, [3]);

                await helpers.time.increase(20);

                await lottery.connect(userOne).claimRewards([0]);

                await expect(lottery.connect(userOne).claimRewards([0])).to.be.revertedWith(
                    "IDPLottery: claimed"
                );
            });

            it("Should store right data", async () => {
                const { lottery, userOne, token, admin, oracle, coordinator, zeroAddress } = await loadFixture(deployLotteryFixture);

                const amountToMint = withDecimals("100000");

                await token.connect(admin).setVault(admin);
                await token.connect(admin).mint(admin, amountToMint);
                await token.connect(admin).approve(lottery.target, amountToMint);

                await token.connect(admin).mint(userOne, amountToMint);
                await token.connect(userOne).approve(lottery.target, amountToMint);

                await lottery.connect(userOne).buyTicket(1, 10);

                let lotteryData = await lottery.lotteries(0);

                expect(lotteryData.winningTicket).to.equal(0);
                expect(lotteryData.winner).to.equal(zeroAddress);

                await coordinator.provideRandomData(oracle.target, 1, [3]);

                await helpers.time.increase(20);

                await lottery.connect(admin).claimRewards([0]);

                lotteryData = await lottery.lotteries(0);

                expect(lotteryData.winningTicket).to.equal(3);
                expect(lotteryData.winner).to.equal(userOne);
            });

            it("Should store right data multicall", async () => {
                const { lottery, userOne, userTwo, userThree, token, admin, oracle, coordinator, zeroAddress } = await loadFixture(deployLotteryFixture);

                const amountToMint = withDecimals("100000");

                await token.connect(admin).setVault(admin);
                await token.connect(admin).mint(admin, amountToMint);
                await token.connect(admin).approve(lottery.target, amountToMint);

                await token.connect(admin).mint(userOne, amountToMint);
                await token.connect(userOne).approve(lottery.target, amountToMint);

                await token.connect(admin).mint(userTwo, amountToMint);
                await token.connect(userTwo).approve(lottery.target, amountToMint);

                await token.connect(admin).mint(userThree, amountToMint);
                await token.connect(userThree).approve(lottery.target, amountToMint);

                await lottery.connect(userOne).buyTicket(1, 6);
                await lottery.connect(userOne).buyTicket(2, 4);
                await lottery.connect(userTwo).buyTicket(1, 3);
                await lottery.connect(userThree).buyTicket(2, 6);
                await lottery.connect(userTwo).buyTicket(1, 1);
                await lottery.connect(userThree).buyTicket(0, 1);
                await lottery.connect(userOne).buyTicket(0, 9);

                let lotteryZeroData = await lottery.lotteries(0);
                let lotteryOneData = await lottery.lotteries(1);
                let lotteryTwoData = await lottery.lotteries(2);

                expect(lotteryZeroData.winningTicket).to.equal(0);
                expect(lotteryZeroData.winner).to.equal(zeroAddress);
                expect(lotteryOneData.winningTicket).to.equal(0);
                expect(lotteryOneData.winner).to.equal(zeroAddress);
                expect(lotteryTwoData.winningTicket).to.equal(0);
                expect(lotteryTwoData.winner).to.equal(zeroAddress);

                await coordinator.provideRandomData(oracle.target, 1, [3]);
                await coordinator.provideRandomData(oracle.target, 2, [2]);
                await coordinator.provideRandomData(oracle.target, 3, [10]);

                await helpers.time.increase(20);

                await lottery.connect(userThree).claimRewards([2, 0, 1]);

                lotteryZeroData = await lottery.lotteries(0);
                lotteryOneData = await lottery.lotteries(1);
                lotteryTwoData = await lottery.lotteries(2);

                expect(lotteryZeroData.winningTicket).to.equal(2);
                expect(lotteryZeroData.winner).to.equal(userOne);
                expect(lotteryOneData.winningTicket).to.equal(3);
                expect(lotteryOneData.winner).to.equal(userOne);
                expect(lotteryTwoData.winningTicket).to.equal(0);
                expect(lotteryTwoData.winner).to.equal(userThree);
            });

            it("Should pass with right balances", async () => {
                const { lottery, userOne, token, admin, oracle, coordinator } = await loadFixture(deployLotteryFixture);

                const amountToMint = withDecimals("100000");

                await token.connect(admin).setVault(admin);
                await token.connect(admin).mint(admin, amountToMint);
                await token.connect(admin).approve(lottery.target, amountToMint);

                await token.connect(admin).mint(userOne, amountToMint);
                await token.connect(userOne).approve(lottery.target, amountToMint);

                await lottery.connect(userOne).buyTicket(1, 10);

                await coordinator.provideRandomData(oracle.target, 1, [3]);

                await helpers.time.increase(20);

                const adminBalanceBefore = await token.balanceOf(admin);
                const userOneBalanceBefore = await token.balanceOf(userOne);
                const lotteryBalanceBefore = await token.balanceOf(lottery.target);

                await lottery.connect(admin).claimRewards([0]);

                const adminBalanceAfter = await token.balanceOf(admin);
                const userOneBalanceAfter = await token.balanceOf(userOne);
                const lotteryBalanceAfter = await token.balanceOf(lottery.target);

                expect(adminBalanceBefore).to.equal(adminBalanceAfter);
                expect(userOneBalanceBefore + withDecimals("100")).to.equal(userOneBalanceAfter);
                expect(lotteryBalanceBefore - withDecimals("100")).to.equal(lotteryBalanceAfter);
            });
        });

        describe("autoRefill", function () {
            it("Should revert call by external caller", async () => {
                const { lottery, userOne } = await loadFixture(deployLotteryFixture);

                await expect(lottery.connect(userOne).autoRefill()).to.be.revertedWith(
                    "IDPLottery: forbidden"
                );
            });

            it("Should emit AutoRefillFailed event", async () => {
                const { lottery, userOne, admin, token, coordinator, oracle } = await loadFixture(deployLotteryFixture);

                const amountToMint = withDecimals("100000");

                await lottery.connect(admin).setAutoRefillEnabled(true);

                await token.connect(admin).setVault(admin);
                await token.connect(admin).mint(admin, amountToMint);
                await token.connect(admin).approve(lottery.target, amountToMint);

                await token.connect(admin).mint(userOne, amountToMint);
                await token.connect(userOne).approve(lottery.target, amountToMint);

                await lottery.connect(userOne).buyTicket(3, 10);

                await coordinator.provideRandomData(oracle.target, 1, [3]);

                await helpers.time.increase(20);

                await expect(lottery.connect(admin).claimRewards([0])).to.emit(lottery, 'AutoRefillFailed').withArgs();
            });

            it("Should pass with succeeded external calls", async () => {
                const { lottery, token, admin, oracle, coordinator, usdt, vault, router, stable, pegSwap, linkToken } = await loadFixture(deployLotteryFixture);

                await token.connect(admin).setVault(vault.target);
                await usdt.connect(admin).approve(vault.target, withDecimals("10000000000"));
                const amountToBuy = withDecimals("100000");

                await vault.connect(admin).buyToken(0, amountToBuy);

                await token.connect(admin).approve(router.target, withDecimals("10000000000"));
                await stable.connect(admin).approve(router.target, withDecimals("10000000000"));

                await router.connect(admin).addLiquidity(
                    token.target,
                    stable.target,
                    withDecimals("78978"),
                    withDecimals("53456"),
                    0,
                    0,
                    admin,
                    99999999999,
                    true
                );

                const amountToApprove = withDecimals("100000");

                await token.connect(admin).approve(lottery.target, amountToApprove);

                await lottery.connect(admin).setAutoRefillEnabled(true);

                await lottery.connect(admin).buyTicket(1, 10);

                await coordinator.provideRandomData(oracle.target, 1, [3]);

                await helpers.time.increase(20);

                const subscriptionId = "0x0000000000000000000000000000000000000000000000000000000000000001";

                await linkToken.connect(admin).transfer(pegSwap.target, withDecimals("100000"));

                await lottery.connect(admin).setSwapConfig([
                    router.target,
                    [token.target, stable.target],
                    0,
                    300,
                    true,
                    pegSwap.target,
                    coordinator.target,
                    stable.target,
                    linkToken.target,
                    subscriptionId
                ]);

                expect(await token.balanceOf(lottery.target)).to.equal(withDecimals("110"));
                expect(await lottery.storedFee()).to.equal(withDecimals("10"));
                expect(await linkToken.balanceOf(coordinator.target)).to.equal(0);

                await expect(lottery.connect(admin).claimRewards([0])).to.emit(lottery, 'AutoRefillSucceeds').withArgs();

                expect(await token.balanceOf(lottery.target)).to.equal(withDecimals("0.000000001"));
                expect(await lottery.storedFee()).to.equal(withDecimals("0.000000001"));
                expect(await linkToken.balanceOf(coordinator.target)).to.equal(withDecimals("6.766189265179294742"));
            });
        });
    });
});