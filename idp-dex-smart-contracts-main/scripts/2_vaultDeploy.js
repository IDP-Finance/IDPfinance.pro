const hre = require("hardhat");
const ethers = hre.ethers;

const {
    ADMIN,
    IDP_TOKEN,
    USDT
} = process.env;

async function main() {

    const IDPVault = await ethers.getContractFactory("IDPVault");
    const vault = await IDPVault.deploy(ADMIN, IDP_TOKEN, USDT);
    await vault.waitForDeployment();

    console.log("IDP Vault deployed, address: ", vault.target);

    await new Promise(x => setTimeout(x, 30000));
    await verify(vault, [ADMIN, IDP_TOKEN, USDT]);

    console.log("Have to set IDPVault address to IDPToken, address: ", vault.target);
    console.log("Have to set feeReceivers to IDPVault, address: ", vault.target);
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