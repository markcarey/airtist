const chain = hre.network.name;

//GOERLI:
const implementation = "0xc7abB71f20118C145a83e4989147a80416b97031";

async function main() {
    // Grab the contract factory 
    const MyContract = await ethers.getContractFactory("AIrtNFTFactory");
 
    // Start deployment, returning a promise that resolves to a contract object
    //const myContract = await MyContract.deploy(implementation); // Instance of the contract 
    const myContract = await MyContract.deploy(); // Instance of the contract 
    console.log("Contract deployed to address:", myContract.address);
    console.log(`npx hardhat verify --network ${chain} ${myContract.address} ${implementation}`);
 }
 
 main()
   .then(() => process.exit(0))
   .catch(error => {
     console.error(error);
     process.exit(1);
   });