const hre = require("hardhat");
const ethers = hre.ethers;

const {
    ADMIN
} = process.env;

async function main() {

    const IDPToken = await ethers.getContractFactory("IDPToken");
    const token = await IDPToken.deploy(ADMIN);
    await token.waitForDeployment();

    console.log("IDP Token deployed, address: ", token.target);

    await new Promise(x => setTimeout(x, 30000));
    await verify(token, [ADMIN]);
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