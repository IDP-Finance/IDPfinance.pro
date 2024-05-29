const hre = require("hardhat");
const ethers = hre.ethers;

const {
    ADMIN,
    IDP_TOKEN,
    VAULT,
    ORACLE
} = process.env;

async function main() {

    const IDPLottery = await ethers.getContractFactory("IDPLottery");
    const lottery = await IDPLottery.deploy(ADMIN, IDP_TOKEN, VAULT, ORACLE);
    await lottery.waitForDeployment();

    console.log("IDP Lottery deployed, address: ", lottery.target);

    await new Promise(x => setTimeout(x, 30000));
    await verify(lottery, [ADMIN, IDP_TOKEN, VAULT, ORACLE]);

    console.log("Have to set IDPLottery address to IDPOracle, address: ", lottery.target);
    console.log("Have to set SwapConfig to IDPLottery, address: ", lottery.target);
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