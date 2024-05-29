const hre = require("hardhat");
const ethers = hre.ethers;

const { } = process.env;

async function main() {

    const BEP20USDT = await ethers.getContractFactory("BEP20USDT");
    const usdt = await BEP20USDT.deploy();
    await usdt.waitForDeployment();

    console.log("Test USDT Token deployed, address: ", usdt.target);

    await new Promise(x => setTimeout(x, 30000));
    await verify(usdt, []);
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