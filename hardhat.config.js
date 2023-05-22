/**
* @type import('hardhat/config').HardhatUserConfig
*/
const dot = require('dotenv').config();
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-web3");
//require("@nomiclabs/hardhat-waffle");
require("@nomicfoundation/hardhat-chai-matchers");
const { API_URL_GOERLI, API_URL_OPTIGOERLI, API_URL_ARBIGOERLI, PRIVATE_KEY, ETHERSCAN_API_KEY, OPTISCAN_API_KEY, ARBISCAN_API_KEY } = process.env;

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.9",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000
          }
        }
      },
      {
        version: "0.8.2",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000
          }
        }
      }
    ] 
},
  defaultNetwork: "goerli",
  networks: {
    hardhat: {
      accounts: [{ privateKey: `0x${PRIVATE_KEY}`, balance: "10000000000000000000000"}],
      forking: {
        url: API_URL_GOERLI,
        blockNumber: 8717392
      },
      loggingEnabled: true,
      gasMultiplier: 10,
      gasPrice: 1000000000 * 500,
      blockGasLimit: 0x1fffffffffffff
    },
    goerli: {
      url: API_URL_GOERLI,
      accounts: [`0x${PRIVATE_KEY}`],
      gasMultiplier: 10,
      gasPrice: 1000000000 * 50,
      blockGasLimit: 0x1fffffffffffff
    },
    arbitrumGoerli: {
      url: API_URL_ARBIGOERLI,
      accounts: [`0x${PRIVATE_KEY}`],
      gasMultiplier: 10,
      gasPrice: 1000000000 * 10,
      blockGasLimit: 0x1fffffffffffff
    },
    optimisticGoerli: {
      url: API_URL_OPTIGOERLI,
      accounts: [`0x${PRIVATE_KEY}`],
      gasMultiplier: 10,
      gasPrice: 1000000000 * 10,
      blockGasLimit: 0x1fffffffffffff
    },
  },
   etherscan: {
    apiKey: {
      goerli: ETHERSCAN_API_KEY,
      optimisticGoerli: OPTISCAN_API_KEY,
      arbitrumGoerli: ARBISCAN_API_KEY,
    }
  }
}

// npx hardhat verify --network goerli 0x

