const chain = hre.network.name;

const tokenName = "AIrtist pAInt";
const symbol = "pAInt";
const supply = "420000000000000000000000000000000"; // 420T

//GOERLI:
const stf = "0x94f26B4c8AD12B18c12f38E878618f7664bdcCE2";
const host = "0x22ff293e14F1EC3A09B137e9e06084AFd63adDF9";
const cfa = "0xEd6BcbF6907D4feEEe8a8875543249bEa9D308E8";

async function main() {
    // Grab the contract factory 
    const MyContract = await ethers.getContractFactory("Streamer");
 
    // Start deployment, returning a promise that resolves to a contract object
    const myContract = await MyContract.deploy(tokenName, symbol, supply, stf, host, cfa); // Instance of the contract 
    console.log("Contract deployed to address:", myContract.address);
    console.log(`npx hardhat verify --network ${chain} ${myContract.address} "${tokenName}" ${symbol} ${supply} ${stf} ${host} ${cfa}`);
 }
 
 main()
   .then(() => process.exit(0))
   .catch(error => {
     console.error(error);
     process.exit(1);
   });