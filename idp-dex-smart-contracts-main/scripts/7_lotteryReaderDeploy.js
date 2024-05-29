const hre = require("hardhat");
const ethers = hre.ethers;

const {
    LOTTERY,
    ORACLE
} = process.env;

async function main() {

    const IDPLotteryReader = await ethers.getContractFactory("IDPLotteryReader");
    const lotteryReader = await IDPLotteryReader.deploy(LOTTERY, ORACLE);
    await lotteryReader.waitForDeployment();

    console.log("IDP Lottery Reader deployed, address: ", lotteryReader.target);

    await new Promise(x => setTimeout(x, 30000));
    await verify(lotteryReader, [LOTTERY, ORACLE]);
}

async function verify(contract, constructorArguments) {
    await hre.run("verify:verify", {
        address: contract.target,
        constructorArguments: constructorArguments
    })
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});