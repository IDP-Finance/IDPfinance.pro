const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const helpers = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const withDecimals = ethers.parseEther;

describe("IDP Token", function () {
    async function deployTokenFixture() {

        const [deployer, admin, userOne, userTwo, userThree, userFour, userFive] = await ethers.getSigners();

        const IDPToken = await ethers.getContractFactory("IDPToken", deployer);
        const token = await IDPToken.deploy(admin);
        await token.waitForDeployment();

        const zeroAddress = ethers.ZeroAddress;

        return { deployer, admin, userOne, userTwo, userThree, userFour, userFive, zeroAddress, token };
    };

    describe("Deployment", function () {
        it("Init storage check", async () => {
            const { admin, token, zeroAddress } = await loadFixture(deployTokenFixture);

            expect(await token.owner()).to.equal(admin);
            expect(await token.vault()).to.equal(zeroAddress);
        });
    });

    describe("setVault", function () {
        it("Should revert call by not an owner", async () => {
            const { token, userOne } = await loadFixture(deployTokenFixture);

            await expect(token.connect(userOne).setVault(userOne)).to.be.
                revertedWithCustomError(token, "OwnableUnauthorizedAccount").withArgs(userOne);
        });

        it("Should revert second call", async () => {
            const { token, admin, userOne } = await loadFixture(deployTokenFixture);

            await token.connect(admin).setVault(admin);

            await expect(token.connect(admin).setVault(userOne)).to.be.revertedWith(
                "IDPToken: zero address"
            );
        });

        it("Should store right value", async () => {
            const { token, admin } = await loadFixture(deployTokenFixture);

            await token.connect(admin).setVault(admin);

            expect(await token.vault()).to.equal(admin);
        });
    });

    describe("mint", function () {
        it("Should revert call by not a vault", async () => {
            const { token, userOne } = await loadFixture(deployTokenFixture);

            await expect(token.connect(userOne).mint(userOne, withDecimals("1"))).to.be.revertedWith(
                "IDPToken: forbidden"
            );
        });

        it("Should pass call by a vault", async () => {
            const { token, admin, userOne } = await loadFixture(deployTokenFixture);

            await token.connect(admin).setVault(admin);

            await token.connect(admin).mint(userOne, withDecimals("1"));
        });

        it("Should mint right amount", async () => {
            const { token, admin, userOne } = await loadFixture(deployTokenFixture);

            await token.connect(admin).setVault(admin);

            const amountToMint = withDecimals("111.99");

            const tokenBalanceBefore = await token.balanceOf(userOne);
            const tokenTotalSupplyBefore = await token.totalSupply();

            await token.connect(admin).mint(userOne, amountToMint);

            const tokenBalanceAfter = await token.balanceOf(userOne);
            const tokenTotalSypplyAfter = await token.totalSupply();

            expect(tokenBalanceBefore + amountToMint).to.equal(tokenBalanceAfter);
            expect(tokenTotalSupplyBefore + amountToMint).to.equal(tokenTotalSypplyAfter);
        });
    });
});