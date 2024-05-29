const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const helpers = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const withDecimals = ethers.parseEther;

describe("IDP Factory", function () {
    async function deployFactoryFixture() {

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

        await factory.connect(admin).setRouter(router.target);

        await usdt.connect(admin).mint(withDecimals("20000000000"));

        const zeroAddress = ethers.ZeroAddress;

        return { deployer, admin, userOne, userTwo, userThree, userFour, userFive, usdt, factory, wbnb, router, zeroAddress, token, stable, vault };
    };

    describe("Deployment", function () {
        it("Init storage check", async () => {
            const { router, factory, admin, token, zeroAddress } = await loadFixture(deployFactoryFixture);

            expect(await factory.owner()).to.equal(admin);
            expect(await factory.protocolToken()).to.equal(token.target);
            expect(await factory.router()).to.equal(router.target);
            expect(await factory.feeTo()).to.equal(zeroAddress);
        });
    });

    describe("setRouter", function () {
        it("Should restore new router address", async () => {
            const { router, factory, admin, token } = await loadFixture(deployFactoryFixture);

            expect(await factory.router()).to.equal(router.target);

            await factory.connect(admin).setRouter(token.target);

            expect(await factory.router()).to.equal(token.target);
        });

        it("Should revert call by not an owner", async () => {
            const { factory, userOne, token } = await loadFixture(deployFactoryFixture);

            await expect(factory.connect(userOne).setRouter(token.target)).to.be.revertedWith(
                "Ownable2Step: you are not an owner"
            );
        });
    });

    describe("setFeeTo", function () {
        it("Should restore new feeTo address", async () => {
            const { factory, admin, zeroAddress } = await loadFixture(deployFactoryFixture);

            expect(await factory.feeTo()).to.equal(zeroAddress);

            await factory.connect(admin).setFeeTo(admin);

            expect(await factory.feeTo()).to.equal(admin);
        });

        it("Should revert call by not an owner", async () => {
            const { factory, userOne } = await loadFixture(deployFactoryFixture);

            await expect(factory.connect(userOne).setFeeTo(userOne)).to.be.revertedWith(
                "Ownable2Step: you are not an owner"
            );
        });
    });

    describe("createPair", function () {
        it("Should revert call by not a router or admin", async () => {
            const { factory, userOne, token, usdt, stable, admin, wbnb } = await loadFixture(deployFactoryFixture);

            await expect(factory.connect(userOne).createPair(token.target, usdt.target, false)).to.be.revertedWith(
                "IDPFactory: FORBIDDEN"
            );

            await factory.connect(admin).createPair(token.target, wbnb.target, true);

            await factory.connect(admin).setRouter(userOne);

            await factory.connect(userOne).createPair(token.target, usdt.target, false);

            await factory.connect(userOne).createPair(stable.target, token.target, true);
        });

        it("Should revert call by protocol token absent", async () => {
            const { factory, wbnb, usdt, admin, stable } = await loadFixture(deployFactoryFixture);

            await factory.connect(admin).setRouter(admin);

            await expect(factory.connect(admin).createPair(stable.target, usdt.target, true)).to.be.revertedWith(
                "IDPFactory: PROTOCOL_TOKEN_ABSENT"
            );

            await expect(factory.connect(admin).createPair(stable.target, usdt.target, false)).to.be.revertedWith(
                "IDPFactory: PROTOCOL_TOKEN_ABSENT"
            );

            await expect(factory.connect(admin).createPair(usdt.target, stable.target, false)).to.be.revertedWith(
                "IDPFactory: PROTOCOL_TOKEN_ABSENT"
            );

            await expect(factory.connect(admin).createPair(wbnb.target, stable.target, false)).to.be.revertedWith(
                "IDPFactory: PROTOCOL_TOKEN_ABSENT"
            );

            await expect(factory.connect(admin).createPair(stable.target, wbnb.target, true)).to.be.revertedWith(
                "IDPFactory: PROTOCOL_TOKEN_ABSENT"
            );
        });

        it("Should store right stable token data", async () => {
            const { factory, wbnb, usdt, admin, stable, token } = await loadFixture(deployFactoryFixture);

            await factory.connect(admin).setRouter(admin);

            expect(await factory.stableToken(token.target)).to.equal(false);
            expect(await factory.stableToken(usdt.target)).to.equal(false);

            await factory.connect(admin).createPair(token.target, usdt.target, true);

            expect(await factory.stableToken(token.target)).to.equal(false);
            expect(await factory.stableToken(usdt.target)).to.equal(true);

            expect(await factory.stableToken(token.target)).to.equal(false);
            expect(await factory.stableToken(stable.target)).to.equal(false);

            await factory.connect(admin).createPair(stable.target, token.target, false);

            expect(await factory.stableToken(token.target)).to.equal(false);
            expect(await factory.stableToken(stable.target)).to.equal(false);

            expect(await factory.stableToken(token.target)).to.equal(false);
            expect(await factory.stableToken(wbnb.target)).to.equal(false);

            await factory.connect(admin).createPair(wbnb.target, token.target, true);

            expect(await factory.stableToken(token.target)).to.equal(false);
            expect(await factory.stableToken(wbnb.target)).to.equal(true);
        });

        it("Should store right stableFee data", async () => {
            const { factory, wbnb, usdt, admin, token } = await loadFixture(deployFactoryFixture);

            await factory.connect(admin).setRouter(admin);

            await factory.connect(admin).createPair(token.target, usdt.target, true);

            const stablePair = await factory.getPair(token.target, usdt.target);

            await factory.connect(admin).createPair(wbnb.target, token.target, false);

            const pair = await factory.getPair(token.target, wbnb.target);

            const pairOne = await ethers.getContractAt("IDPPair", stablePair);
            const pairTwo = await ethers.getContractAt("IDPPair", pair);

            expect(await pairOne.feeDenominator()).to.equal(10);
            expect(await pairTwo.feeDenominator()).to.equal(1);
        });
    });

    describe("getStableTokenData", function () {
        it("Should return right stable token data", async () => {
            const { factory, token, usdt, admin, stable, wbnb } = await loadFixture(deployFactoryFixture);

            await factory.connect(admin).setRouter(admin);

            await factory.connect(admin).createPair(token.target, usdt.target, true);

            await factory.connect(admin).createPair(token.target, stable.target, false);

            await factory.connect(admin).createPair(wbnb.target, token.target, true);

            const firstPath = await factory.getStableTokenData([token.target, usdt.target, stable.target, wbnb.target]);

            expect(firstPath[0]).to.equal(false);
            expect(firstPath[1]).to.equal(true);
            expect(firstPath[2]).to.equal(false);
            expect(firstPath[3]).to.equal(true);

            const secondPath = await factory.getStableTokenData([usdt.target, wbnb.target, stable.target, token.target]);

            expect(secondPath[0]).to.equal(true);
            expect(secondPath[1]).to.equal(true);
            expect(secondPath[2]).to.equal(false);
            expect(secondPath[3]).to.equal(false);

            const ThirdPath = await factory.getStableTokenData([token.target, usdt.target, stable.target, wbnb.target, token.target, usdt.target, wbnb.target]);

            expect(ThirdPath[0]).to.equal(false);
            expect(ThirdPath[1]).to.equal(true);
            expect(ThirdPath[2]).to.equal(false);
            expect(ThirdPath[3]).to.equal(true);
            expect(ThirdPath[4]).to.equal(false);
            expect(ThirdPath[5]).to.equal(true);
            expect(ThirdPath[6]).to.equal(true);
        });
    });
});