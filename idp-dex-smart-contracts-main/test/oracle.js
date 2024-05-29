const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const helpers = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

describe("IDP Oracle", function () {
    async function deployOracleFixture() {

        const [deployer, admin, userOne, userTwo, userThree, userFour, userFive] = await ethers.getSigners();

        const VRFCoordinator = await ethers.getContractFactory("contracts/mock/VRFCoordinator.sol:VRFCoordinator", deployer);
        const coordinator = await VRFCoordinator.deploy();
        await coordinator.waitForDeployment();

        const subscriptionId = 797;

        const IDPOracle = await ethers.getContractFactory("IDPOracle", deployer);
        const oracle = await IDPOracle.deploy(admin, coordinator.target, subscriptionId);
        await oracle.waitForDeployment();

        const zeroAddress = ethers.ZeroAddress;

        await oracle.connect(admin).setAllowedCaller(admin);

        return { deployer, admin, userOne, userTwo, userThree, userFour, userFive, zeroAddress, oracle, coordinator };
    };

    describe("Deployment", function () {
        it("Init storage check", async () => {
            const { admin, oracle, coordinator } = await loadFixture(deployOracleFixture);

            expect(await oracle.owner()).to.equal(admin);
            expect(await oracle.COORDINATOR()).to.equal(coordinator.target);
            expect(await oracle.callbackGasLimit()).to.equal(200000);
            expect(await oracle.requestConfirmations()).to.equal(5);
            expect(await oracle.numWords()).to.equal(1);
        });
    });

    describe("Owner functions", function () {
        describe("setAllowedCaller", function () {
            it("Should revert call by not an owner", async () => {
                const { oracle, userOne } = await loadFixture(deployOracleFixture);
    
                await expect(oracle.connect(userOne).setAllowedCaller(userOne)).to.be.
                    revertedWithCustomError(oracle, "OwnableUnauthorizedAccount").withArgs(userOne);
            });

            it("Should store right value", async () => {
                const { oracle, admin, userOne } = await loadFixture(deployOracleFixture);

                expect(await oracle.allowedCaller(userOne)).to.equal(false);
    
                await oracle.connect(admin).setAllowedCaller(userOne);

                expect(await oracle.allowedCaller(userOne)).to.equal(true);

                expect(await oracle.allowedCaller(admin)).to.equal(true);

                await oracle.connect(admin).setAllowedCaller(admin);

                expect(await oracle.allowedCaller(admin)).to.equal(false);
            });
        });

        describe("setKeyHash", function () {
            it("Should revert call by not an owner", async () => {
                const { oracle, userOne } = await loadFixture(deployOracleFixture);

                const newKeyHash = "0x0000000000000000000000000000000000001000000000000000000000000000";

                await expect(oracle.connect(userOne).setKeyHash(newKeyHash)).to.be.
                    revertedWithCustomError(oracle, "OwnableUnauthorizedAccount").withArgs(userOne);
            });

            it("Should store right value", async () => {
                const { oracle, admin } = await loadFixture(deployOracleFixture);

                const newKeyHash = "0x0000000000000000300000000000000000001000000000000000000000000000";

                await oracle.connect(admin).setKeyHash(newKeyHash);

                expect(await oracle.keyHash()).to.equal(newKeyHash);

                const newKeyHashTwo = "0x0000000000030000000000ff0000000000001000000000000000000000000000";

                await oracle.connect(admin).setKeyHash(newKeyHashTwo);

                expect(await oracle.keyHash()).to.equal(newKeyHashTwo);
            });
        });

        describe("setCallbackGasLimit", function () {
            it("Should revert call by not an owner", async () => {
                const { oracle, userOne } = await loadFixture(deployOracleFixture);
    
                await expect(oracle.connect(userOne).setCallbackGasLimit(1)).to.be.
                    revertedWithCustomError(oracle, "OwnableUnauthorizedAccount").withArgs(userOne);
            });

            it("Should revert call by below min value", async () => {
                const { oracle, admin } = await loadFixture(deployOracleFixture);
    
                await expect(oracle.connect(admin).setCallbackGasLimit(150000)).to.be.revertedWith(
                    "IDPOracle: below min"
                );
            });

            it("Should revert call by max value exceeded", async () => {
                const { oracle, admin } = await loadFixture(deployOracleFixture);
    
                await expect(oracle.connect(admin).setCallbackGasLimit(2500000)).to.be.revertedWith(
                    "IDPOracle: exceeded max"
                );
            });

            it("Should store right value", async () => {
                const { oracle, admin } = await loadFixture(deployOracleFixture);

                await oracle.connect(admin).setCallbackGasLimit(259789);

                expect(await oracle.callbackGasLimit()).to.equal(259789);

                await oracle.connect(admin).setCallbackGasLimit(1564765);

                expect(await oracle.callbackGasLimit()).to.equal(1564765);
            });
        });

        describe("setRequestConfirmations", function () {
            it("Should revert call by not an owner", async () => {
                const { oracle, userOne } = await loadFixture(deployOracleFixture);
    
                await expect(oracle.connect(userOne).setRequestConfirmations(1)).to.be.
                    revertedWithCustomError(oracle, "OwnableUnauthorizedAccount").withArgs(userOne);
            });

            it("Should revert call by below min value", async () => {
                const { oracle, admin } = await loadFixture(deployOracleFixture);
    
                await expect(oracle.connect(admin).setRequestConfirmations(2)).to.be.revertedWith(
                    "IDPOracle: below min"
                );
            });

            it("Should revert call by max value exceeded", async () => {
                const { oracle, admin } = await loadFixture(deployOracleFixture);
    
                await expect(oracle.connect(admin).setRequestConfirmations(200)).to.be.revertedWith(
                    "IDPOracle: exceeded max"
                );
            });

            it("Should store right value", async () => {
                const { oracle, admin } = await loadFixture(deployOracleFixture);

                await oracle.connect(admin).setRequestConfirmations(3);

                expect(await oracle.requestConfirmations()).to.equal(3);

                await oracle.connect(admin).setRequestConfirmations(189);

                expect(await oracle.requestConfirmations()).to.equal(189);
            });
        });

        describe("setNumWords", function () {
            it("Should revert call by not an owner", async () => {
                const { oracle, userOne } = await loadFixture(deployOracleFixture);
    
                await expect(oracle.connect(userOne).setNumWords(1)).to.be.
                    revertedWithCustomError(oracle, "OwnableUnauthorizedAccount").withArgs(userOne);
            });

            it("Should revert call by below min value", async () => {
                const { oracle, admin } = await loadFixture(deployOracleFixture);
    
                await expect(oracle.connect(admin).setNumWords(0)).to.be.revertedWith(
                    "IDPOracle: below min"
                );
            });

            it("Should revert call by max value exceeded", async () => {
                const { oracle, admin } = await loadFixture(deployOracleFixture);
    
                await expect(oracle.connect(admin).setNumWords(500)).to.be.revertedWith(
                    "IDPOracle: exceeded max"
                );
            });

            it("Should store right value", async () => {
                const { oracle, admin } = await loadFixture(deployOracleFixture);

                await oracle.connect(admin).setNumWords(155);

                expect(await oracle.numWords()).to.equal(155);

                await oracle.connect(admin).setNumWords(7);

                expect(await oracle.numWords()).to.equal(7);
            });
        });

        describe("renounceOwnership", function () {
            it("Should revert call by not an owner", async () => {
                const { oracle, userOne } = await loadFixture(deployOracleFixture);
    
                await expect(oracle.connect(userOne).renounceOwnership()).to.be.
                    revertedWithCustomError(oracle, "OwnableUnauthorizedAccount").withArgs(userOne);
            });
    
            it("Should revert call by an owner", async () => {
                const { oracle, admin } = await loadFixture(deployOracleFixture);
    
                await expect(oracle.connect(admin).renounceOwnership()).to.be.reverted;
            });
        });
    });

    describe("Requests", function () {
        it("Should revert call requestRandomWords by not allowed caller", async () => {
            const { oracle, userOne } = await loadFixture(deployOracleFixture);

            await expect(oracle.connect(userOne).requestRandomWords()).to.be.revertedWith(
                "IDPOracle: forbidden"
            );
        });

        it("Should revert call rawFulfillRandomWords by not allowed caller", async () => {
            const { oracle, userOne, coordinator } = await loadFixture(deployOracleFixture);

            await expect(oracle.connect(userOne).rawFulfillRandomWords(0, [0])).to.be.
                revertedWithCustomError(oracle, "OnlyCoordinatorCanFulfill").withArgs(userOne, coordinator.target);
        });

        it("Should pass base request", async () => {
            const { oracle, coordinator, admin } = await loadFixture(deployOracleFixture);

            const requestNumber = 1;

            const requestOne = await oracle.s_requests(requestNumber);

            expect(requestOne.fulfilled).to.equal(false);
            expect(requestOne.exists).to.equal(false);

            await expect(oracle.getRequestStatus(requestNumber)).to.be.revertedWith(
                "IDPOracle: request not found"
            );

            await expect(coordinator.provideRandomData(oracle.target, requestNumber, [1579])).to.be.revertedWith(
                "IDPOracle: request not found"
            );

            await oracle.connect(admin).requestRandomWords();

            const requestTwo = await oracle.s_requests(requestNumber);

            expect(requestTwo.fulfilled).to.equal(false);
            expect(requestTwo.exists).to.equal(true);

            const requestTwoFunction = await oracle.getRequestStatus(requestNumber);

            expect(requestTwoFunction.fulfilled).to.equal(false);

            await coordinator.provideRandomData(oracle.target, requestNumber, [1579]);

            const requestThree = await oracle.s_requests(requestNumber);

            expect(requestThree.fulfilled).to.equal(true);
            expect(requestThree.exists).to.equal(true);

            const requestThreeFunction = await oracle.getRequestStatus(requestNumber);

            expect(requestThreeFunction.fulfilled).to.equal(true);
            expect(requestThreeFunction.randomWords[0]).to.equal(1579);
        });
    });
});