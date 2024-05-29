const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const helpers = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const withDecimals = ethers.parseEther;
const withoutDecimals = ethers.formatEther;

describe("IDP Vault", function () {
    async function deployVaultFixture() {

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
            const { vault, admin, token, usdt } = await loadFixture(deployVaultFixture);

            expect(await vault.owner()).to.equal(admin);
            expect(await vault.protocolToken()).to.equal(token.target);
            expect(await vault.depositReserve()).to.equal(0);
            expect(await vault.protocolReserve()).to.equal(0);
            expect(await vault.depositToken()).to.equal(usdt.target);
            expect(await vault.getCurrentDisposalPrice()).to.equal(withDecimals("1"));
            expect(await vault.getFeeReceiversLength()).to.equal(0);
            await expect(vault.feeReceivers(0)).to.be.reverted;
        });
    });

    describe("buyToken", function () {
        it("Should revert call by invalid inputs", async () => {
            const { vault, admin, token, usdt } = await loadFixture(deployVaultFixture);

            await token.connect(admin).setVault(vault.target);
            await usdt.connect(admin).approve(vault.target, withDecimals("10000000000"));

            await expect(vault.connect(admin).buyToken(0, 0)).to.be.revertedWith(
                "IDPVault: invalid inputs"
            );

            await expect(vault.connect(admin).buyToken(1, 1)).to.be.revertedWith(
                "IDPVault: invalid inputs"
            );
        });

        it("Should revert call by invalid amountOut without feeReceivers", async () => {
            const { vault, admin, token, usdt } = await loadFixture(deployVaultFixture);

            await token.connect(admin).setVault(vault.target);
            await usdt.connect(admin).approve(vault.target, withDecimals("10000000000"));


            await expect(vault.connect(admin).buyToken(withDecimals("1000000.01"), 0)).to.be.revertedWith(
                "IDPVault: invalid amountOut"
            );

            await expect(vault.connect(admin).buyToken(withDecimals("10000000.01"), 0)).to.be.revertedWith(
                "IDPVault: invalid amountOut"
            );

            await expect(vault.connect(admin).buyToken(0, withDecimals("1000000.01"))).to.be.revertedWith(
                "IDPVault: invalid amountOut"
            );

            await expect(vault.connect(admin).buyToken(0, withDecimals("10000000.01"))).to.be.revertedWith(
                "IDPVault: invalid amountOut"
            );
        });

        it("Should revert call by invalid amountOut with feeReceivers", async () => {
            const { vault, admin, token, usdt, userOne } = await loadFixture(deployVaultFixture);

            await token.connect(admin).setVault(vault.target);
            await usdt.connect(admin).approve(vault.target, withDecimals("10000000000"));

            await vault.connect(admin).setFeeReceiver(userOne);

            await expect(vault.connect(admin).buyToken(withDecimals("1000000.01"), 0)).to.be.revertedWith(
                "IDPVault: invalid amountOut"
            );

            await expect(vault.connect(admin).buyToken(withDecimals("10000000"), 0)).to.be.revertedWith(
                "IDPVault: invalid amountOut"
            );

            await expect(vault.connect(admin).buyToken(0, withDecimals("999001.01"))).to.be.revertedWith(
                "IDPVault: invalid amountOut"
            );
        });

        it("Should pass call by zero protocolReserve without feeReceivers", async () => {
            const { vault, admin, token, usdt } = await loadFixture(deployVaultFixture);

            await token.connect(admin).setVault(vault.target);
            await usdt.connect(admin).approve(vault.target, withDecimals("10000000000"));

            const totalSupplyBefore = await token.totalSupply();
            const tokenAdminBalanceBefore = await token.balanceOf(admin);
            const tokenVaultBalanceBefore = await token.balanceOf(vault.target);
            const usdtAdminBalanceBefore = await usdt.balanceOf(admin);
            const usdtVaultBalanceBefore = await usdt.balanceOf(vault.target);
            const protocolReserveBefore = await vault.protocolReserve();
            const depositReserveBefore = await vault.depositReserve();

            const amountToPay = withDecimals("10000");
            const amountOut = await vault.getAmountOut(amountToPay);

            await vault.connect(admin).buyToken(amountToPay, 0);

            const totalSupplyAfter = await token.totalSupply();
            const tokenAdminBalanceAfter = await token.balanceOf(admin);
            const tokenVaultBalanceAfter = await token.balanceOf(vault.target);
            const usdtAdminBalanceAfter = await usdt.balanceOf(admin);
            const usdtVaultBalanceAfter = await usdt.balanceOf(vault.target);
            const protocolReserveAfter = await vault.protocolReserve();
            const depositReserveAfter = await vault.depositReserve();

            expect(totalSupplyBefore + withDecimals("1000000")).to.equal(totalSupplyAfter);
            expect(withDecimals("990000") + amountOut[0] + amountOut[1]).to.equal(totalSupplyAfter);
            expect(tokenAdminBalanceBefore + amountOut[0]).to.equal(tokenAdminBalanceAfter);
            expect(tokenVaultBalanceBefore + withDecimals("990000")).to.equal(tokenVaultBalanceAfter);
            expect(usdtAdminBalanceBefore - amountToPay).to.equal(usdtAdminBalanceAfter);
            expect(usdtVaultBalanceBefore + amountToPay).to.equal(usdtVaultBalanceAfter);
            expect(protocolReserveBefore + withDecimals("990000")).to.equal(protocolReserveAfter);
            expect(depositReserveBefore + amountToPay).to.equal(depositReserveAfter);
        });

        it("Should pass call by zero protocolReserve with feeReceivers", async () => {
            const { vault, admin, token, usdt, userOne } = await loadFixture(deployVaultFixture);

            await token.connect(admin).setVault(vault.target);
            await usdt.connect(admin).approve(vault.target, withDecimals("10000000000"));
            await vault.connect(admin).setFeeReceiver(userOne);

            const totalSupplyBefore = await token.totalSupply();
            const tokenAdminBalanceBefore = await token.balanceOf(admin);
            const tokenVaultBalanceBefore = await token.balanceOf(vault.target);
            const usdtAdminBalanceBefore = await usdt.balanceOf(admin);
            const usdtVaultBalanceBefore = await usdt.balanceOf(vault.target);
            const protocolReserveBefore = await vault.protocolReserve();
            const depositReserveBefore = await vault.depositReserve();

            const amountToPay = withDecimals("10000");
            const amountOut = await vault.getAmountOut(amountToPay);

            await vault.connect(admin).buyToken(amountToPay, 0);

            const totalSupplyAfter = await token.totalSupply();
            const tokenAdminBalanceAfter = await token.balanceOf(admin);
            const tokenVaultBalanceAfter = await token.balanceOf(vault.target);
            const usdtAdminBalanceAfter = await usdt.balanceOf(admin);
            const usdtVaultBalanceAfter = await usdt.balanceOf(vault.target);
            const protocolReserveAfter = await vault.protocolReserve();
            const depositReserveAfter = await vault.depositReserve();

            expect(totalSupplyBefore + withDecimals("1000000")).to.equal(totalSupplyAfter);
            expect(withDecimals("990000") + amountOut[0] + amountOut[1]).to.equal(totalSupplyAfter);
            expect(tokenAdminBalanceBefore + amountOut[0]).to.equal(tokenAdminBalanceAfter);
            expect(tokenVaultBalanceBefore + withDecimals("990000")).to.equal(tokenVaultBalanceAfter);
            expect(usdtAdminBalanceBefore - amountToPay).to.equal(usdtAdminBalanceAfter);
            expect(usdtVaultBalanceBefore + amountToPay).to.equal(usdtVaultBalanceAfter);
            expect(protocolReserveBefore + withDecimals("990000")).to.equal(protocolReserveAfter);
            expect(depositReserveBefore + amountToPay).to.equal(depositReserveAfter);
        });

        it("Should pass call with right calculations", async () => {
            const { vault, admin, token, usdt, userOne } = await loadFixture(deployVaultFixture);

            await token.connect(admin).setVault(vault.target);
            await usdt.connect(admin).approve(vault.target, withDecimals("10000000000"));
            await vault.connect(admin).setFeeReceiver(userOne);

            const totalSupplyBefore = await token.totalSupply();
            const tokenAdminBalanceBefore = await token.balanceOf(admin);
            const tokenVaultBalanceBefore = await token.balanceOf(vault.target);
            const usdtAdminBalanceBefore = await usdt.balanceOf(admin);
            const usdtVaultBalanceBefore = await usdt.balanceOf(vault.target);
            const protocolReserveBefore = await vault.protocolReserve();
            const depositReserveBefore = await vault.depositReserve();

            const amountToBuy = withDecimals("10000");
            const amountToPay = await vault.getAmountIn(amountToBuy)
            const amountOut = await vault.getAmountOut(amountToPay);

            expect(amountToBuy).to.equal(amountOut[0]);

            await vault.connect(admin).buyToken(0, amountToBuy);

            const totalSupplyAfter = await token.totalSupply();
            const tokenAdminBalanceAfter = await token.balanceOf(admin);
            const tokenVaultBalanceAfter = await token.balanceOf(vault.target);
            const usdtAdminBalanceAfter = await usdt.balanceOf(admin);
            const usdtVaultBalanceAfter = await usdt.balanceOf(vault.target);
            const protocolReserveAfter = await vault.protocolReserve();
            const depositReserveAfter = await vault.depositReserve();

            expect(totalSupplyBefore + withDecimals("1000000")).to.equal(totalSupplyAfter);
            expect(await token.balanceOf(vault.target) + amountOut[0] + amountOut[1]).to.equal(totalSupplyAfter);
            expect(tokenAdminBalanceBefore + amountOut[0]).to.equal(tokenAdminBalanceAfter);
            expect(tokenVaultBalanceBefore + withDecimals("989989.989989989989989990")).to.equal(tokenVaultBalanceAfter);
            expect(usdtAdminBalanceBefore - amountToPay).to.equal(usdtAdminBalanceAfter);
            expect(usdtVaultBalanceBefore + amountToPay).to.equal(usdtVaultBalanceAfter);
            expect(protocolReserveBefore + withDecimals("989989.989989989989989990")).to.equal(protocolReserveAfter);
            expect(depositReserveBefore + amountToPay).to.equal(depositReserveAfter);

            const totalSupplyBeforeTwo = await token.totalSupply();
            const tokenAdminBalanceBeforeTwo = await token.balanceOf(admin);
            const tokenVaultBalanceBeforeTwo = await token.balanceOf(vault.target);
            const usdtAdminBalanceBeforeTwo = await usdt.balanceOf(admin);
            const usdtVaultBalanceBeforeTwo = await usdt.balanceOf(vault.target);
            const protocolReserveBeforeTwo = await vault.protocolReserve();
            const depositReserveBeforeTwo = await vault.depositReserve();

            const amountToBuyTwo = withDecimals("878921.903");
            const amountToPayTwo = await vault.getAmountIn(amountToBuyTwo)
            const amountOutTwo = await vault.getAmountOut(amountToPayTwo);

            expect(amountToBuyTwo).to.equal(amountOutTwo[0]);

            await vault.connect(admin).buyToken(0, amountToBuyTwo);

            const totalSupplyAfterTwo = await token.totalSupply();
            const tokenAdminBalanceAfterTwo = await token.balanceOf(admin);
            const tokenVaultBalanceAfterTwo = await token.balanceOf(vault.target);
            const usdtAdminBalanceAfterTwo = await usdt.balanceOf(admin);
            const usdtVaultBalanceAfterTwo = await usdt.balanceOf(vault.target);
            const protocolReserveAfterTwo = await vault.protocolReserve();
            const depositReserveAfterTwo = await vault.depositReserve();

            expect(totalSupplyBeforeTwo).to.equal(totalSupplyAfterTwo);
            expect(await token.balanceOf(vault.target) + await token.balanceOf(admin) + await token.balanceOf(userOne)).to.equal(totalSupplyAfterTwo);
            expect(tokenAdminBalanceBeforeTwo + amountOutTwo[0]).to.equal(tokenAdminBalanceAfterTwo);
            expect(tokenVaultBalanceBeforeTwo - amountOutTwo[0] - amountOutTwo[1]).to.equal(tokenVaultBalanceAfterTwo);
            expect(usdtAdminBalanceBeforeTwo - amountToPayTwo).to.equal(usdtAdminBalanceAfterTwo);
            expect(usdtVaultBalanceBeforeTwo + amountToPayTwo).to.equal(usdtVaultBalanceAfterTwo);
            expect(protocolReserveBeforeTwo - amountOutTwo[0] - amountOutTwo[1]).to.equal(protocolReserveAfterTwo);
            expect(depositReserveBeforeTwo + amountToPayTwo).to.equal(depositReserveAfterTwo);

            const totalSupplyBeforeThree = await token.totalSupply();
            const tokenAdminBalanceBeforeThree = await token.balanceOf(admin);
            const tokenVaultBalanceBeforeThree = await token.balanceOf(vault.target);
            const usdtAdminBalanceBeforeThree = await usdt.balanceOf(admin);
            const usdtVaultBalanceBeforeThree = await usdt.balanceOf(vault.target);
            const protocolReserveBeforeThree = await vault.protocolReserve();
            const depositReserveBeforeThree = await vault.depositReserve();

            const amountToBuyThree = withDecimals("37921.903");
            const amountToPayThree = await vault.getAmountIn(amountToBuyThree)
            const amountOutThree = await vault.getAmountOut(amountToPayThree);

            expect(amountToBuyThree).to.equal(amountOutThree[0]);

            await vault.connect(admin).buyToken(0, amountToBuyThree);

            const totalSupplyAfterThree = await token.totalSupply();
            const tokenAdminBalanceAfterThree = await token.balanceOf(admin);
            const tokenVaultBalanceAfterThree = await token.balanceOf(vault.target);
            const usdtAdminBalanceAfterThree = await usdt.balanceOf(admin);
            const usdtVaultBalanceAfterThree = await usdt.balanceOf(vault.target);
            const protocolReserveAfterThree = await vault.protocolReserve();
            const depositReserveAfterThree = await vault.depositReserve();

            expect(totalSupplyBeforeThree + withDecimals("1000000")).to.equal(totalSupplyAfterThree);
            expect(await token.balanceOf(vault.target) + await token.balanceOf(admin) + await token.balanceOf(userOne)).to.equal(totalSupplyAfterThree);
            expect(tokenAdminBalanceBeforeThree + amountOutThree[0]).to.equal(tokenAdminBalanceAfterThree);
            expect(tokenVaultBalanceBeforeThree - amountOutThree[0] - amountOutThree[1] + withDecimals("1000000")).to.equal(tokenVaultBalanceAfterThree);
            expect(usdtAdminBalanceBeforeThree - amountToPayThree).to.equal(usdtAdminBalanceAfterThree);
            expect(usdtVaultBalanceBeforeThree + amountToPayThree).to.equal(usdtVaultBalanceAfterThree);
            expect(protocolReserveBeforeThree - amountOutThree[0] - amountOutThree[1] + withDecimals("1000000")).to.equal(protocolReserveAfterThree);
            expect(depositReserveBeforeThree + amountToPayThree).to.equal(depositReserveAfterThree);
        });
    });

    describe("sellToken", function () {
        it("Should revert call by invalid input", async () => {
            const { vault, admin, token, usdt } = await loadFixture(deployVaultFixture);

            await token.connect(admin).setVault(vault.target);
            await usdt.connect(admin).approve(vault.target, withDecimals("10000000000"));

            await expect(vault.connect(admin).sellToken(0)).to.be.revertedWith(
                "IDPVault: invalid amountIn"
            );
        });

        it("Should pass call with right calculations", async () => {
            const { vault, admin, token, usdt, userOne, stable, router, factory } = await loadFixture(deployVaultFixture);

            await token.connect(admin).setVault(vault.target);
            await usdt.connect(admin).approve(vault.target, withDecimals("10000000000"));
            await token.connect(admin).approve(vault.target, withDecimals("10000000000"));
            await vault.connect(admin).setFeeReceiver(userOne);

            const amountToBuy = withDecimals("350000");
            const amountToPay = await vault.getAmountIn(amountToBuy)
            const amountOut = await vault.getAmountOut(amountToPay);

            expect(amountToBuy).to.equal(amountOut[0]);

            await vault.connect(admin).buyToken(0, amountToBuy);

            const totalSupplyBefore = await token.totalSupply();
            const tokenAdminBalanceBefore = await token.balanceOf(admin);
            const tokenVaultBalanceBefore = await token.balanceOf(vault.target);
            const usdtAdminBalanceBefore = await usdt.balanceOf(admin);
            const usdtVaultBalanceBefore = await usdt.balanceOf(vault.target);
            const protocolReserveBefore = await vault.protocolReserve();
            const depositReserveBefore = await vault.depositReserve();
            const priceBefore = await vault.getCurrentDisposalPrice();

            const amountToSell = await token.balanceOf(admin) / 3n;
            const amountToReceive = await vault.getDisposalAmountOut(amountToSell);

            await vault.connect(admin).sellToken(amountToSell);

            const totalSupplyAfter = await token.totalSupply();
            const tokenAdminBalanceAfter = await token.balanceOf(admin);
            const tokenVaultBalanceAfter = await token.balanceOf(vault.target);
            const usdtAdminBalanceAfter = await usdt.balanceOf(admin);
            const usdtVaultBalanceAfter = await usdt.balanceOf(vault.target);
            const protocolReserveAfter = await vault.protocolReserve();
            const depositReserveAfter = await vault.depositReserve();
            const priceAfter = await vault.getCurrentDisposalPrice();

            expect(priceBefore).to.equal(withDecimals("1"));
            expect(priceAfter).to.equal(withDecimals("1"));
            expect(totalSupplyBefore).to.equal(totalSupplyAfter);
            expect(await token.balanceOf(vault.target) + await token.balanceOf(admin) + await token.balanceOf(userOne)).to.equal(totalSupplyAfter);
            expect(tokenAdminBalanceBefore - amountToSell).to.equal(tokenAdminBalanceAfter);
            expect(tokenVaultBalanceBefore + amountToSell).to.equal(tokenVaultBalanceAfter);
            expect(usdtAdminBalanceBefore + amountToReceive).to.equal(usdtAdminBalanceAfter);
            expect(usdtVaultBalanceBefore - amountToReceive).to.equal(usdtVaultBalanceAfter);
            expect(protocolReserveBefore + amountToSell).to.equal(protocolReserveAfter);
            expect(depositReserveBefore - amountToReceive).to.equal(depositReserveAfter);

            await token.connect(admin).approve(router.target, withDecimals("100000000"));
            await stable.connect(admin).approve(router.target, withDecimals("1000000000"));

            await router.connect(admin).addLiquidity(
                token.target,
                stable.target,
                withDecimals("123978"),
                withDecimals("179735"),
                0,
                0,
                admin,
                99999999999,
                false
            );

            const pairAddress = await factory.getPair(token.target, stable.target);
            const pairOne = await ethers.getContractAt("IDPPair", pairAddress);

            expect(await vault.depositReserve() * withDecimals("1") / (await token.totalSupply() - await vault.protocolReserve())).to.equal(withDecimals("1"));
            expect(await vault.getCurrentDisposalPrice()).to.equal(withDecimals("1"));

            await router.connect(admin).swapExactTokensForTokens(withDecimals("13546"), 0, [stable.target, token.target], admin, 99999999999);

            const precomputedPriceOne = await vault.depositReserve() * withDecimals("1") / (await token.totalSupply() - await vault.protocolReserve());

            expect(precomputedPriceOne).to.equal(await vault.getCurrentDisposalPrice());

            const totalSupplyBeforeTwo = await token.totalSupply();
            const tokenAdminBalanceBeforeTwo = await token.balanceOf(admin);
            const tokenVaultBalanceBeforeTwo = await token.balanceOf(vault.target);
            const usdtAdminBalanceBeforeTwo = await usdt.balanceOf(admin);
            const usdtVaultBalanceBeforeTwo = await usdt.balanceOf(vault.target);
            const protocolReserveBeforeTwo = await vault.protocolReserve();
            const depositReserveBeforeTwo = await vault.depositReserve();
            const priceBeforeTwo = await vault.getCurrentDisposalPrice();

            const amountToSellTwo = await token.balanceOf(admin) / 3n;
            const amountToReceiveTwo = await vault.getDisposalAmountOut(amountToSellTwo);

            await vault.connect(admin).sellToken(amountToSellTwo);

            const precomputedPriceTwo = await vault.depositReserve() * withDecimals("1") / (await token.totalSupply() - await vault.protocolReserve());

            const totalSupplyAfterTwo = await token.totalSupply();
            const tokenAdminBalanceAfterTwo = await token.balanceOf(admin);
            const tokenVaultBalanceAfterTwo = await token.balanceOf(vault.target);
            const usdtAdminBalanceAfterTwo = await usdt.balanceOf(admin);
            const usdtVaultBalanceAfterTwo = await usdt.balanceOf(vault.target);
            const protocolReserveAfterTwo = await vault.protocolReserve();
            const depositReserveAfterTwo = await vault.depositReserve();
            const priceAfterTwo = await vault.getCurrentDisposalPrice();

            expect(priceBeforeTwo).to.equal(precomputedPriceOne);
            expect(priceAfterTwo).to.equal(precomputedPriceTwo);
            expect(totalSupplyBeforeTwo).to.equal(totalSupplyAfterTwo);
            expect(await token.balanceOf(vault.target) + await token.balanceOf(pairOne.target) + await token.balanceOf(admin) + await token.balanceOf(userOne)).to.equal(totalSupplyAfterTwo);
            expect(tokenAdminBalanceBeforeTwo - amountToSellTwo).to.equal(tokenAdminBalanceAfterTwo);
            expect(tokenVaultBalanceBeforeTwo + amountToSellTwo).to.equal(tokenVaultBalanceAfterTwo);
            expect(usdtAdminBalanceBeforeTwo + amountToReceiveTwo).to.equal(usdtAdminBalanceAfterTwo);
            expect(usdtVaultBalanceBeforeTwo - amountToReceiveTwo).to.equal(usdtVaultBalanceAfterTwo);
            expect(protocolReserveBeforeTwo + amountToSellTwo).to.equal(protocolReserveAfterTwo);
            expect(depositReserveBeforeTwo - amountToReceiveTwo).to.equal(depositReserveAfterTwo);

            await router.connect(admin).swapExactTokensForTokens(withDecimals("31546.9837"), 0, [token.target, stable.target], admin, 99999999999);

            await pairOne.connect(admin).approve(router.target, await pairOne.balanceOf(admin));

            await router.connect(admin).removeLiquidity(
                token.target,
                stable.target,
                await pairOne.balanceOf(admin),
                0,
                0,
                admin,
                99999999999
            );

            const precomputedPriceThree = await vault.depositReserve() * withDecimals("1") / (await token.totalSupply() - await vault.protocolReserve());
            expect(precomputedPriceThree).to.equal(await vault.getCurrentDisposalPrice());

            const totalSupplyBeforeThree = await token.totalSupply();
            const tokenAdminBalanceBeforeThree = await token.balanceOf(admin);
            const tokenVaultBalanceBeforeThree = await token.balanceOf(vault.target);
            const usdtAdminBalanceBeforeThree = await usdt.balanceOf(admin);
            const usdtVaultBalanceBeforeThree = await usdt.balanceOf(vault.target);
            const protocolReserveBeforeThree = await vault.protocolReserve();
            const depositReserveBeforeThree = await vault.depositReserve();
            const priceBeforeThree = await vault.getCurrentDisposalPrice();

            const amountToSellThree = await token.balanceOf(admin);
            const amountToReceiveThree = await vault.getDisposalAmountOut(amountToSellThree);

            await vault.connect(admin).sellToken(amountToSellThree);

            const precomputedPriceFour = await vault.depositReserve() * withDecimals("1") / (await token.totalSupply() - await vault.protocolReserve());

            const totalSupplyAfterThree = await token.totalSupply();
            const tokenAdminBalanceAfterThree = await token.balanceOf(admin);
            const tokenVaultBalanceAfterThree = await token.balanceOf(vault.target);
            const usdtAdminBalanceAfterThree = await usdt.balanceOf(admin);
            const usdtVaultBalanceAfterThree = await usdt.balanceOf(vault.target);
            const protocolReserveAfterThree = await vault.protocolReserve();
            const depositReserveAfterThree = await vault.depositReserve();
            const priceAfterThree = await vault.getCurrentDisposalPrice();

            expect(priceBeforeThree).to.equal(precomputedPriceThree);
            expect(priceAfterThree).to.equal(precomputedPriceFour);
            expect(totalSupplyBeforeThree).to.equal(totalSupplyAfterThree);
            expect(await token.balanceOf(vault.target) + await token.balanceOf(pairOne.target) + await token.balanceOf(userOne)).to.equal(totalSupplyAfterThree);
            expect(tokenAdminBalanceBeforeThree - amountToSellThree).to.equal(tokenAdminBalanceAfterThree);
            expect(tokenVaultBalanceBeforeThree + amountToSellThree).to.equal(tokenVaultBalanceAfterThree);
            expect(usdtAdminBalanceBeforeThree + amountToReceiveThree).to.equal(usdtAdminBalanceAfterThree);
            expect(usdtVaultBalanceBeforeThree - amountToReceiveThree).to.equal(usdtVaultBalanceAfterThree);
            expect(protocolReserveBeforeThree + amountToSellThree).to.equal(protocolReserveAfterThree);
            expect(depositReserveBeforeThree - amountToReceiveThree).to.equal(depositReserveAfterThree);
            expect(await token.balanceOf(admin)).to.equal(0);

            await token.connect(userOne).approve(vault.target, await token.balanceOf(userOne));

            const totalSupplyBeforeFour = await token.totalSupply();
            const tokenUserOneBalanceBeforeFour = await token.balanceOf(userOne);
            const tokenVaultBalanceBeforeFour = await token.balanceOf(vault.target);
            const usdtUserOneBalanceBeforeFour = await usdt.balanceOf(userOne);
            const usdtVaultBalanceBeforeFour = await usdt.balanceOf(vault.target);
            const protocolReserveBeforeFour = await vault.protocolReserve();
            const depositReserveBeforeFour = await vault.depositReserve();

            const amountToSellFour = await token.balanceOf(userOne);
            const amountToReceiveFour = await vault.getDisposalAmountOut(amountToSellFour);

            await vault.connect(userOne).sellToken(amountToSellFour);

            const precomputedPriceFive = await vault.depositReserve() * withDecimals("1") / (await token.totalSupply() - await vault.protocolReserve());
            expect(precomputedPriceFive).to.equal(withDecimals("1.083333333333333333"));

            const totalSupplyAfterFour = await token.totalSupply();
            const tokenUserOneBalanceAfterFour = await token.balanceOf(userOne);
            const tokenVaultBalanceAfterFour = await token.balanceOf(vault.target);
            const usdtUserOneBalanceAfterFour = await usdt.balanceOf(userOne);
            const usdtVaultBalanceAfterFour = await usdt.balanceOf(vault.target);
            const protocolReserveAfterFour = await vault.protocolReserve();
            const depositReserveAfterFour = await vault.depositReserve();
            const priceAfterFour = await vault.getCurrentDisposalPrice();

            expect(priceAfterFour).to.equal(precomputedPriceFive);
            expect(totalSupplyBeforeFour).to.equal(totalSupplyAfterFour);
            expect(await token.balanceOf(vault.target) + await token.balanceOf(pairOne.target)).to.equal(totalSupplyAfterFour);
            expect(tokenUserOneBalanceBeforeFour - amountToSellFour).to.equal(tokenUserOneBalanceAfterFour);
            expect(tokenVaultBalanceBeforeFour + amountToSellFour).to.equal(tokenVaultBalanceAfterFour);
            expect(usdtUserOneBalanceBeforeFour + amountToReceiveFour).to.equal(usdtUserOneBalanceAfterFour);
            expect(usdtVaultBalanceBeforeFour - amountToReceiveFour).to.equal(usdtVaultBalanceAfterFour);
            expect(protocolReserveBeforeFour + amountToSellFour).to.equal(protocolReserveAfterFour);
            expect(depositReserveBeforeFour - amountToReceiveFour).to.equal(depositReserveAfterFour);
        });
    });

    describe("setProtocolFeeInterest", function () {
        it("Should revert call by not an owner", async () => {
            const { vault, userOne } = await loadFixture(deployVaultFixture);

            await expect(vault.connect(userOne).setProtocolFeeInterest(1)).to.be.
                revertedWithCustomError(vault, "OwnableUnauthorizedAccount").withArgs(userOne);
        });

        it("Should revert call by invalid value", async () => {
            const { vault, admin } = await loadFixture(deployVaultFixture);

            await expect(vault.connect(admin).setProtocolFeeInterest(1001)).to.be.revertedWith(
                "IDPVault: invalid value"
            );

            await expect(vault.connect(admin).setProtocolFeeInterest(2000)).to.be.revertedWith(
                "IDPVault: invalid value"
            );
        });

        it("Should store right value", async () => {
            const { vault, admin } = await loadFixture(deployVaultFixture);

            await vault.connect(admin).setProtocolFeeInterest(999);

            expect(await vault.protocolFeeInterest()).to.equal(999);

            await vault.connect(admin).setProtocolFeeInterest(0);

            expect(await vault.protocolFeeInterest()).to.equal(0);

            await vault.connect(admin).setProtocolFeeInterest(111);

            expect(await vault.protocolFeeInterest()).to.equal(111);

            await vault.connect(admin).setProtocolFeeInterest(333);

            expect(await vault.protocolFeeInterest()).to.equal(333);

            await vault.connect(admin).setProtocolFeeInterest(0);

            expect(await vault.protocolFeeInterest()).to.equal(0);
        });
    });

    describe("setFeeReceiver", function () {
        it("Should revert call by not an owner", async () => {
            const { vault, userOne } = await loadFixture(deployVaultFixture);

            await expect(vault.connect(userOne).setFeeReceiver(userOne)).to.be.
                revertedWithCustomError(vault, "OwnableUnauthorizedAccount").withArgs(userOne);
        });

        it("Should revert call by included address", async () => {
            const { vault, admin } = await loadFixture(deployVaultFixture);

            await vault.connect(admin).setFeeReceiver(admin);

            await expect(vault.connect(admin).setFeeReceiver(admin)).to.be.revertedWith(
                "IDPVault: included"
            );
        });

        it("Should store new address", async () => {
            const { vault, admin } = await loadFixture(deployVaultFixture);

            await vault.connect(admin).setFeeReceiver(admin);

            expect(await vault.feeReceivers(0)).to.equal(admin);
            expect(await vault.feeReceiverExist(admin)).to.equal(true);
        });

        it("Should store second new address", async () => {
            const { vault, admin, userOne } = await loadFixture(deployVaultFixture);

            await vault.connect(admin).setFeeReceiver(admin);
            await vault.connect(admin).setFeeReceiver(userOne);

            expect(await vault.feeReceivers(0)).to.equal(admin);
            expect(await vault.feeReceiverExist(admin)).to.equal(true);

            expect(await vault.feeReceivers(1)).to.equal(userOne);
            expect(await vault.feeReceiverExist(userOne)).to.equal(true);
        });

        it("Should restore after delete", async () => {
            const { vault, admin, userOne, userTwo, userThree } = await loadFixture(deployVaultFixture);

            await vault.connect(admin).setFeeReceiver(admin);
            await vault.connect(admin).setFeeReceiver(userOne);
            await vault.connect(admin).setFeeReceiver(userTwo);

            expect(await vault.feeReceivers(0)).to.equal(admin);
            expect(await vault.feeReceiverExist(admin)).to.equal(true);

            expect(await vault.feeReceivers(1)).to.equal(userOne);
            expect(await vault.feeReceiverExist(userOne)).to.equal(true);

            expect(await vault.feeReceivers(2)).to.equal(userTwo);
            expect(await vault.feeReceiverExist(userTwo)).to.equal(true);

            await vault.connect(admin).deleteFeeReceiver(userOne);

            expect(await vault.feeReceivers(0)).to.equal(admin);
            expect(await vault.feeReceiverExist(admin)).to.equal(true);

            expect(await vault.feeReceivers(1)).to.equal(userTwo);
            expect(await vault.feeReceiverExist(userTwo)).to.equal(true);

            await expect(vault.feeReceivers(2)).to.be.reverted;
            expect(await vault.feeReceiverExist(userOne)).to.equal(false);

            await vault.connect(admin).setFeeReceiver(userThree);

            expect(await vault.feeReceivers(0)).to.equal(admin);
            expect(await vault.feeReceiverExist(admin)).to.equal(true);

            expect(await vault.feeReceivers(1)).to.equal(userTwo);
            expect(await vault.feeReceiverExist(userTwo)).to.equal(true);

            expect(await vault.feeReceivers(2)).to.equal(userThree);
            expect(await vault.feeReceiverExist(userThree)).to.equal(true);

            await expect(vault.feeReceivers(3)).to.be.reverted;
            expect(await vault.feeReceiverExist(userOne)).to.equal(false);

            await vault.connect(admin).setFeeReceiver(userOne);

            expect(await vault.feeReceivers(0)).to.equal(admin);
            expect(await vault.feeReceiverExist(admin)).to.equal(true);

            expect(await vault.feeReceivers(1)).to.equal(userTwo);
            expect(await vault.feeReceiverExist(userTwo)).to.equal(true);

            expect(await vault.feeReceivers(2)).to.equal(userThree);
            expect(await vault.feeReceiverExist(userThree)).to.equal(true);

            expect(await vault.feeReceivers(3)).to.equal(userOne);
            expect(await vault.feeReceiverExist(userOne)).to.equal(true);

            await expect(vault.feeReceivers(4)).to.be.reverted;
        });
    });

    describe("deleteFeeReceiver", function () {
        it("Should revert call by not an owner", async () => {
            const { vault, userOne } = await loadFixture(deployVaultFixture);

            await expect(vault.connect(userOne).deleteFeeReceiver(userOne)).to.be.
                revertedWithCustomError(vault, "OwnableUnauthorizedAccount").withArgs(userOne);
        });

        it("Should revert call by not included address", async () => {
            const { vault, admin } = await loadFixture(deployVaultFixture);

            await expect(vault.connect(admin).deleteFeeReceiver(admin)).to.be.revertedWith(
                "IDPVault: not included"
            );
        });

        it("Should right array restruct", async () => {
            const { vault, admin, userOne, userTwo, userThree } = await loadFixture(deployVaultFixture);

            await vault.connect(admin).setFeeReceiver(admin);
            await vault.connect(admin).setFeeReceiver(userOne);
            await vault.connect(admin).setFeeReceiver(userTwo);

            expect(await vault.feeReceivers(0)).to.equal(admin);
            expect(await vault.feeReceiverExist(admin)).to.equal(true);

            expect(await vault.feeReceivers(1)).to.equal(userOne);
            expect(await vault.feeReceiverExist(userOne)).to.equal(true);

            expect(await vault.feeReceivers(2)).to.equal(userTwo);
            expect(await vault.feeReceiverExist(userTwo)).to.equal(true);

            await vault.connect(admin).deleteFeeReceiver(userOne);

            expect(await vault.feeReceivers(0)).to.equal(admin);
            expect(await vault.feeReceiverExist(admin)).to.equal(true);

            expect(await vault.feeReceivers(1)).to.equal(userTwo);
            expect(await vault.feeReceiverExist(userTwo)).to.equal(true);

            await expect(vault.feeReceivers(2)).to.be.reverted;
            expect(await vault.feeReceiverExist(userOne)).to.equal(false);

            await vault.connect(admin).setFeeReceiver(userThree);

            expect(await vault.feeReceivers(0)).to.equal(admin);
            expect(await vault.feeReceiverExist(admin)).to.equal(true);

            expect(await vault.feeReceivers(1)).to.equal(userTwo);
            expect(await vault.feeReceiverExist(userTwo)).to.equal(true);

            expect(await vault.feeReceivers(2)).to.equal(userThree);
            expect(await vault.feeReceiverExist(userThree)).to.equal(true);

            await expect(vault.feeReceivers(3)).to.be.reverted;
            expect(await vault.feeReceiverExist(userOne)).to.equal(false);

            await vault.connect(admin).setFeeReceiver(userOne);

            expect(await vault.feeReceivers(0)).to.equal(admin);
            expect(await vault.feeReceiverExist(admin)).to.equal(true);

            expect(await vault.feeReceivers(1)).to.equal(userTwo);
            expect(await vault.feeReceiverExist(userTwo)).to.equal(true);

            expect(await vault.feeReceivers(2)).to.equal(userThree);
            expect(await vault.feeReceiverExist(userThree)).to.equal(true);

            expect(await vault.feeReceivers(3)).to.equal(userOne);
            expect(await vault.feeReceiverExist(userOne)).to.equal(true);

            await expect(vault.feeReceivers(4)).to.be.reverted;

            await vault.connect(admin).deleteFeeReceiver(userTwo);

            expect(await vault.feeReceivers(0)).to.equal(admin);
            expect(await vault.feeReceiverExist(admin)).to.equal(true);

            expect(await vault.feeReceivers(1)).to.equal(userOne);
            expect(await vault.feeReceiverExist(userOne)).to.equal(true);

            expect(await vault.feeReceivers(2)).to.equal(userThree);
            expect(await vault.feeReceiverExist(userThree)).to.equal(true);

            await expect(vault.feeReceivers(3)).to.be.reverted;
            expect(await vault.feeReceiverExist(userTwo)).to.equal(false);

            await expect(vault.feeReceivers(4)).to.be.reverted;
        });
    });

    describe("withdrawExcessToken", function () {
        it("Should revert call by not an owner", async () => {
            const { vault, userOne } = await loadFixture(deployVaultFixture);

            await expect(vault.connect(userOne).withdrawExcessToken(userOne, 1, userOne)).to.be.
                revertedWithCustomError(vault, "OwnableUnauthorizedAccount").withArgs(userOne);
        });

        it("Should revert call by zero amount", async () => {
            const { vault, admin } = await loadFixture(deployVaultFixture);

            await expect(vault.connect(admin).withdrawExcessToken(admin, 0, admin)).to.be.revertedWith(
                "IDPVault: invalid amount"
            );
        });

        it("Should revert call by zero receiver address", async () => {
            const { vault, admin, zeroAddress } = await loadFixture(deployVaultFixture);

            await expect(vault.connect(admin).withdrawExcessToken(admin, 1, zeroAddress)).to.be.revertedWith(
                "IDPVault: zero address"
            );
        });

        describe("ether withdraw", function () {
            it("Should revert call by zero eth balance", async () => {
                const { vault, admin, zeroAddress } = await loadFixture(deployVaultFixture);

                await expect(vault.connect(admin).withdrawExcessToken(zeroAddress, 1, admin)).to.be.revertedWith(
                    "IDPVault: ETH transfer failed"
                );
            });

            it("Should revert call by transfer to non receiver", async () => {
                const { vault, admin, zeroAddress, stable } = await loadFixture(deployVaultFixture);

                const amountToTransfer = withDecimals("1");

                await stable.connect(admin).transferEth(vault.target, { value: amountToTransfer });

                expect(await ethers.provider.getBalance(vault.target)).to.equal(amountToTransfer);

                await expect(vault.connect(admin).withdrawExcessToken(zeroAddress, amountToTransfer, vault)).to.be.revertedWith(
                    "IDPVault: ETH transfer failed"
                );
            });

            it("Should pass ether withdraw", async () => {
                const { vault, admin, zeroAddress, stable, userOne } = await loadFixture(deployVaultFixture);

                const amountToTransfer = withDecimals("1");

                await stable.connect(admin).transferEth(vault.target, { value: amountToTransfer });

                expect(await ethers.provider.getBalance(vault.target)).to.equal(amountToTransfer);

                const etherBalanceBefore = await ethers.provider.getBalance(userOne);

                await vault.connect(admin).withdrawExcessToken(zeroAddress, amountToTransfer, userOne);

                const etherBalanceAfter = await ethers.provider.getBalance(userOne);

                expect(etherBalanceBefore + amountToTransfer).to.equal(etherBalanceAfter);

                expect(await ethers.provider.getBalance(vault.target)).to.equal(0);
            });
        });

        describe("external token withdraw", function () {
            it("Should revert call by zero token balance", async () => {
                const { vault, admin, stable } = await loadFixture(deployVaultFixture);

                await expect(vault.connect(admin).withdrawExcessToken(stable, 1, admin)).to.be.
                    revertedWithCustomError(stable, "ERC20InsufficientBalance").withArgs(vault.target, 0, 1);
            });

            it("Should pass token withdraw", async () => {
                const { vault, admin, stable, userOne } = await loadFixture(deployVaultFixture);

                const amountToTransfer = withDecimals("100");

                await stable.connect(admin).transfer(vault.target, amountToTransfer);

                expect(await stable.balanceOf(vault.target)).to.equal(amountToTransfer);

                const stableBalanceBefore = await stable.balanceOf(userOne);

                await vault.connect(admin).withdrawExcessToken(stable.target, amountToTransfer, userOne);

                const stableBalanceAfter = await stable.balanceOf(userOne);

                expect(stableBalanceBefore + amountToTransfer).to.equal(stableBalanceAfter);
                expect(await stable.balanceOf(vault.target)).to.equal(0);
            });
        });

        describe("protocol token withdraw", function () {
            it("Should revert call by zero token balance", async () => {
                const { vault, admin, token } = await loadFixture(deployVaultFixture);

                expect(await token.balanceOf(vault.target)).to.equal(0);

                await expect(vault.connect(admin).withdrawExcessToken(token, 1, admin)).to.be.revertedWith(
                    "IDPVault: excess token absent"
                );
            });

            it("Should revert call by insufficient excess balance", async () => {
                const { vault, admin, token, usdt } = await loadFixture(deployVaultFixture);

                await token.connect(admin).setVault(vault.target);
                await usdt.connect(admin).approve(vault.target, withDecimals("100000000"));
                await vault.connect(admin).buyToken(withDecimals("100"), 0);

                expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999900"));

                await expect(vault.connect(admin).withdrawExcessToken(token, 1, admin)).to.be.revertedWith(
                    "IDPVault: excess token absent"
                );
            });

            it("Should pass excess token withdraw", async () => {
                const { vault, admin, token, userOne } = await loadFixture(deployVaultFixture);

                const amountToTransfer = withDecimals("100");

                await token.connect(admin).setVault(admin);
                await token.connect(admin).mint(vault.target, amountToTransfer);

                expect(await vault.protocolReserve()).to.equal(0);

                expect(await token.balanceOf(vault.target)).to.equal(amountToTransfer);

                const tokenBalanceBefore = await token.balanceOf(userOne);

                await vault.connect(admin).withdrawExcessToken(token.target, amountToTransfer - 1n, userOne);

                const tokenBalanceAfter = await token.balanceOf(userOne);

                expect(tokenBalanceBefore + amountToTransfer - 1n).to.equal(tokenBalanceAfter);
                expect(await token.balanceOf(vault.target)).to.equal(1);
                expect(await vault.protocolReserve()).to.equal(0);
            });

            it("Should pass excess token withdraw after buy", async () => {
                const { vault, admin, token, userOne, usdt } = await loadFixture(deployVaultFixture);

                expect(await vault.protocolReserve()).to.equal(0);

                await token.connect(admin).setVault(vault.target);
                await usdt.connect(admin).approve(vault.target, withDecimals("100000000"));
                await vault.connect(admin).buyToken(withDecimals("100"), 0);

                expect(await vault.protocolReserve()).to.equal(withDecimals("999900"));

                expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999900"));

                await expect(vault.connect(admin).withdrawExcessToken(token, 1, admin)).to.be.revertedWith(
                    "IDPVault: excess token absent"
                );

                const amountToTransfer = withDecimals("100");

                await token.connect(admin).transfer(vault.target, amountToTransfer);

                const tokenBalanceBefore = await token.balanceOf(userOne);

                await vault.connect(admin).withdrawExcessToken(token.target, amountToTransfer - 1n, userOne);

                const tokenBalanceAfter = await token.balanceOf(userOne);

                expect(tokenBalanceBefore + amountToTransfer - 1n).to.equal(tokenBalanceAfter);
                expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999900.000000000000000001"));
                expect(await vault.protocolReserve()).to.equal(withDecimals("999900"));

                await expect(vault.connect(admin).withdrawExcessToken(token.target, 1, admin)).to.be.revertedWith(
                    "IDPVault: excess token absent"
                );
            });
        });

        describe("deposit token withdraw", function () {
            it("Should revert call by zero token balance", async () => {
                const { vault, admin, usdt } = await loadFixture(deployVaultFixture);

                expect(await usdt.balanceOf(vault.target)).to.equal(0);

                await expect(vault.connect(admin).withdrawExcessToken(usdt, 1, admin)).to.be.revertedWith(
                    "IDPVault: excess token absent"
                );
            });

            it("Should revert call by insufficient excess balance", async () => {
                const { vault, admin, token, usdt } = await loadFixture(deployVaultFixture);

                await token.connect(admin).setVault(vault.target);
                await usdt.connect(admin).approve(vault.target, withDecimals("100000000"));
                await vault.connect(admin).buyToken(withDecimals("100"), 0);

                expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999900"));
                expect(await usdt.balanceOf(vault.target)).to.equal(withDecimals("100"));

                await expect(vault.connect(admin).withdrawExcessToken(usdt, 1, admin)).to.be.revertedWith(
                    "IDPVault: excess token absent"
                );
            });

            it("Should pass excess token withdraw", async () => {
                const { vault, admin, usdt, userOne } = await loadFixture(deployVaultFixture);

                const amountToTransfer = withDecimals("100");

                await usdt.connect(admin).transfer(vault.target, amountToTransfer);

                expect(await vault.depositReserve()).to.equal(0);

                expect(await usdt.balanceOf(vault.target)).to.equal(amountToTransfer);

                const usdtBalanceBefore = await usdt.balanceOf(userOne);

                await vault.connect(admin).withdrawExcessToken(usdt.target, amountToTransfer - 1n, userOne);

                const usdtBalanceAfter = await usdt.balanceOf(userOne);

                expect(usdtBalanceBefore + amountToTransfer - 1n).to.equal(usdtBalanceAfter);
                expect(await usdt.balanceOf(vault.target)).to.equal(1);
                expect(await vault.depositReserve()).to.equal(0);
            });

            it("Should pass excess token withdraw after buy", async () => {
                const { vault, admin, token, userOne, usdt } = await loadFixture(deployVaultFixture);

                const amountToTransfer = withDecimals("100");

                expect(await vault.depositReserve()).to.equal(0);

                await token.connect(admin).setVault(vault.target);
                await usdt.connect(admin).approve(vault.target, withDecimals("100000000"));
                await vault.connect(admin).buyToken(amountToTransfer, 0);

                expect(await vault.depositReserve()).to.equal(amountToTransfer);
                expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999900"));
                expect(await usdt.balanceOf(vault.target)).to.equal(amountToTransfer);

                await expect(vault.connect(admin).withdrawExcessToken(usdt.target, 1, admin)).to.be.revertedWith(
                    "IDPVault: excess token absent"
                );

                await usdt.connect(admin).transfer(vault.target, amountToTransfer);

                const usdtBalanceBefore = await usdt.balanceOf(userOne);

                await vault.connect(admin).withdrawExcessToken(usdt.target, amountToTransfer - 1n, userOne);

                const usdtBalanceAfter = await usdt.balanceOf(userOne);

                expect(usdtBalanceBefore + amountToTransfer - 1n).to.equal(usdtBalanceAfter);
                expect(await usdt.balanceOf(vault.target)).to.equal(withDecimals("100.000000000000000001"));
                expect(await vault.depositReserve()).to.equal(amountToTransfer);

                await expect(vault.connect(admin).withdrawExcessToken(usdt.target, 1, admin)).to.be.revertedWith(
                    "IDPVault: excess token absent"
                );
            });
        });
    });

    describe("distributeFee", function () {
        it("Should revert call by zero amount", async () => {
            const { vault, userOne } = await loadFixture(deployVaultFixture);

            await expect(vault.connect(userOne).distributeFee(0, 1)).to.be.revertedWith(
                "IDPVault: invalid feeAmount"
            );
        });

        it("Should revert call by vaultFeeInterest exceeded", async () => {
            const { vault, userOne } = await loadFixture(deployVaultFixture);

            await expect(vault.connect(userOne).distributeFee(1, 1000001)).to.be.revertedWith(
                "IDPVault: invalid vaultFeeInterest"
            );
        });

        it("Should revert call by fee tokens absent", async () => {
            const { vault, userOne } = await loadFixture(deployVaultFixture);

            await expect(vault.connect(userOne).distributeFee(1, 0)).to.be.revertedWith(
                "IDPVault: invalid balance"
            );
        });

        it("Should revert call by fee tokens absent after buy", async () => {
            const { vault, admin, userOne, token, usdt } = await loadFixture(deployVaultFixture);

            await token.connect(admin).setVault(vault.target);
            await usdt.connect(admin).approve(vault.target, withDecimals("100000000"));
            await vault.connect(admin).buyToken(withDecimals("100"), 0);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999900"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999900"));

            await expect(vault.connect(userOne).distributeFee(1, 0)).to.be.revertedWith(
                "IDPVault: invalid balance"
            );
        });

        it("Should pass call without feeReceivers 0% feeInterest", async () => {
            const { vault, admin, userOne, token, usdt } = await loadFixture(deployVaultFixture);

            await token.connect(admin).setVault(vault.target);
            await usdt.connect(admin).approve(vault.target, withDecimals("100000000"));
            await vault.connect(admin).buyToken(withDecimals("100"), 0);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999900"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999900"));

            const amountToTransfer = withDecimals("10");

            await token.connect(admin).transfer(vault.target, amountToTransfer);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999910"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999900"));

            await vault.connect(userOne).distributeFee(amountToTransfer, 0);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999910"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999910"));
        });

        it("Should pass call without feeReceivers 10% feeInterest", async () => {
            const { vault, admin, userOne, token, usdt } = await loadFixture(deployVaultFixture);

            await token.connect(admin).setVault(vault.target);
            await usdt.connect(admin).approve(vault.target, withDecimals("100000000"));
            await vault.connect(admin).buyToken(withDecimals("100"), 0);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999900"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999900"));

            const amountToTransfer = withDecimals("10");

            await token.connect(admin).transfer(vault.target, amountToTransfer);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999910"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999900"));

            await vault.connect(userOne).distributeFee(amountToTransfer, 100000);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999910"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999910"));
        });

        it("Should pass call without feeReceivers 100% feeInterest", async () => {
            const { vault, admin, userOne, token, usdt } = await loadFixture(deployVaultFixture);

            await token.connect(admin).setVault(vault.target);
            await usdt.connect(admin).approve(vault.target, withDecimals("100000000"));
            await vault.connect(admin).buyToken(withDecimals("100"), 0);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999900"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999900"));

            const amountToTransfer = withDecimals("10");

            await token.connect(admin).transfer(vault.target, amountToTransfer);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999910"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999900"));

            await vault.connect(userOne).distributeFee(amountToTransfer, 1000000);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999910"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999910"));
        });

        it("Should pass call with feeReceivers 0% feeInterest", async () => {
            const { vault, admin, userOne, token, usdt } = await loadFixture(deployVaultFixture);

            await token.connect(admin).setVault(vault.target);
            await usdt.connect(admin).approve(vault.target, withDecimals("100000000"));
            await vault.connect(admin).buyToken(withDecimals("100"), 0);
            await vault.connect(admin).setFeeReceiver(admin);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999900"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999900"));

            const amountToTransfer = withDecimals("10");

            await token.connect(admin).transfer(vault.target, amountToTransfer);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999910"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999900"));

            const feeReceiverBalanceBefore = await token.balanceOf(admin);

            await vault.connect(userOne).distributeFee(amountToTransfer, 0);

            const feeReceiverBalanceAfter = await token.balanceOf(admin);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999900"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999900"));

            expect(feeReceiverBalanceBefore + withDecimals("10")).to.equal(feeReceiverBalanceAfter);
        });

        it("Should pass call with feeReceivers 10% feeInterest", async () => {
            const { vault, admin, userOne, token, usdt } = await loadFixture(deployVaultFixture);

            await token.connect(admin).setVault(vault.target);
            await usdt.connect(admin).approve(vault.target, withDecimals("100000000"));
            await vault.connect(admin).buyToken(withDecimals("100"), 0);
            await vault.connect(admin).setFeeReceiver(admin);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999900"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999900"));

            const amountToTransfer = withDecimals("10");

            await token.connect(admin).transfer(vault.target, amountToTransfer);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999910"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999900"));

            const feeReceiverBalanceBefore = await token.balanceOf(admin);

            await vault.connect(userOne).distributeFee(amountToTransfer, 100000);

            const feeReceiverBalanceAfter = await token.balanceOf(admin);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999901"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999901"));

            expect(feeReceiverBalanceBefore + withDecimals("9")).to.equal(feeReceiverBalanceAfter);
        });

        it("Should pass call with feeReceivers 100% feeInterest", async () => {
            const { vault, admin, userOne, token, usdt } = await loadFixture(deployVaultFixture);

            await token.connect(admin).setVault(vault.target);
            await usdt.connect(admin).approve(vault.target, withDecimals("100000000"));
            await vault.connect(admin).buyToken(withDecimals("100"), 0);
            await vault.connect(admin).setFeeReceiver(admin);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999900"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999900"));

            const amountToTransfer = withDecimals("10");

            await token.connect(admin).transfer(vault.target, amountToTransfer);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999910"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999900"));

            const feeReceiverBalanceBefore = await token.balanceOf(admin);

            await vault.connect(userOne).distributeFee(amountToTransfer, 1000000);

            const feeReceiverBalanceAfter = await token.balanceOf(admin);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999910"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999910"));

            expect(feeReceiverBalanceBefore).to.equal(feeReceiverBalanceAfter);
        });

        it("Should pass with right calculations", async () => {
            const { vault, admin, userOne, userTwo, userThree, token, usdt } = await loadFixture(deployVaultFixture);

            await token.connect(admin).setVault(vault.target);
            await usdt.connect(admin).approve(vault.target, withDecimals("100000000"));
            await vault.connect(admin).buyToken(withDecimals("100"), 0);
            await vault.connect(admin).setFeeReceiver(userTwo);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999900"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999900"));

            const amountToTransfer = withDecimals("10");

            await token.connect(admin).transfer(vault.target, amountToTransfer);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999910"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999900"));

            await vault.connect(userOne).distributeFee(amountToTransfer, 100000);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999901"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999901"));
            expect(await token.balanceOf(userTwo)).to.equal(withDecimals("9"));

            await token.connect(admin).transfer(vault.target, amountToTransfer);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999911"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999901"));

            await vault.connect(userOne).distributeFee(amountToTransfer, 100000);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999902"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999902"));
            expect(await token.balanceOf(userTwo)).to.equal(withDecimals("18"));

            await vault.connect(admin).setFeeReceiver(userThree);

            await token.connect(admin).transfer(vault.target, amountToTransfer);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999912"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999902"));

            await vault.connect(userOne).distributeFee(amountToTransfer, 100000);

            expect(await token.balanceOf(vault.target)).to.equal(withDecimals("999903"));
            expect(await vault.protocolReserve()).to.equal(withDecimals("999903"));
            expect(await token.balanceOf(userTwo)).to.equal(withDecimals("22.5"));
            expect(await token.balanceOf(userThree)).to.equal(withDecimals("4.5"));
        });
    });

    describe("renounceOwnership", function () {
        it("Should revert call by not an owner", async () => {
            const { vault, userOne } = await loadFixture(deployVaultFixture);

            await expect(vault.connect(userOne).renounceOwnership()).to.be.
                revertedWithCustomError(vault, "OwnableUnauthorizedAccount").withArgs(userOne);
        });

        it("Should revert call by an owner", async () => {
            const { vault, admin } = await loadFixture(deployVaultFixture);

            await expect(vault.connect(admin).renounceOwnership()).to.be.reverted;
        });
    });

    describe("getFeeReceiversLength", function () {
        it("Should return right value", async () => {
            const { vault, admin, userOne, userTwo, userThree } = await loadFixture(deployVaultFixture);

            expect(await vault.getFeeReceiversLength()).to.equal(0);

            await vault.connect(admin).setFeeReceiver(admin);

            expect(await vault.getFeeReceiversLength()).to.equal(1);

            await vault.connect(admin).setFeeReceiver(userOne);

            expect(await vault.getFeeReceiversLength()).to.equal(2);

            await vault.connect(admin).setFeeReceiver(userTwo);

            expect(await vault.getFeeReceiversLength()).to.equal(3);

            expect(await vault.feeReceivers(0)).to.equal(admin);
            expect(await vault.feeReceiverExist(admin)).to.equal(true);

            expect(await vault.feeReceivers(1)).to.equal(userOne);
            expect(await vault.feeReceiverExist(userOne)).to.equal(true);

            expect(await vault.feeReceivers(2)).to.equal(userTwo);
            expect(await vault.feeReceiverExist(userTwo)).to.equal(true);

            await vault.connect(admin).deleteFeeReceiver(userOne);

            expect(await vault.getFeeReceiversLength()).to.equal(2);

            expect(await vault.feeReceivers(0)).to.equal(admin);
            expect(await vault.feeReceiverExist(admin)).to.equal(true);

            expect(await vault.feeReceivers(1)).to.equal(userTwo);
            expect(await vault.feeReceiverExist(userTwo)).to.equal(true);

            await expect(vault.feeReceivers(2)).to.be.reverted;
            expect(await vault.feeReceiverExist(userOne)).to.equal(false);

            await vault.connect(admin).setFeeReceiver(userThree);

            expect(await vault.getFeeReceiversLength()).to.equal(3);

            expect(await vault.feeReceivers(0)).to.equal(admin);
            expect(await vault.feeReceiverExist(admin)).to.equal(true);

            expect(await vault.feeReceivers(1)).to.equal(userTwo);
            expect(await vault.feeReceiverExist(userTwo)).to.equal(true);

            expect(await vault.feeReceivers(2)).to.equal(userThree);
            expect(await vault.feeReceiverExist(userThree)).to.equal(true);

            await expect(vault.feeReceivers(3)).to.be.reverted;
            expect(await vault.feeReceiverExist(userOne)).to.equal(false);

            await vault.connect(admin).setFeeReceiver(userOne);

            expect(await vault.getFeeReceiversLength()).to.equal(4);

            expect(await vault.feeReceivers(0)).to.equal(admin);
            expect(await vault.feeReceiverExist(admin)).to.equal(true);

            expect(await vault.feeReceivers(1)).to.equal(userTwo);
            expect(await vault.feeReceiverExist(userTwo)).to.equal(true);

            expect(await vault.feeReceivers(2)).to.equal(userThree);
            expect(await vault.feeReceiverExist(userThree)).to.equal(true);

            expect(await vault.feeReceivers(3)).to.equal(userOne);
            expect(await vault.feeReceiverExist(userOne)).to.equal(true);

            await expect(vault.feeReceivers(4)).to.be.reverted;

            await vault.connect(admin).deleteFeeReceiver(userTwo);

            expect(await vault.getFeeReceiversLength()).to.equal(3);

            expect(await vault.feeReceivers(0)).to.equal(admin);
            expect(await vault.feeReceiverExist(admin)).to.equal(true);

            expect(await vault.feeReceivers(1)).to.equal(userOne);
            expect(await vault.feeReceiverExist(userOne)).to.equal(true);

            expect(await vault.feeReceivers(2)).to.equal(userThree);
            expect(await vault.feeReceiverExist(userThree)).to.equal(true);

            await expect(vault.feeReceivers(3)).to.be.reverted;
            expect(await vault.feeReceiverExist(userTwo)).to.equal(false);
        });
    });

    describe("getCurrentDisposalPrice", function () {
        it("Should return default value before update", async () => {
            const { vault, token, admin } = await loadFixture(deployVaultFixture);

            expect(await vault.getCurrentDisposalPrice()).to.equal(withDecimals("1"));

            await token.connect(admin).setVault(admin);

            await token.connect(admin).mint(admin, withDecimals("10000000"));

            expect(await vault.getCurrentDisposalPrice()).to.equal(withDecimals("1"));
        });

        it("Should return right value", async () => {
            const { vault, token, usdt, admin, userOne, stable, router } = await loadFixture(deployVaultFixture);

            await token.connect(admin).setVault(vault.target);
            await usdt.connect(admin).approve(vault.target, withDecimals("10000000000"));
            await vault.connect(admin).buyToken(withDecimals("1000000"), 0);

            expect(await vault.getCurrentDisposalPrice()).to.equal(withDecimals("1"));

            await vault.connect(admin).setFeeReceiver(userOne);

            await vault.connect(admin).buyToken(withDecimals("101"), 0);

            expect(await vault.getCurrentDisposalPrice()).to.equal(withDecimals("1"));

            await token.connect(admin).approve(router.target, withDecimals("100000000"));
            await stable.connect(admin).approve(router.target, withDecimals("1000000000"));

            await router.connect(admin).addLiquidity(
                token.target,
                stable.target,
                withDecimals("78978"),
                withDecimals("98735"),
                0,
                0,
                admin,
                99999999999,
                true
            );

            expect(await vault.depositReserve() * withDecimals("1") / (await token.totalSupply() - await vault.protocolReserve())).to.equal(withDecimals("1"));
            expect(await vault.getCurrentDisposalPrice()).to.equal(withDecimals("1"));

            await router.connect(admin).swapExactTokensForTokens(withDecimals("23546"), 0, [stable.target, token.target], admin, 99999999999);

            expect(await vault.getCurrentDisposalPrice()).to.equal(withDecimals("1.000000188283012699"));
        });
    });

    describe("getAmountIn", function () {
        it("Should return default value without feeReceivers", async () => {
            const { vault } = await loadFixture(deployVaultFixture);

            expect(await vault.getAmountIn(withDecimals("1"))).to.equal(withDecimals("1"));

            expect(await vault.getAmountIn(withDecimals("6546756"))).to.equal(withDecimals("6546756"));

            expect(await vault.getAmountIn(withDecimals("1232343"))).to.equal(withDecimals("1232343"));

            expect(await vault.getAmountIn(withDecimals("12378.9878876"))).to.equal(withDecimals("12378.9878876"));

            expect(await vault.getAmountIn(withDecimals("0.76111"))).to.equal(withDecimals("0.76111"));
        });

        it("Should return right value with feeReceivers", async () => {
            const { vault, token, admin, usdt, userOne } = await loadFixture(deployVaultFixture);

            expect(await vault.getAmountIn(withDecimals("1"))).to.equal(withDecimals("1"));

            await token.connect(admin).setVault(vault.target);
            await usdt.connect(admin).approve(vault.target, withDecimals("10000000000"));
            await vault.connect(admin).buyToken(withDecimals("1000000"), 0);
            await vault.connect(admin).setFeeReceiver(userOne);

            expect(await vault.getAmountIn(withDecimals("100"))).to.equal(withDecimals("100.100100100100100100"));
            const amountOut = await vault.getAmountOut(withDecimals("100.100100100100100100"));
            expect(amountOut[0]).to.equal(withDecimals("100"));
            expect(amountOut[1]).to.equal(withDecimals("0.100100100100100100"));
        });

        it("Should return right value with feeReceivers after fee change", async () => {
            const { vault, token, admin, usdt, userOne } = await loadFixture(deployVaultFixture);

            expect(await vault.getAmountIn(withDecimals("1"))).to.equal(withDecimals("1"));

            await token.connect(admin).setVault(vault.target);
            await usdt.connect(admin).approve(vault.target, withDecimals("10000000000"));
            await vault.connect(admin).buyToken(withDecimals("1000000"), 0);
            await vault.connect(admin).setFeeReceiver(userOne);
            await vault.connect(admin).setProtocolFeeInterest(500);

            expect(await vault.getAmountIn(withDecimals("100"))).to.equal(withDecimals("100.050025012506253126"));
            const amountOut = await vault.getAmountOut(withDecimals("100.050025012506253126"));
            expect(amountOut[0]).to.equal(withDecimals("100"));
            expect(amountOut[1]).to.equal(withDecimals("0.050025012506253126"));
        });
    });

    describe("getAmountOut", function () {
        it("Should return default value without feeReceivers", async () => {
            const { vault } = await loadFixture(deployVaultFixture);

            const amountOutOne = await vault.getAmountOut(withDecimals("1"));

            expect(amountOutOne[0]).to.equal(withDecimals("1"));
            expect(amountOutOne[1]).to.equal(0);

            const amountOutTwo = await vault.getAmountOut(withDecimals("789.0933"));

            expect(amountOutTwo[0]).to.equal(withDecimals("789.0933"));
            expect(amountOutTwo[1]).to.equal(0);

            const amountOutThree = await vault.getAmountOut(withDecimals("1234567.2130796"));

            expect(amountOutThree[0]).to.equal(withDecimals("1234567.2130796"));
            expect(amountOutThree[1]).to.equal(0);

            const amountOutFour = await vault.getAmountOut(withDecimals("0.98737"));

            expect(amountOutFour[0]).to.equal(withDecimals("0.98737"));
            expect(amountOutFour[1]).to.equal(0);
        });

        it("Should return right value with feeReceivers", async () => {
            const { vault, token, admin, usdt, userOne } = await loadFixture(deployVaultFixture);

            await token.connect(admin).setVault(vault.target);
            await usdt.connect(admin).approve(vault.target, withDecimals("10000000000"));
            await vault.connect(admin).buyToken(withDecimals("1000000"), 0);
            await vault.connect(admin).setFeeReceiver(userOne);

            const amountOut = await vault.getAmountOut(withDecimals("333"));
            expect(amountOut[0]).to.equal(withDecimals("332.667"));
            expect(amountOut[1]).to.equal(withDecimals("0.333"));
        });

        it("Should return right value with feeReceivers after fee change", async () => {
            const { vault, token, admin, usdt, userOne } = await loadFixture(deployVaultFixture);

            await token.connect(admin).setVault(vault.target);
            await usdt.connect(admin).approve(vault.target, withDecimals("10000000000"));
            await vault.connect(admin).buyToken(withDecimals("1000000"), 0);
            await vault.connect(admin).setFeeReceiver(userOne);
            await vault.connect(admin).setProtocolFeeInterest(500);

            const amountOut = await vault.getAmountOut(withDecimals("99.777"));
            expect(amountOut[0]).to.equal(withDecimals("99.7271115"));
            expect(amountOut[1]).to.equal(withDecimals("0.0498885"));
        });
    });

    describe("getDisposalAmountOut", function () {
        it("Should return default value before update", async () => {
            const { vault, token, admin } = await loadFixture(deployVaultFixture);

            expect(await vault.getCurrentDisposalPrice()).to.equal(withDecimals("1"));
            expect(await vault.getDisposalAmountOut(withDecimals("1"))).to.equal(withDecimals("1"));
            expect(await vault.getDisposalAmountOut(withDecimals("12356.903"))).to.equal(withDecimals("12356.903"));
            expect(await vault.getDisposalAmountOut(withDecimals("0.97866"))).to.equal(withDecimals("0.97866"));

            await token.connect(admin).setVault(admin);

            await token.connect(admin).mint(admin, withDecimals("10000000"));

            expect(await vault.getCurrentDisposalPrice()).to.equal(withDecimals("1"));
            expect(await vault.getDisposalAmountOut(withDecimals("1"))).to.equal(withDecimals("1"));
            expect(await vault.getDisposalAmountOut(withDecimals("12356.903"))).to.equal(withDecimals("12356.903"));
            expect(await vault.getDisposalAmountOut(withDecimals("0.97866"))).to.equal(withDecimals("0.97866"));
        });

        it("Should return right value", async () => {
            const { vault, token, usdt, admin, userOne, stable, router } = await loadFixture(deployVaultFixture);

            await token.connect(admin).setVault(vault.target);
            await usdt.connect(admin).approve(vault.target, withDecimals("10000000000"));
            await vault.connect(admin).buyToken(withDecimals("1000000"), 0);

            expect(await vault.getCurrentDisposalPrice()).to.equal(withDecimals("1"));
            expect(await vault.getDisposalAmountOut(withDecimals("1156.973"))).to.equal(withDecimals("1156.973"));

            await vault.connect(admin).setFeeReceiver(userOne);
            await vault.connect(admin).buyToken(withDecimals("101"), 0);

            expect(await vault.getCurrentDisposalPrice()).to.equal(withDecimals("1"));
            expect(await vault.getDisposalAmountOut(withDecimals("1156.973"))).to.equal(withDecimals("1156.973"));

            await token.connect(admin).approve(router.target, withDecimals("100000000"));
            await stable.connect(admin).approve(router.target, withDecimals("1000000000"));

            await router.connect(admin).addLiquidity(
                token.target,
                stable.target,
                withDecimals("78978"),
                withDecimals("98735"),
                0,
                0,
                admin,
                99999999999,
                true
            );

            expect(await vault.depositReserve() * withDecimals("1") / (await token.totalSupply() - await vault.protocolReserve())).to.equal(withDecimals("1"));
            expect(await vault.getCurrentDisposalPrice()).to.equal(withDecimals("1"));

            await router.connect(admin).swapExactTokensForTokens(withDecimals("23546"), 0, [stable.target, token.target], admin, 99999999999);

            expect(await vault.getCurrentDisposalPrice()).to.equal(withDecimals("1.000000188283012699"));
            expect(await vault.getDisposalAmountOut(withDecimals("116.973"))).to.equal(withDecimals("116.973022024028844440"));
        });
    });
});