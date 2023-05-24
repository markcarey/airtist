const multiDeployerJSON = require("./abis/MultiChainDeployer.json");
const AIrtistNFTFactoryJSON = require("../artifacts/contracts/AIrtNFTFactory.sol/AIrtNFTFactory.json");

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const signer = new ethers.Wallet(PRIVATE_KEY, ethers.provider);

const axelarSDK = require("@axelar-network/axelarjs-sdk");
const sdk = new axelarSDK.AxelarQueryAPI({
    environment: "testnet",
});

const chain = hre.network.name;
console.log(chain);

var addr = {};
addr.goerli = {
    "name": "ethereum-2",
    "gasToken": "ETH",
    "gateway": "0xe432150cce91c13a887f7D836923d5597adD8E31",
    "gas": "0xbE406F0189A0B4cf3A05C286473D23791Dd44Cc6",
    "multi": "0x81419C008dc810B6fa4c81D19D44e5D9820dF3C5"
};

addr.arbitrumGoerli = {
    "name": "arbitrum",
    "gasToken": "ETH",
    "gateway": "0xe432150cce91c13a887f7D836923d5597adD8E31",
    "gas": "0xbE406F0189A0B4cf3A05C286473D23791Dd44Cc6",
    "multi": "0x81419C008dc810B6fa4c81D19D44e5D9820dF3C5"
};
addr.optimisticGoerli = {
    "name": "optimism",
    "gasToken": "ETH",
    "gateway": "0xe432150cce91c13a887f7D836923d5597adD8E31",
    "gas": "0xbE406F0189A0B4cf3A05C286473D23791Dd44Cc6",
    "multi": "0x81419C008dc810B6fa4c81D19D44e5D9820dF3C5"
};

const nftImplementation = "0x0dE9fAC898137E253D16BCabA2a29AA61b1F041A";  // goerli, optiGoerli, arbiGoerli
const transporterImplementation = "0x7d1911DF8c66dc08060CF81469F9EC37bb711D8E";  // goerli, optiGoerli, arbiGoerli

const v = "five";
const salt = ethers.utils.formatBytes32String(v);

//const pHash = ethers.utils.solidityKeccak256(["bytes"],[p]);



const ABI = ["function initialize(address _nftImplementation, address _transporterImplementation)"];
const iface = new ethers.utils.Interface(ABI);

async function main() {

    const senderOptions = { privateKey: PRIVATE_KEY, provider: ethers.provider };

    //const response = await axelar.manualRelayToDestChain(
    //const response = await axelar.execute(
    //    '0xf199df0b363fe29d462808b5c0fcf9d50862be1eda83a438617e4ce3b053791b',
    //    senderOptions
    //);
    //console.log(response);
    //return;

    //const targetChains = [ "goerli", "mumbai", "moonbeam-alpha" ];
    //const targetChains = [ "goerli", "moonbeam-alpha" ];
    //const targetChains = [ "arbitrum-goerli" ];
    //const targetChains = [ "goerli", "arbitrumGoerli", "optimisticGoerli" ];
    //const targetChains = [ "goerli", "arbitrumGoerli" ];
    const targetChains = [ "optimisticGoerli" ];
    //const targetChains = [ "arbitrumGoerli" ];
    //const targetChains = [ "goerli" ];
    var chainNames = [];
    var destinations = [];
    var inits = [];
    var fees = [];
    var totalFee = 0;
    for (let i = 0; i < targetChains.length; i++) {
        var thisChain = targetChains[i];
        if ( thisChain == chain ) {
            chainNames.push("this");
            fees.push("0");
        } else {
            chainNames.push(addr[thisChain].name);
            const gasFee = await sdk.estimateGasFee(addr[chain].name, addr[thisChain].name, addr[chain].gasToken, 2000000, 1.2);
            fees.push("" + gasFee);
            totalFee += parseInt(gasFee);
        }
        destinations.push(addr[thisChain].multi);
        inits.push(iface.encodeFunctionData("initialize", [ nftImplementation, transporterImplementation ]));
    }
    console.log("fee", totalFee);
    //return;

    const factory = new ethers.Contract(addr[chain].multi, multiDeployerJSON.abi, signer);
    //const result = await factory.multiDeploy(AIrtistNFTFactoryJSON.bytecode, salt, chainNames, destinations, fees);
    console.log(AIrtistNFTFactoryJSON.bytecode, salt, chainNames, destinations, inits, fees);
    const result = await factory.multiDeployAndInit(AIrtistNFTFactoryJSON.bytecode, salt, chainNames, destinations, fees, inits, {value: "" + totalFee});
    console.log(result);
    await result.wait();

}

main()
   .then(() => process.exit(0))
   .catch(error => {
     console.error(error);
     process.exit(1);
   });