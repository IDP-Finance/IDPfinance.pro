const hre = require("hardhat");
const ethers = hre.ethers;

const {
    ADMIN,
    FACTORY,
    WBNB,
    VAULT,
    IDP_TOKEN
} = process.env;

async function main() {

    const IDPRouter = await ethers.getContractFactory("IDPRouter");
    const router = await IDPRouter.deploy(ADMIN, FACTORY, WBNB, VAULT, IDP_TOKEN);
    await router.waitForDeployment();

    console.log("IDP Router deployed, address: ", router.target);

    await new Promise(x => setTimeout(x, 30000));
    await verify(router, [ADMIN, FACTORY, WBNB, VAULT, IDP_TOKEN]);

    console.log("Have to set IDPRouter address to IDPFactory address: ", router.target);
    console.log("Have to set Mainnet config to IDPOracle");
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