const hre = require("hardhat");
const ethers = hre.ethers;

const {
    ADMIN,
    IDP_TOKEN
} = process.env;

async function main() {

    const IDPFactory = await ethers.getContractFactory("IDPFactory");
    const factory = await IDPFactory.deploy(ADMIN, IDP_TOKEN);
    await factory.waitForDeployment();

    console.log("IDP Factory deployed, address: ", factory.target);
    
    await new Promise(x => setTimeout(x, 30000));
    await verify(factory, [ADMIN, IDP_TOKEN]);

    console.log("INIT_CODE_HASH");
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