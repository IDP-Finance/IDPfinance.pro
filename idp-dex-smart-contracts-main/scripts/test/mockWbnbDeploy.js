const hre = require("hardhat");
const ethers = hre.ethers;

const { } = process.env;

async function main() {

    const WBNB = await ethers.getContractFactory("WBNB");
    const wbnb = await WBNB.deploy();
    await wbnb.waitForDeployment();

    console.log("Test WBNB Token deployed, address: ", wbnb.target);

    await new Promise(x => setTimeout(x, 30000));
    await verify(wbnb, []);
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