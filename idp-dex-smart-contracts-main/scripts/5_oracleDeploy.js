const hre = require("hardhat");
const ethers = hre.ethers;

const {
    ADMIN,
    COODRINATOR,
    SUBSCRIPTION_ID
} = process.env;

async function main() {

    const IDPOracle = await ethers.getContractFactory("IDPOracle");
    const oracle = await IDPOracle.deploy(ADMIN, COODRINATOR, SUBSCRIPTION_ID);
    await oracle.waitForDeployment();

    console.log("IDP Oracle deployed, address: ", oracle.target);

    await new Promise(x => setTimeout(x, 30000));
    await verify(oracle, [ADMIN, COODRINATOR, SUBSCRIPTION_ID]);

    console.log("Have to add IDPOracle address to subscription, address: ", oracle.target);
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