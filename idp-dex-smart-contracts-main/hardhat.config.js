require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");
require('dotenv').config();

const {
    PRIVATE_KEY,
    BSC_API_KEY
} = process.env;

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {},
        bsc: {
            url: "https://bsc.publicnode.com",
            chainId: 56,
            gasPrice: 3000000000,
            accounts: [PRIVATE_KEY],
        },
        bscTestnet: {
            url: "https://bsc-testnet.blockpi.network/v1/rpc/public",
            chainId: 97,
            gasPrice: 10000000000,
            accounts: [PRIVATE_KEY],
        }
    },

    etherscan: {
        apiKey: {
            bsc: BSC_API_KEY,
            bscTestnet: BSC_API_KEY
        }
    },

    gasReporter: {
        enabled: false,
    },

    contractSizer: {
        alphaSort: false,
        disambiguatePaths: false,
        runOnCompile: false,
        strict: false,
        only: [],
    },

    solidity: {
        compilers: [
            {
                version: "0.8.23",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 99999,
                    },
                },
            },
        ],

        overrides: {
            "contracts/periphery/IDPRouter.sol": {
                version: "0.6.6",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 500,
                    },
                },
            },
            "contracts/interfaces/IIDPRouter.sol": {
                version: "0.6.6",
            },
            "contracts/interfaces/IIDPVault.sol": {
                version: "0.6.6",
            },
            "contracts/libraries/TransferHelper.sol": {
                version: "0.6.6",
            },
            "contracts/core/IDPERC20.sol": {
                version: "0.5.16",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 99999,
                    },
                },
            },
            "contracts/core/IDPPair.sol": {
                version: "0.5.16",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 99999,
                    },
                },
            },
            "contracts/core/IDPFactory.sol": {
                version: "0.5.16",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 99999,
                    },
                },
            },
            "contracts/libraries/UQ112x112.sol": {
                version: "0.5.16",
            },
            "contracts/libraries/Math.sol": {
                version: "0.5.16",
            },
            "contracts/mock/USDT.sol": {
                version: "0.5.16",
            },
            "contracts/libraries/IDPLibrary.sol": {
                version: "0.5.16",
            },
            "contracts/libraries/Ownable2Step.sol": {
                version: "0.5.16",
            },
            "contracts/libraries/FeeConfigLibrary.sol": {
                version: "0.5.16",
            },
            "contracts/mock/WBNB.sol": {
                version: "0.4.18",
            }
        },
    },
}