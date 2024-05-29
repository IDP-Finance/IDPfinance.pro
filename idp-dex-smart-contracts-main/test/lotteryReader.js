const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const helpers = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const withDecimals = ethers.parseEther;
const withoutDecimals = ethers.formatEther;

describe("IDP Lottery Reader", function () {
    async function deployLotteryReaderFixture() {

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

        const IDPLotteryReader = await ethers.getContractFactory("IDPLotteryReader", deployer);
        const reader = await IDPLotteryReader.deploy(lottery.target, oracle.target);
        await reader.waitForDeployment();

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
            zeroAddress, token, vault, oracle, lottery, stable, pegSwap, linkToken, reader
        };
    };

    describe("Deployment", function () {
        it("Init storage check", async () => {
            const { lottery, oracle, reader } = await loadFixture(deployLotteryReaderFixture);

            expect(await reader.lottery()).to.equal(lottery.target);
            expect(await reader.oracle()).to.equal(oracle.target);
        });
    });

    describe("Multiple view functions", function () {
        it("Should returns right data one", async () => {
            const { token, lottery, zeroAddress, admin, userOne, userTwo, userThree, reader } = await loadFixture(deployLotteryReaderFixture);

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

            let unclaimedResult = await reader.getUnlclaimedLotteries(0, 100);

            expect(unclaimedResult[0]).to.equal(0);
            expect(unclaimedResult.length).to.equal(1);

            let participiatedResultAdmin = await reader.getParticipiatedLotteries(admin, 0, 100);
            let participiatedResultOne = await reader.getParticipiatedLotteries(userOne, 0, 100);
            let participiatedResultTwo = await reader.getParticipiatedLotteries(userTwo, 0, 100);
            let participiatedResultThree = await reader.getParticipiatedLotteries(userThree, 0, 100);

            expect(participiatedResultAdmin[0]).to.equal(0);
            expect(participiatedResultAdmin.length).to.equal(1);
            expect(participiatedResultOne[0]).to.equal(0);
            expect(participiatedResultOne.length).to.equal(1);
            expect(participiatedResultTwo[0]).to.equal(0);
            expect(participiatedResultTwo.length).to.equal(1);
            expect(participiatedResultThree.length).to.equal(0);

            let wonResultAdmin = await reader.getWonLotteries(admin, 0, 100);
            let wonResultOne = await reader.getWonLotteries(userOne, 0, 100);
            let wonResultTwo = await reader.getWonLotteries(userTwo, 0, 100);
            let wonResultThree = await reader.getWonLotteries(userThree, 0, 100);

            expect(wonResultAdmin.length).to.equal(0);
            expect(wonResultOne.length).to.equal(0);
            expect(wonResultTwo.length).to.equal(0);
            expect(wonResultThree.length).to.equal(0);

            let unclaimedResultAdmin = await reader.getUnclaimedWonLotteries(admin, 0, 100);
            let unclaimedResultOne = await reader.getUnclaimedWonLotteries(userOne, 0, 100);
            let unclaimedResultTwo = await reader.getUnclaimedWonLotteries(userTwo, 0, 100);
            let unclaimedResultThree = await reader.getUnclaimedWonLotteries(userThree, 0, 100);

            expect(unclaimedResultAdmin.length).to.equal(0);
            expect(unclaimedResultOne.length).to.equal(0);
            expect(unclaimedResultTwo.length).to.equal(0);
            expect(unclaimedResultThree.length).to.equal(0);
        });

        it("Should returns right data two", async () => {
            const { lottery, userOne, userTwo, userThree, userFour, token, admin, oracle, coordinator, zeroAddress, reader } = await loadFixture(deployLotteryReaderFixture);

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

            let unclaimedResult = await reader.getUnlclaimedLotteries(0, 100);

            expect(unclaimedResult[0]).to.equal(0);
            expect(unclaimedResult[1]).to.equal(1);
            expect(unclaimedResult[2]).to.equal(2);
            expect(unclaimedResult.length).to.equal(3);

            let participiatedResultOne = await reader.getParticipiatedLotteries(userOne, 0, 100);
            let participiatedResultTwo = await reader.getParticipiatedLotteries(userTwo, 0, 100);
            let participiatedResultThree = await reader.getParticipiatedLotteries(userThree, 0, 100);
            let participiatedResultFour = await reader.getParticipiatedLotteries(userFour, 0, 100);

            expect(participiatedResultOne[0]).to.equal(0);
            expect(participiatedResultOne[1]).to.equal(1);
            expect(participiatedResultOne[2]).to.equal(2);
            expect(participiatedResultOne.length).to.equal(3);
            expect(participiatedResultTwo[0]).to.equal(0);
            expect(participiatedResultTwo.length).to.equal(1);
            expect(participiatedResultThree[0]).to.equal(1);
            expect(participiatedResultThree[1]).to.equal(2);
            expect(participiatedResultThree.length).to.equal(2);
            expect(participiatedResultFour.length).to.equal(0);

            let wonResultOne = await reader.getWonLotteries(userOne, 0, 100);
            let wonResultTwo = await reader.getWonLotteries(userTwo, 0, 100);
            let wonResultThree = await reader.getWonLotteries(userThree, 0, 100);
            let wonResultFour = await reader.getWonLotteries(admin, 0, 100);

            expect(wonResultOne.length).to.equal(0);
            expect(wonResultTwo.length).to.equal(0);
            expect(wonResultThree.length).to.equal(0);
            expect(wonResultFour.length).to.equal(0);

            let unclaimedResultOne = await reader.getUnclaimedWonLotteries(userOne, 0, 100);
            let unclaimedResultTwo = await reader.getUnclaimedWonLotteries(userTwo, 0, 100);
            let unclaimedResultThree = await reader.getUnclaimedWonLotteries(userThree, 0, 100);
            let unclaimedResultFour = await reader.getUnclaimedWonLotteries(admin, 0, 100);

            expect(unclaimedResultOne.length).to.equal(0);
            expect(unclaimedResultTwo.length).to.equal(0);
            expect(unclaimedResultThree.length).to.equal(0);
            expect(unclaimedResultFour.length).to.equal(0);

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

            unclaimedResult = await reader.getUnlclaimedLotteries(0, 100);

            expect(unclaimedResult[0]).to.equal(0);
            expect(unclaimedResult[1]).to.equal(1);
            expect(unclaimedResult[2]).to.equal(2);
            expect(unclaimedResult.length).to.equal(3);

            participiatedResultOne = await reader.getParticipiatedLotteries(userOne, 0, 100);
            participiatedResultTwo = await reader.getParticipiatedLotteries(userTwo, 0, 100);
            participiatedResultThree = await reader.getParticipiatedLotteries(userThree, 0, 100);
            participiatedResultFour = await reader.getParticipiatedLotteries(userFour, 0, 100);

            expect(participiatedResultOne[0]).to.equal(0);
            expect(participiatedResultOne[1]).to.equal(1);
            expect(participiatedResultOne[2]).to.equal(2);
            expect(participiatedResultOne.length).to.equal(3);
            expect(participiatedResultTwo[0]).to.equal(0);
            expect(participiatedResultTwo.length).to.equal(1);
            expect(participiatedResultThree[0]).to.equal(1);
            expect(participiatedResultThree[1]).to.equal(2);
            expect(participiatedResultThree.length).to.equal(2);
            expect(participiatedResultFour.length).to.equal(0);

            wonResultOne = await reader.getWonLotteries(userOne, 0, 100);
            wonResultTwo = await reader.getWonLotteries(userTwo, 0, 100);
            wonResultThree = await reader.getWonLotteries(userThree, 0, 100);
            wonResultFour = await reader.getWonLotteries(admin, 0, 100);

            expect(wonResultOne[0]).to.equal(0);
            expect(wonResultOne[1]).to.equal(1);
            expect(wonResultOne.length).to.equal(2);
            expect(wonResultTwo.length).to.equal(0);
            expect(wonResultThree[0]).to.equal(2);
            expect(wonResultThree.length).to.equal(1);
            expect(wonResultFour.length).to.equal(0);

            unclaimedResultOne = await reader.getUnclaimedWonLotteries(userOne, 0, 100);
            unclaimedResultTwo = await reader.getUnclaimedWonLotteries(userTwo, 0, 100);
            unclaimedResultThree = await reader.getUnclaimedWonLotteries(userThree, 0, 100);
            unclaimedResultFour = await reader.getUnclaimedWonLotteries(admin, 0, 100);

            expect(unclaimedResultOne[0]).to.equal(0);
            expect(unclaimedResultOne[1]).to.equal(1);
            expect(unclaimedResultOne.length).to.equal(2);
            expect(unclaimedResultTwo.length).to.equal(0);
            expect(unclaimedResultThree[0]).to.equal(2);
            expect(unclaimedResultThree.length).to.equal(1);
            expect(unclaimedResultFour.length).to.equal(0);

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

            unclaimedResult = await reader.getUnlclaimedLotteries(0, 100);

            expect(unclaimedResult.length).to.equal(0);

            participiatedResultOne = await reader.getParticipiatedLotteries(userOne, 0, 100);
            participiatedResultTwo = await reader.getParticipiatedLotteries(userTwo, 0, 100);
            participiatedResultThree = await reader.getParticipiatedLotteries(userThree, 0, 100);
            participiatedResultFour = await reader.getParticipiatedLotteries(userFour, 0, 100);

            expect(participiatedResultOne[0]).to.equal(0);
            expect(participiatedResultOne[1]).to.equal(1);
            expect(participiatedResultOne[2]).to.equal(2);
            expect(participiatedResultOne.length).to.equal(3);
            expect(participiatedResultTwo[0]).to.equal(0);
            expect(participiatedResultTwo.length).to.equal(1);
            expect(participiatedResultThree[0]).to.equal(1);
            expect(participiatedResultThree[1]).to.equal(2);
            expect(participiatedResultThree.length).to.equal(2);
            expect(participiatedResultFour.length).to.equal(0);

            wonResultOne = await reader.getWonLotteries(userOne, 0, 100);
            wonResultTwo = await reader.getWonLotteries(userTwo, 0, 100);
            wonResultThree = await reader.getWonLotteries(userThree, 0, 100);
            wonResultFour = await reader.getWonLotteries(admin, 0, 100);

            expect(wonResultOne[0]).to.equal(0);
            expect(wonResultOne[1]).to.equal(1);
            expect(wonResultOne.length).to.equal(2);
            expect(wonResultTwo.length).to.equal(0);
            expect(wonResultThree[0]).to.equal(2);
            expect(wonResultThree.length).to.equal(1);
            expect(wonResultFour.length).to.equal(0);

            unclaimedResultOne = await reader.getUnclaimedWonLotteries(userOne, 0, 100);
            unclaimedResultTwo = await reader.getUnclaimedWonLotteries(userTwo, 0, 100);
            unclaimedResultThree = await reader.getUnclaimedWonLotteries(userThree, 0, 100);
            unclaimedResultFour = await reader.getUnclaimedWonLotteries(admin, 0, 100);

            expect(unclaimedResultOne.length).to.equal(0);
            expect(unclaimedResultTwo.length).to.equal(0);
            expect(unclaimedResultThree.length).to.equal(0);
            expect(unclaimedResultFour.length).to.equal(0);
        });
    });
});