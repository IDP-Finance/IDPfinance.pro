const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const helpers = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const withDecimals = ethers.parseEther;

describe("Ownable2Step", function () {
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
        it("Should revert deploy by initOwner zero address", async function () {
            const { deployer, token, zeroAddress } = await loadFixture(deployFactoryFixture);

            const IDPFactory = await ethers.getContractFactory("IDPFactory", deployer);

            await expect(IDPFactory.deploy(zeroAddress, token.target)).to.be.revertedWith("Ownable2Step: zero address");
        });

        it("Should store right owner address", async function () {
            const { factory, admin } = await loadFixture(deployFactoryFixture);

            expect(await factory.owner()).to.equal(admin);
        });
    });

    describe("transferOwnership", function () {
        it("Should store right pendingOwner", async function () {
            const { factory, admin, userOne, zeroAddress } = await loadFixture(deployFactoryFixture);

            expect(await factory.pendingOwner()).to.equal(zeroAddress);
            expect(await factory.owner()).to.equal(admin);

            await factory.connect(admin).transferOwnership(userOne);

            expect(await factory.pendingOwner()).to.equal(userOne);
            expect(await factory.owner()).to.equal(admin);
        });

        it("Should revert call by not an owner", async function () {
            const { factory, userOne } = await loadFixture(deployFactoryFixture);

            await expect(factory.connect(userOne).transferOwnership(userOne)).to.be.revertedWith("Ownable2Step: you are not an owner");
        });
    });

    describe("acceptOwnership", function () {
        it("Should revert call by not a pendingOwner", async function () {
            const { factory, admin, userOne } = await loadFixture(deployFactoryFixture);

            await expect(factory.connect(admin).acceptOwnership()).to.be.revertedWith("Ownable2Step: you are not a pending owner");
            await expect(factory.connect(userOne).acceptOwnership()).to.be.revertedWith("Ownable2Step: you are not a pending owner");

            await factory.connect(admin).transferOwnership(userOne);

            await expect(factory.connect(admin).acceptOwnership()).to.be.revertedWith("Ownable2Step: you are not a pending owner");
        });

        it("Should transfer ownership", async function () {
            const { factory, admin, userOne, zeroAddress } = await loadFixture(deployFactoryFixture);

            await factory.connect(admin).transferOwnership(userOne);

            await factory.connect(userOne).acceptOwnership();

            expect(await factory.pendingOwner()).to.equal(zeroAddress);
            expect(await factory.owner()).to.equal(userOne);
        });
    });
});
