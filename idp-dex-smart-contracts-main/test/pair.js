const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const helpers = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const withDecimals = ethers.parseEther;

describe("IDP Pair", function () {
    async function deployPairFixture() {

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
            const { factory, admin, token, usdt, wbnb } = await loadFixture(deployPairFixture);

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

    describe("external calls", function () {
        it("Should revert calls by not a router", async () => {
            const { factory, admin, token, usdt, zeroAddress } = await loadFixture(deployPairFixture);

            await factory.connect(admin).createPair(token.target, usdt.target, true);

            const stablePair = await factory.getPair(token.target, usdt.target);

            const pairOne = await ethers.getContractAt("IDPPair", stablePair);

            await expect(pairOne.connect(admin).mint(admin)).to.be.revertedWith(
                "IDP: FORBIDDEN"
            );

            await expect(pairOne.connect(admin).burn(admin)).to.be.revertedWith(
                "IDP: FORBIDDEN"
            );

            await expect(pairOne.connect(admin).swap(1, 1, admin, zeroAddress)).to.be.revertedWith(
                "IDP: FORBIDDEN"
            );
        });
    });

    describe("swap", function () {
        it("Should right fee calculations", async () => {
            const { factory, router, userOne, token, admin, stable, usdt } = await loadFixture(deployPairFixture);

            await token.connect(admin).setVault(admin);
            await token.connect(admin).mint(admin, withDecimals("1000000"));
            await token.connect(admin).mint(userOne, withDecimals("100"));

            await token.connect(admin).approve(router.target, withDecimals("10000000"));
            await stable.connect(admin).approve(router.target, withDecimals("10000000"));

            await router.connect(admin).addLiquidity(
                token.target,
                stable.target,
                withDecimals("140000"),
                withDecimals("210000"),
                0,
                0,
                admin,
                99999999999,
                true
            );

            await token.connect(admin).approve(router.target, withDecimals("10000000"));
            await usdt.connect(admin).approve(router.target, withDecimals("10000000"));

            await router.connect(admin).addLiquidity(
                token.target,
                usdt.target,
                withDecimals("140000"),
                withDecimals("210000"),
                0,
                0,
                admin,
                99999999999,
                false
            );

            const pairOneAddress = await factory.getPair(token.target, stable.target);
            const pairOne = await ethers.getContractAt("IDPPair", pairOneAddress);

            const pairTwoAddress = await factory.getPair(token.target, usdt.target);
            const pairTwo = await ethers.getContractAt("IDPPair", pairTwoAddress);

            expect(await pairOne.feeDenominator()).to.equal(10);
            expect(await pairOne.balanceOf(admin)).to.equal(171464281994822466872809n);
            expect(await pairTwo.feeDenominator()).to.equal(1);
            expect(await pairTwo.balanceOf(admin)).to.equal(171464281994822466872809n);

            const amountToSwap = withDecimals("500");

            const predictedAmountOne = await router.getAmountsOut(amountToSwap, [token.target, stable.target]);
            const predictedAmountTwo = await router.getAmountsOut(amountToSwap, [token.target, usdt.target]);

            await token.connect(admin).transfer(userOne, amountToSwap * 2n);
            await usdt.connect(admin).transfer(userOne, amountToSwap);
            await stable.connect(userOne).approve(router.target, withDecimals("10000000"));
            await token.connect(userOne).approve(router.target, withDecimals("10000000"));
            await usdt.connect(userOne).approve(router.target, withDecimals("10000000"));

            const balanceStableBefore = await stable.balanceOf(userOne);
            const balanceUSDTBefore = await usdt.balanceOf(userOne);

            expect(balanceStableBefore).to.equal(0);

            await router.connect(userOne).swapExactTokensForTokens(
                amountToSwap,
                0,
                [token.target, stable.target],
                userOne,
                99999999999
            );

            await router.connect(userOne).swapExactTokensForTokens(
                amountToSwap,
                0,
                [token.target, usdt.target],
                userOne,
                99999999999
            );

            const balanceUSDTAfter = await usdt.balanceOf(userOne);
            const balanceStableAfter = await stable.balanceOf(userOne);
            const balanceTokenAfter = await token.balanceOf(userOne);

            expect(balanceStableAfter).to.equal(withDecimals("747.182026464075775142"));
            expect(balanceUSDTAfter - balanceUSDTBefore).to.equal(withDecimals("745.841607413575897337"));
            expect(balanceStableAfter - balanceStableBefore).to.equal(predictedAmountOne[1]);
            expect(balanceUSDTAfter - balanceUSDTBefore).to.equal(predictedAmountTwo[1]);
            expect(balanceTokenAfter).to.equal(withDecimals("99.945"));
        });
    });
});