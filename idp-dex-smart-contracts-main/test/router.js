const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const helpers = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const withDecimals = ethers.parseEther;

describe("IDP Router", function () {
    async function deployRouterFixture() {

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
            const { router, factory, admin, wbnb, vault, token } = await loadFixture(deployRouterFixture);

            expect(await router.owner()).to.equal(admin);
            expect(await router.factory()).to.equal(factory.target);
            expect(await router.WETH()).to.equal(wbnb.target);
            expect(await router.vault()).to.equal(vault.target);
            expect(await router.protocolToken()).to.equal(token.target);
        });
    });

    describe("createPair", function () {
        it("Should revert call by not an owner", async () => {
            const { router, userOne, token, usdt, admin } = await loadFixture(deployRouterFixture);

            await expect(router.connect(userOne).createPair(token.target, usdt.target, false)).to.be.revertedWith(
                "Ownable2Step: you are not an owner"
            );

            await router.connect(admin).transferOwnership(userOne);
            await router.connect(userOne).acceptOwnership();

            await router.connect(userOne).createPair(token.target, usdt.target, false);
        });

        it("Should create pair", async () => {
            const { router, admin, factory, token, usdt } = await loadFixture(deployRouterFixture);

            await router.connect(admin).createPair(token.target, usdt.target, true);

            const stablePair = await factory.getPair(token.target, usdt.target);

            const pairOne = await ethers.getContractAt("IDPPair", stablePair);

            expect(await pairOne.feeDenominator()).to.equal(10);
            expect(await pairOne.factory()).to.equal(factory.target);

            if(parseInt(token.target) < parseInt(usdt.target)) {
                expect(await pairOne.token0()).to.equal(token.target);
                expect(await pairOne.token1()).to.equal(usdt.target);
            } else {
                expect(await pairOne.token0()).to.equal(usdt.target);
                expect(await pairOne.token1()).to.equal(token.target);
            }
        });
    });

    describe("setProtocolBaseFee", function () {
        it("Should revert call by not an owner", async () => {
            const { router, userOne } = await loadFixture(deployRouterFixture);

            await expect(router.connect(userOne).setProtocolBaseFee(1)).to.be.revertedWith(
                "Ownable2Step: you are not an owner"
            );
        });

        it("Should revert call by invalid value", async () => {
            const { router, admin } = await loadFixture(deployRouterFixture);

            await expect(router.connect(admin).setProtocolBaseFee(1001)).to.be.revertedWith(
                "IDPRouter: invalid value"
            );

            await expect(router.connect(admin).setProtocolBaseFee(2000)).to.be.revertedWith(
                "IDPRouter: invalid value"
            );
        });

        it("Should store right value", async () => {
            const { router, admin } = await loadFixture(deployRouterFixture);

            await router.connect(admin).setProtocolBaseFee(999);

            expect(await router.protocolBaseFee()).to.equal(999);

            await router.connect(admin).setProtocolBaseFee(0);

            expect(await router.protocolBaseFee()).to.equal(0);

            await router.connect(admin).setProtocolBaseFee(111);

            expect(await router.protocolBaseFee()).to.equal(111);

            await router.connect(admin).setProtocolBaseFee(333);

            expect(await router.protocolBaseFee()).to.equal(333);

            await router.connect(admin).setProtocolBaseFee(0);

            expect(await router.protocolBaseFee()).to.equal(0);
        });
    });

    describe("setProtocolStableFee", function () {
        it("Should revert call by not an owner", async () => {
            const { router, userOne } = await loadFixture(deployRouterFixture);

            await expect(router.connect(userOne).setProtocolStableFee(1)).to.be.revertedWith(
                "Ownable2Step: you are not an owner"
            );
        });

        it("Should revert call by invalid value", async () => {
            const { router, admin } = await loadFixture(deployRouterFixture);

            await expect(router.connect(admin).setProtocolStableFee(1001)).to.be.revertedWith(
                "IDPRouter: invalid value"
            );

            await expect(router.connect(admin).setProtocolStableFee(2000)).to.be.revertedWith(
                "IDPRouter: invalid value"
            );
        });

        it("Should store right value", async () => {
            const { router, admin } = await loadFixture(deployRouterFixture);

            await router.connect(admin).setProtocolStableFee(999);

            expect(await router.protocolStableFee()).to.equal(999);

            await router.connect(admin).setProtocolStableFee(0);

            expect(await router.protocolStableFee()).to.equal(0);

            await router.connect(admin).setProtocolStableFee(111);

            expect(await router.protocolStableFee()).to.equal(111);

            await router.connect(admin).setProtocolStableFee(333);

            expect(await router.protocolStableFee()).to.equal(333);

            await router.connect(admin).setProtocolStableFee(0);

            expect(await router.protocolStableFee()).to.equal(0);
        });
    });

    describe("addLiquidity", function () {
        it("Should revert call by not an owner before pair created", async () => {
            const { router, userOne, token, admin, stable } = await loadFixture(deployRouterFixture);

            await token.connect(admin).setVault(admin);
            await token.connect(admin).mint(userOne, withDecimals("100000"));
            await stable.connect(admin).transfer(userOne, withDecimals("100000"));

            await token.connect(userOne).approve(router.target, withDecimals("10000000"));
            await stable.connect(userOne).approve(router.target, withDecimals("10000000"));

            await expect(router.connect(userOne).addLiquidity(
                token.target,
                stable.target,
                withDecimals("78978"),
                withDecimals("23456"),
                0,
                0,
                userOne,
                99999999999,
                true
            )).to.be.revertedWith("Ownable2Step: you are not an owner");

            await expect(router.connect(userOne).addLiquidityETH(
                token.target,
                withDecimals("50000"),
                0,
                0,
                userOne,
                99999999999,
                true,
                { value: withDecimals("10") }
            )).to.be.revertedWith("Ownable2Step: you are not an owner");
        });

        it("Should pass liqudity providing after pair created", async () => {
            const { factory, router, userOne, token, admin, stable, wbnb } = await loadFixture(deployRouterFixture);

            await token.connect(admin).setVault(admin);
            await token.connect(admin).mint(userOne, withDecimals("1000000"));
            await stable.connect(admin).transfer(userOne, withDecimals("100000"));

            await token.connect(userOne).approve(router.target, withDecimals("10000000"));
            await stable.connect(userOne).approve(router.target, withDecimals("10000000"));

            await router.connect(admin).createPair(token.target, stable.target, true);

            const pairOneAddress = await factory.getPair(token.target, stable.target);
            const pairOne = await ethers.getContractAt("IDPPair", pairOneAddress);

            expect(await pairOne.balanceOf(userOne)).to.equal(0);

            await router.connect(userOne).addLiquidity(
                token.target,
                stable.target,
                withDecimals("78978"),
                withDecimals("23456"),
                0,
                0,
                userOne,
                99999999999,
                true
            );

            expect(await pairOne.balanceOf(userOne)).to.equal(43040770996811848466930n);

            await router.connect(admin).createPair(token.target, wbnb.target, false);

            const pairTwoAddress = await factory.getPair(token.target, wbnb.target);
            const pairTwo = await ethers.getContractAt("IDPPair", pairTwoAddress);

            expect(await pairTwo.balanceOf(userOne)).to.equal(0);

            await router.connect(userOne).addLiquidityETH(
                token.target,
                withDecimals("50000"),
                0,
                0,
                userOne,
                99999999999,
                true,
                { value: withDecimals("10") }
            );

            expect(await pairTwo.balanceOf(userOne)).to.equal(707106781186547523400n);

            await token.connect(admin).mint(admin, withDecimals("1000000"));

            await token.connect(admin).approve(router.target, withDecimals("10000000"));
            await stable.connect(admin).approve(router.target, withDecimals("10000000"));

            expect(await pairOne.balanceOf(admin)).to.equal(0);

            await router.connect(admin).addLiquidity(
                token.target,
                stable.target,
                withDecimals("12345"),
                withDecimals("67890"),
                0,
                0,
                admin,
                99999999999,
                true
            );

            expect(await pairOne.balanceOf(admin)).to.equal(6727675022862598056883n);

            expect(await pairTwo.balanceOf(admin)).to.equal(0);

            await router.connect(admin).addLiquidityETH(
                token.target,
                withDecimals("13456"),
                0,
                0,
                admin,
                99999999999,
                true,
                { value: withDecimals("7.9") }
            );

            expect(await pairTwo.balanceOf(admin)).to.equal(190296576952923669766n);
        });
    });
});