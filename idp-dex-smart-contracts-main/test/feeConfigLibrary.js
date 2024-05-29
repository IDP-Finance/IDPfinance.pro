const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const helpers = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

describe("FeeConfigLibrary", function () {
    async function deployFeeConfigLibraryFixture() {

        const [admin] = await ethers.getSigners();

        const FeeConfigLibraryTest = await ethers.getContractFactory("FeeConfigLibraryTest", admin);
        const lib = await FeeConfigLibraryTest.deploy();
        await lib.waitForDeployment();

        return { lib };
    };

    describe("Main", function () {
        it("Should return right fee values", async function () {
            const { lib } = await loadFixture(deployFeeConfigLibraryFixture);

            expect(await lib.getLibraryFee(false)).to.equal(9980);
            expect(await lib.getLibraryFee(true)).to.equal(9998);
            expect(await lib.getLibraryPairFee(false)).to.equal(1);
            expect(await lib.getLibraryPairFee(true)).to.equal(10);
        });
    });
});
