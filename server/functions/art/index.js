var firebase = require('firebase-admin');
if (!firebase.apps.length) {
    firebase.initializeApp();
}
var storage = firebase.storage();
const bucket = storage.bucket("airtist");
var db = firebase.firestore();

const express = require("express");
const api = express();
const jose = require('jose');

const { ethers } = require("ethers");

const nftJSON = require(__base + 'art/AIrtNFT.json');
const factoryJSON = require(__base + 'art/AIrtNFTFactory.json');
const transporterJSON = require(__base + 'art/Transporter.json');

const safeCoreSDK = require('@safe-global/safe-core-sdk');
const Safe = safeCoreSDK.default;
const SafeFactory = safeCoreSDK.SafeFactory;
const safeEthersLib = require('@safe-global/safe-ethers-lib');
const EthersAdapter = safeEthersLib.default;

const relayKit = require('@safe-global/relay-kit');
const GelatoRelayAdapter = relayKit.GelatoRelayAdapter;
const relayAdapter = new GelatoRelayAdapter(process.env.GELATO_API_KEY);

const GelatoRelaySDK = require("@gelatonetwork/relay-sdk");
const relay = new GelatoRelaySDK.GelatoRelay();

const axelarSDK = require("@axelar-network/axelarjs-sdk");
const axelar = new axelarSDK.AxelarQueryAPI({
    environment: "testnet",
});
const axelarGMP = new axelarSDK.AxelarGMPRecoveryAPI({
    environment: "testnet",
});

const fetch = require('node-fetch');

const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const defaultChainId = 5; // Goerli

var provider = new ethers.providers.JsonRpcProvider({"url": process.env.API_URL_GOERLI});
var providers = [];
providers[5] = new ethers.providers.JsonRpcProvider({"url": process.env.API_URL_GOERLI});
providers[420] = new ethers.providers.JsonRpcProvider({"url": process.env.API_URL_OPTIGOERLI});
providers[421613] = new ethers.providers.JsonRpcProvider({"url": process.env.API_URL_ARBIGOERLI});
var signer;

var chainNames = [];
chainNames[5] = "ethereum-2";
chainNames[420] = "optimism";
chainNames[421613] = "arbitrum";

var openSeaSlugs = [];
openSeaSlugs[5] = "goerli";
openSeaSlugs[420] = "optimism-goerli";
openSeaSlugs[421613] = "arbitrum-goerli";

var ensProvider = new ethers.providers.JsonRpcProvider({"url": "https://" + process.env.RPC_ETH});

const transporterAddress = process.env.TRANSPORTER;

const jwksSocial = 'https://api.openlogin.com/jwks';
const jwksExternal = 'https://authjs.web3auth.io/jwks';
const maxInt = ethers.constants.MaxUint256;
const THREE_PER_MONTH = "1141552511415"; // flowRate per second for 3 monthly (18 decimals)
const THIRTY_PER_MONTH = "11415525114150"; // flowRate per second for 30 monthly (18 decimals)

const sleep = (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
};

function getContracts(pk, provider) {
    signer = new ethers.Wallet(pk, provider);
}

function abbrAddress(address){
    return address.slice(0,4) + "..." + address.slice(address.length - 4);
}

function fixAvatar(url) {
    var newUrl;
    // Twitter example: https://pbs.twimg.com/profile_images/1601225833741418497/PhQp9CL4_normal.jpg
    if ( url.includes('twimg') ) {
        newUrl = url.replace('_normal.', '.');
    }
    // Google example: https://lh3.googleusercontent.com/a/AGNmyxYJ3wOecX7hcroDs6W7KotI6mvTV5qM8Zlzdn0ObQ=s96-c
    if ( url.includes('googleusercontent') ) {
        newUrl = url.replace('=s96-c', '=s256-c');
    }
    // Discord: https://cdn.discord.com/avatars/822180265753444412/71df2273e2c42cf1ce797223999f1510.png?size=2048
    if ( url.includes('cdn.discord.com') ) {
        newUrl = url.replace('discord.com', 'discordapp.com');
        newUrl = newUrl.replace('?size', '?nosize');
    }
    return newUrl ? newUrl : url;
}

async function getENS(address){
    return new Promise(async function(resolve) {
        var name = await ensProvider.lookupAddress(address);
        if (name) {
            resolve(name);
        } else {
            resolve('');
        }
    });
}

async function getSafeAddress(address, deploy) {
    return new Promise(async (resolve, reject) => {
        const signer = new ethers.Wallet(process.env.AIRTIST_HOT_PRIV, provider);
        const ethAdapter = new EthersAdapter({
            "ethers": ethers,
            "signerOrProvider": signer
        });
        const safeFactory = await SafeFactory.create({ "ethAdapter": ethAdapter });
        var owners = [
            address, 
            await signer.getAddress(), 
            process.env.AIRTIST_COLD
        ];
        console.log(owners);
        const threshold = 1;
        const safeAccountConfig = {
            "owners": owners,
            "threshold": threshold,
            "fallbackHandler": process.env.FALLBACK_HANDLER_ADDR
        };
        const safeDeploymentConfig = {
            "saltNonce": address
        }
        var safeAddress;
        if (deploy) {
            //var predictedAddress = await safeFactory.predictSafeAddress({ safeAccountConfig, safeDeploymentConfig });
            const safeSdk = await safeFactory.deploySafe({ safeAccountConfig, safeDeploymentConfig });
            safeAddress = safeSdk.getAddress();
            //console.log("pred/dep", predictedAddress, safeAddress);
        } else {
            safeAddress = await safeFactory.predictSafeAddress({ safeAccountConfig, safeDeploymentConfig });
        }
        resolve(safeAddress);
    });
}

async function doApprovals(safeAddress, nftAddress) {
    return new Promise(async (resolve, reject) => {
        const signer = new ethers.Wallet(process.env.AIRTIST_HOT_PRIV, provider);
        const ethAdapter = new EthersAdapter({
            "ethers": ethers,
            "signerOrProvider": signer
        });
        const safeSDK = await Safe.create({ "ethAdapter": ethAdapter, "safeAddress": safeAddress });

        // approve txn data
        const approveABI = [
            "function approve(address spender, uint256 amount)",
            "function allowance(address owner, address spender)"
        ];
        const pAInt = new ethers.Contract(process.env.PAINT_ADDR, approveABI, signer);
        const allowance = await pAInt.allowance(safeAddress, nftAddress);
        console.log("allowance", allowance);
        if ( parseInt(allowance) > 0) {
            console.log("already approved for this contract");
            resolve(1);
            return;
        }
        const paintTxn = await pAInt.populateTransaction.approve(nftAddress, maxInt);
        console.log("paintData", paintTxn.data);
        const weth = new ethers.Contract(process.env.GOERLI_WETH, approveABI, signer);
        const wethTxn = await weth.populateTransaction.approve(nftAddress, maxInt);
        console.log("wethData", wethTxn.data);
        const metaTransactionData = [
            {
                "to": process.env.PAINT_ADDR,
                "data": paintTxn.data,
                "value": 0
            },
            {
                "to": process.env.GOERLI_WETH,
                "data": wethTxn.data,
                "value": 0
            }
        ];
        const safeTransaction = await safeSDK.createTransaction({ "safeTransactionData": metaTransactionData });
        const signedSafeTransaction = await safeSDK.signTransaction(safeTransaction);
        console.log("signedSafeTransaction", JSON.stringify(signedSafeTransaction));
        const executeTxResponse = await safeSDK.executeTransaction(signedSafeTransaction);
        console.log("executeTxResponse", JSON.stringify(executeTxResponse));
        resolve(executeTxResponse);
    });
}

async function getGelatoNonce(address) {
    return new Promise(async (resolve, reject) => {
        const abi = ["function userNonce(address account) external view returns (uint256)"];
        const contract = new ethers.Contract(process.env.GELATO_RELAY_ERC2771_ADDRESS, abi, provider);
        const nonce = await contract.userNonce(address);
        resolve(nonce);
    });
}

async function deployNFTContract(name, symbol, safeAddress, chainId) {
    return new Promise(async (resolve, reject) => {
        if (!chainId) {
            chainId = defaultChainId;
        }
        const deployProvider = providers[chainId];
        const signer = new ethers.Wallet(process.env.AIRTIST_HOT_PRIV, deployProvider);
        //const nonce = await getGelatoNonce(await signer.getAddress());
        //console.log("nonce", parseInt(nonce));
        const network = await deployProvider.getNetwork();
        const abi = factoryJSON.abi;
        const factory = new ethers.Contract(process.env.AIRTIST_FACTORY, abi, signer);
        const txn = await factory.populateTransaction.createAIrtNFT(name, symbol, safeAddress);
        console.log(txn.data);
        const request = {
            "chainId": network.chainId,
            "target": process.env.AIRTIST_FACTORY,
            "data": txn.data,
            "user": await signer.getAddress()
        };
        console.log("request", request);
        const relayResponse = await relay.sponsoredCallERC2771(
            request,
            signer,
            process.env.GELATO_API_KEY
        );
        console.log(relayResponse, JSON.stringify(relayResponse));
        resolve(relayResponse);
    });
}

async function deployNFTContractAndUpdateStream(name, symbol, safeAddress) {
    return new Promise(async (resolve, reject) => {
        const signer = new ethers.Wallet(process.env.AIRTIST_HOT_PRIV, provider);
        const nonce = await getGelatoNonce(await signer.getAddress());
        console.log("nonce", parseInt(nonce));
        const network = await provider.getNetwork();
        const abi = factoryJSON.abi;
        const factory = new ethers.Contract(process.env.AIRTIST_FACTORY, abi, signer);
        const txn = await factory.populateTransaction.createAIrtNFT(name, symbol, safeAddress);
        console.log(txn.data);
        const request = {
            "chainId": network.chainId,
            "target": process.env.AIRTIST_FACTORY,
            "data": txn.data,
            "user": await signer.getAddress()
        };
        console.log("request", request);
        const relayResponse = await relay.sponsoredCallERC2771(
            request,
            signer,
            process.env.GELATO_API_KEY
        );
        console.log(relayResponse, JSON.stringify(relayResponse));
        // TODO: grant roles to user web3auth address and/or safe address?


        // 2. Now update pAINt stream to 30 per month
        await sleep(5000);
        // stream txn
        const streamABI = ["function stream(address to, int96 flowRate, uint256 amount)"];
        const streamer = new ethers.Contract(process.env.PAINT_STREAMER, streamABI, signer);
        const flowRate = THIRTY_PER_MONTH;
        const drop = "10000000000000000000"; // 10 upgrade bonus
        const streamTxn = await streamer.populateTransaction.stream(safeAddress, flowRate, drop);
        console.log("streamData", streamTxn.data);
        const streamRequest = {
            "chainId": network.chainId,
            "target": process.env.PAINT_STREAMER,
            "data": streamTxn.data,
            "user": await signer.getAddress(),
            "userNonce": parseInt(nonce) + 1
        };
        console.log("request", streamRequest);
        const streamRelayResponse = await relay.sponsoredCallERC2771(
            streamRequest,
            signer,
            process.env.GELATO_API_KEY
        );
        console.log(streamRelayResponse, JSON.stringify(streamRelayResponse));

        // return *deploy* response
        resolve(relayResponse);
    });
}

async function grantTransporterRole(nftAddress, chainId) {
    const TRANSPORTER_ROLE = "0xddaa901e2fe3bda354fe0ede2785152d5c109282a613fe024a056a3e66c41bb3";
    return new Promise(async (resolve, reject) => {
        if (!chainId) {
            chainId = defaultChainId;
        }
        const deployProvider = providers[chainId];
        const signer = new ethers.Wallet(process.env.AIRTIST_HOT_PRIV, deployProvider);
        const network = await deployProvider.getNetwork();
        const abi = nftJSON.abi;
        const nft = new ethers.Contract(nftAddress, abi, signer);
        const txn = await nft.populateTransaction.grantRole(TRANSPORTER_ROLE, process.env.TRANSPORTER);
        console.log(txn.data);
        const request = {
            "chainId": network.chainId,
            "target": nftAddress,
            "data": txn.data,
            "user": await signer.getAddress()
        };
        console.log("request", request);
        const relayResponse = await relay.sponsoredCallERC2771(
            request,
            signer,
            process.env.GELATO_API_KEY
        );
        console.log(relayResponse, JSON.stringify(relayResponse));
        resolve(relayResponse);
    });
}

async function updateStream(safeAddress, flowRate, drop) {
    return new Promise(async (resolve, reject) => {
        const signer = new ethers.Wallet(process.env.AIRTIST_HOT_PRIV, provider);
        const network = await provider.getNetwork();
        // stream txn
        const streamABI = ["function stream(address to, int96 flowRate, uint256 amount)"];
        const streamer = new ethers.Contract(process.env.PAINT_STREAMER, streamABI, signer);
        const streamTxn = await streamer.populateTransaction.stream(safeAddress, flowRate, drop);
        console.log("streamData", streamTxn.data);
        const streamRequest = {
            "chainId": network.chainId,
            "target": process.env.PAINT_STREAMER,
            "data": streamTxn.data,
            "user": await signer.getAddress()
        };
        console.log("request", streamRequest);
        const streamRelayResponse = await relay.sponsoredCallERC2771(
            streamRequest,
            signer,
            process.env.GELATO_API_KEY
        );
        console.log(streamRelayResponse, JSON.stringify(streamRelayResponse));
        resolve(relayResponse);
    });
}

async function getBalances(user) {
    return new Promise(async (resolve, reject) => {
        var balances = {};
        const balanceAbi = ["function balanceOf(address owner) view returns (uint256)"];
        const pAInt = new ethers.Contract(process.env.PAINT_ADDR, balanceAbi, provider);
        const weth = new ethers.Contract(process.env.GOERLI_WETH, balanceAbi, provider);
        const paintBal = await pAInt.balanceOf(user.safeAddress);
        const wethBal = await weth.balanceOf(user.safeAddress);
        balances["pAInt"] = paintBal.toString();
        balances[process.env.PAINT_ADDR] = paintBal.toString();
        balances["WETH"] = wethBal.toString();
        balances[process.env.GOERLI_WETH] = wethBal.toString();
        await db.collection('users').doc(user.address).collection("wallet").doc("balances").set(balances);
        resolve(balances);
    });
}

async function transportNFT(doc, post) {
    return new Promise(async (resolve, reject) => {
        var chain = post.mintChain;
        if (chain == post.chain) {
            resolve(1);
        } else {
            // check if remote contract has been deployed (if PRO)
            if (post.nftContract != process.env.AIRTIST_ADDR) {
                // this is a PRO contract
                // get creator:
                const creatorRef = db.collection('users').doc(post.user);
                const creatorDoc = await creatorRef.get();
                if (creatorDoc.exists) {
                    const creator = creatorDoc.data();
                    if ("deployedChains" in creator) {
                        console.log("deployedChains", creator.deployedChains);
                        if (creator.deployedChains.includes(parseInt(chain))) {
                            // target chain already deployed
                            console.log(`already deployed to ${chain}`);
                        } else {
                            // need to deploy remote contract before transport can start
                            console.log(`need to deploy to ${chain}`);
                            await creatorDoc.ref.update({
                                "deployToChain": parseInt(chain),
                                "transportPostId": doc.id
                            });
                            resolve(1);
                            return;
                        }
                    }
                }
            }
            // send txn inputs:
            console.log("now set tcxn inputs");
            const fromChain = chainNames[post.chain];
            const toChain = chainNames[chain];
            const nftAddress = post.nftContract;
            const tokenId = post.tokenId;
            var minterAddress = post.user;
            if ("minterAddress" in post) {
                minterAddress = post.minterAddress;
            }
            console.log("minterAddress", minterAddress);
            const userRef = db.collection('users').doc(minterAddress);
            const userDoc = await userRef.get();
            var to;
            if (userDoc.exists) {
                const minter = userDoc.data();
                if ("safeAddress" in minter) {
                    to = minter.safeAddress;
                } else {
                    // TODO: deploy Safe (or queue deployment for later)
                }
            } else {
                console.log(`user ${minterAddress} not found`);
            }
            if (!to) {
                resolve(1);
            }
            const fee = await axelar.estimateGasFee(fromChain, toChain, "ETH", 200000, 1.4);
            console.log(`transport fee is ${fee}`);

            //switchProvider(chain);
            const signer = new ethers.Wallet(process.env.AIRTIST_HOT_PRIV, provider);
            console.log("transporterAddress", transporterAddress);
            const transporter = new ethers.Contract(transporterAddress, transporterJSON.abi, signer);
            console.log(nftAddress, to, tokenId, toChain, fee);
            const txn = await transporter.populateTransaction.send(nftAddress, to, tokenId, toChain, fee);
            console.log(txn.data);
            const network = await provider.getNetwork();
            console.log(network);
            const request = {
                "chainId": network.chainId,
                "target": transporterAddress,
                "data": txn.data,
                "user": await signer.getAddress()
            };
            console.log("request", request);
            const relayResponse = await relay.sponsoredCallERC2771(
                request,
                signer,
                process.env.GELATO_API_KEY
            );
            console.log(relayResponse, JSON.stringify(relayResponse));
            if ("taskId" in relayResponse) {
                await doc.ref.update({
                    "transportStatus": "pending",
                    "transportTaskId": relayResponse.taskId
                });
                const notificationDoc = await userDoc.ref.collection('notifications').add({
                    "image": `https://api.airtist.xyz/images/${post.id}.png`,
                    "link": `https://airtist.xyz/p/${post.id}`,
                    "timestamp": firebase.firestore.FieldValue.serverTimestamp(),
                    "text": `Transport has started for `,
                    "textLink": post.title ? post.title : "this post"
                });
                resolve(1);
            } else {
                console.log("error: relay error", JSON.stringify(relayResponse));
                reject(relayResponse);
            }
        }
    });
}

async function generate(prompt, id) {
    return new Promise(async (resolve, reject) => {
      const aiResponse = await openai.createImage({
        "prompt": prompt,
        "n": 1,
        "size": '512x512' // TODO: increase for PRO users
      });
      const result = await fetch(aiResponse.data.data[0].url);
  
      // 2. Save image to storage bucket
      const readStream = result.body;
      const writeStream = bucket.file(`${id}.png`).createWriteStream();
      readStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', () => resolve(true));
      readStream.pipe(writeStream);
    });
}

function getParams(req, res, next) {
    var params;
    if (req.method === 'POST') {
      params = req.body;
    } else {
      params = req.query;
    }
    req.q = params;
    next();
}

function cors(req, res, next) {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      // Send response to OPTIONS requests
      res.set('Access-Control-Allow-Methods', 'GET, POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '3600');
      return res.status(204).send('');
    } else {
      // Set CORS headers for the main request
      res.set('Access-Control-Allow-Origin', '*');
    }
    next();
}

async function getAuth(req, res, next) {
    req.user = null;
    var idToken = null;
    var social = false;
    var socialHeader = req.header("X-web3Auth-Social");
    if (socialHeader == "true") {
        social = true;
    }
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      console.log('Found "Authorization" header');
      // Read the API key from the Authorization header.
      idToken = req.headers.authorization.split('Bearer ')[1];
    } else {
      //console.log(req.q);
      if ("idToken" in req.q) {
        idToken = req.q.idToken;  // TODO: disableidToken in url params for production?
      }
    } // if req.headers
    if (idToken) {
        var jwksUrl = '';
        console.log("social", social);
        if (social) {
            jwksUrl = jwksSocial;
        } else {
            jwksUrl = jwksExternal;
        }
        console.log("jwksUrl", jwksUrl);
        const jwks = jose.createRemoteJWKSet(new URL(jwksUrl));
        //console.log("jwks", jwks);
        const jwtDecoded = await jose.jwtVerify(idToken, jwks, { algorithms: ["ES256"] });
        const payload = jwtDecoded.payload;
        var address;
        if ("address" in payload.wallets[0]) {
            address = payload.wallets[0].address;
        } else {
            const compKey = payload.wallets[0].public_key;
            address = ethers.utils.computeAddress(`0x${compKey}`);
            address = address.toLowerCase();
            payload.wallets[0].address = address;
        }
        const userRef = db.collection('users').doc(address);
        const user = await userRef.get();
        if (user.exists) {
            //return res.json(user.data());
            req.user = user.data();
        } else {
            var data = {
                "address": address
            };
            if ("email" in payload) {
                // TODO: for now, commented out for security reasons, but better to move to private subcollection, etc.
                //data.email = payload.email;   
            }
            if ("name" in payload) {
                data.name = payload.name;
            }
            if ("profileImage" in payload) {
                data.profileImage = fixAvatar(payload.profileImage);
            }
            var safeAddress = await getSafeAddress(address, false);
            console.log("safeAddress", safeAddress);
            if (safeAddress) {
                data.safeAddress = safeAddress;
                data.safeDeployed = false;
            }
            data.needApprovals = false;
            data.plan = "free";
            data.postCount = 0;
            data.followerCount = 0;
            data.followingCount = 0;
            await db.collection('users').doc(address).set(data);
            await db.collection('users').doc(address).collection("wallet").doc("balances").set({"pAInt": "5000000000000000000"});
            req.user = data;
        }
    }
    next();
}
  
api.use(cors);
api.use(getParams);

api.get("/api", async function (req, res) {
    return res.json({"what": "airtist", "why": "tbd"});
});

api.post("/api/post", getAuth, async function (req, res) {
    console.log("req.user", JSON.stringify(req.user));
    var data = {};
    data.title = req.q.title;
    data.prompt = req.q.prompt;
    data.category = req.q.category;
    data.price = req.q.price;
    data.currency = req.q.currency;
    data.type = req.q.type;
    data.selfmint = req.q.selfmint;
    data.mintable = req.q.mintable;
    data.mintChain = req.user.chain ? req.user.chain : defaultChainId;
    if ("mintchain" in req.q) {
        data.mintChain = req.q.mintchain;
    }
    data.mintChain = parseInt(data.mintChain);
    data.user = req.user.address;
    data.name = req.user.name ? req.user.name: '';
    data.profileImage = req.user.profileImage ? req.user.profileImage : '';
    data.timestamp = firebase.firestore.FieldValue.serverTimestamp();
    data.minted = false;
    data.commentCount = 0;
    data.likeCount = 0;
    data.repostCount = 0;
    console.log("art data", JSON.stringify(data));
    const doc = await db.collection('posts').add(data);
    await generate(data.prompt, doc.id);
    data.id = doc.id;
    await db.collection('users').doc(req.user.address).update({
        postCount: firebase.firestore.FieldValue.increment(1)
    });
    return res.json(data);
});

api.post("/api/comment", getAuth, async function (req, res) {
    console.log("req.user", JSON.stringify(req.user));
    var data = {};
    data.user = req.user.address;
    data.name = req.user.name ? req.user.name: '';
    data.profileImage = req.user.profileImage ? req.user.profileImage : '';
    data.timestamp = firebase.firestore.FieldValue.serverTimestamp();
    data.comment = req.q.comment;
    const doc = await db.collection('posts').doc(req.q.id).collection("comments").add(data);
    data.postId = req.q.id;
    data.id = doc.id;
    await db.collection('posts').doc(req.q.id).update({
        "commentCount": firebase.firestore.FieldValue.increment(1),
        "reactionCount": firebase.firestore.FieldValue.increment(1)
    });
    return res.json(data);
});

api.post("/api/like", getAuth, async function (req, res) {
    console.log("req.user", JSON.stringify(req.user));
    var data = {};
    data.user = req.user.address;
    data.name = req.user.name ? req.user.name: '';
    data.profileImage = req.user.profileImage ? req.user.profileImage : '';
    data.timestamp = firebase.firestore.FieldValue.serverTimestamp();
    const doc = await db.collection('posts').doc(req.q.id).collection("likes").add(data);
    await db.collection('posts').doc(req.q.id).update({
        "likeCount": firebase.firestore.FieldValue.increment(1),
        "reactionCount": firebase.firestore.FieldValue.increment(1)
    });
    return res.json(data);
});

api.post("/api/follow", getAuth, async function (req, res) {
    console.log("req.user", JSON.stringify(req.user));
    const follower = req.user.address;
    const followed = req.q.address;
    if (follower == followed) {
        return res.json({"error": "cannot follow yourself"});
    }    
    await db.collection('users').doc(follower).update({
        following: firebase.firestore.FieldValue.arrayUnion(followed),
        followingCount: firebase.firestore.FieldValue.increment(1)
    });
    await db.collection('users').doc(followed).update({
        followers: firebase.firestore.FieldValue.arrayUnion(follower),
        followerCount: firebase.firestore.FieldValue.increment(1)
    });
    return res.json({"result": "ok"});
});

api.post("/api/repost", getAuth, async function (req, res) {
    console.log("req.user", JSON.stringify(req.user));
    var parentId = req.q.parent;
    const docRef = db.collection('posts').doc(parentId);
    const doc = await docRef.get();
    if (doc.exists) {
        const parent = doc.data();
        var data = {};
        data.parentId = parentId;
        data.title = parent.title;
        data.prompt = parent.prompt;
        data.category = parent.category;
        data.price = 1;
        data.currency = process.env.PAINT_ADDR;
        data.type = parent.type;
        data.selfmint = false;
        data.mintable = false;
        data.user = req.user.address;
        data.name = req.user.name ? req.user.name: '';
        data.profileImage = req.user.profileImage ? req.user.profileImage : '';
        data.timestamp = firebase.firestore.FieldValue.serverTimestamp();
        data.minted = false;
        data.commentCount = 0;
        data.likeCount = 0;
        data.repostCount = 0;
        console.log("art data", JSON.stringify(data));
        const newDoc = await db.collection('posts').add(data);
        await generate(data.prompt, newDoc.id);
        data.id = newDoc.id;
        await db.collection('users').doc(req.user.address).update({
            "postCount": firebase.firestore.FieldValue.increment(1)
        });
        await docRef.update({
            "repostCount": firebase.firestore.FieldValue.increment(1),
            "reactionCount": firebase.firestore.FieldValue.increment(1)
        });
        await docRef.collection("reposts").add({
            "postId": data.id,
            "user": req.user.address,
            "name": req.user.name ? req.user.name: '',
            "profileImage": req.user.profileImage ? req.user.profileImage : '',
            "timestamp": firebase.firestore.FieldValue.serverTimestamp()
        });
        return res.json(data);
    } else {
        return res.json({"result": "error", "error": "parent post not found"});
    }
});

api.get("/api/profile", getAuth, async function (req, res) {
    // logged in user profile
    console.log("req.user", JSON.stringify(req.user));
    return res.json(req.user);
});
api.get("/api/profile/:address", async function (req, res) {
    const userRef = db.collection('users').doc(req.params.address);
    const user = await userRef.get();
    if (user.exists) {
        return res.json(user.data());
    } else {
        return res.json({"error": "user not found"});
    }
});
api.post("/api/profile", getAuth, async function (req, res) {
    const data = {
        "name": req.q.name,
        "profileImage": req.q.profileImage,
        "about": req.q.about,
        "location": req.q.location
    }
    await db.collection('users').doc(req.user.address).update(data);
    return res.json({"result": "ok", "message": "Profile data saved"});
});

api.post("/api/nftsettings", getAuth, async function (req, res) {
    const data = {
        "chain": parseInt(req.q.userchain),
    }
    await db.collection('users').doc(req.user.address).update(data);
    return res.json({"result": "ok", "message": "NFT settings saved"});
});

api.get("/api/balances", getAuth, async function (req, res) {
    // logged in user profile + balances
    console.log("req.user", JSON.stringify(req.user));
    const user = req.user;
    const balances = await getBalances(user);
    user.balances = balances;
    var cache = 'public, max-age=120, s-maxage=240';
    cache = 'public, max-age=60, s-maxage=120'; // TODO: adjust or remove this!!
    res.set('Cache-Control', cache);
    return res.json(user);
});

api.post("/api/mint", getAuth, async function (req, res) {
    const user = req.user;
    const balances = await getBalances(user);
    var id = req.q.id;
    var chain = req.q.chain ? req.q.chain : defaultChainId;
    chain = parseInt(chain);
    const docRef = db.collection('posts').doc(id);
    const postDoc = await docRef.get();
    if (postDoc.exists) {
        const post = postDoc.data();
        post.id = postDoc.id;
        if (user.safeDeployed == false) { 
            // this a "first mint" for the minter, let the trigger handle this one
            await postDoc.ref.update({
                "minterAddress": user.address,
            });
            return res.json({
                "result": "ok",
                "message": "First Mint starting soon"
            });
        }
        var price = post.price;
        var currency = post.currency;
        if (currency == "0") {
            currency = process.env.PAINT_ADDR;
        }
        // 1. check if post can be minted by loggedin user
        var allowed = false;
        if (post.mintable) {
            allowed = true;
        } else {
            if (user.address.toLowerCase() == post.user.toLowerCase()) {
                // loggedin user is creator, they can mint for 1 pAInt
                allowed = true;
                price = 1;
                currency = process.env.PAINT_ADDR;
            }
        }
        if (post.minted) {
            // already minted
            allowed = false;
        }
        console.log("allowed to mint", allowed);

        // 2. Does user have enough balance to mint?
        const priceInWei = ethers.utils.parseUnits(price.toString(), "ether");
        console.log("balance and price", balances[currency], priceInWei);
        if ( ethers.BigNumber.from(balances[currency]).gte(priceInWei) ) {
            // balance is enough
            // get creator's Safe address first so they can receive payment
            var creatorSafeAddress;
            var nftAddress = process.env.AIRTIST_ADDR;
            const creatorRef = db.collection('users').doc(post.user);
            const creatorDoc = await creatorRef.get();
            if (creatorDoc.exists) {
                var creator = creatorDoc.data();
                creatorSafeAddress = creator.safeAddress;
                if ("nftContract" in creator) {
                    nftAddress = creator.nftContract;
                }
            } else {
                console.log(`user ${post.user} not found`);
                creatorSafeAddress = process.env.AIRTIST_HOT_PRIV; // default / fallback
            }
            // 3. prepare mint txn
            // Generate the target payload
            console.log("nftAddress", nftAddress);
            const signer = new ethers.Wallet(process.env.AIRTIST_HOT_PRIV, provider);
            const nft = new ethers.Contract(nftAddress, nftJSON.abi, signer);
            if (nftAddress != process.env.AIRTIST_ADDR) {
                // check approval for this PRO contract
                await doApprovals(user.safeAddress, nftAddress);
            }
            var mintTxn; 
            if (user.address.toLowerCase() == post.user.toLowerCase()) {
                mintTxn = await nft.populateTransaction.selfMint(user.safeAddress);
            } else {
                mintTxn = await nft.populateTransaction.publicMint(creatorSafeAddress, user.safeAddress, priceInWei, currency);
            }
            console.log(mintTxn.data);
            const network = await provider.getNetwork();
            const request = {
                "chainId": network.chainId,
                "target": nftAddress,
                "data": mintTxn.data,
                "user": await signer.getAddress()
            };
            console.log("request", request);
            const relayResponse = await relay.sponsoredCallERC2771(
                request,
                signer,
                process.env.GELATO_API_KEY
            );
            console.log(relayResponse, JSON.stringify(relayResponse));
            if ("taskId" in relayResponse) {
                await postDoc.ref.update({
                    "mintStatus": "pending",
                    "mintTaskId": relayResponse.taskId,
                    "minterAddress": user.address,
                    "nftContract": nftAddress.toLowerCase(),
                    "chain": defaultChainId,
                    "mintChain": parseInt(chain)
                });
                const notificationDoc = await db.collection('users').doc(user.address).collection('notifications').add({
                    "image": `https://api.airtist.xyz/images/${post.id}.png`,
                    "link": `https://airtist.xyz/p/${post.id}`,
                    "timestamp": firebase.firestore.FieldValue.serverTimestamp(),
                    "text": `Minting has started for `,
                    "textLink": post.title ? post.title : "this post"
                });
                return res.json({
                    "result": "ok", 
                    "message": "Minting is underway",
                    "relay": relayResponse
                });
            } else {
                console.log("error: relay error", JSON.stringify(relayResponse));
                return res.json({
                    "result": "error", 
                    "error": "Minting relay error",
                    "relay": relayResponse
                });
            }
        } else {
            return res.json({"result": "error", "error": "insufficient funds", "balances": balances});
        }

    } else {
        return res.json({"result": "error", "error": "post not found"});
    }
}); 

api.post("/api/upgrade", getAuth, async function (req, res) {
    var name = req.q.name;
    var symbol = req.q.symbol;

    if (req.user.plan == "pro") {
        // already upgraded
        return res.json({"result": "error", "error": "You are already on the PRO plan"});
    }

    // User wants to upgrade, save name & symbol but actual upgrade will be triggered via Stripe webhook
    await db.collection('users').doc(req.user.address).update({
        "nftContractName": name,
        "nftContractSymbol": symbol
    });
    return res.json({
        "result": "ok",
        "message": "NFT contract name and symbol saved"
    });
});

api.post("/api/stripe", async function (req, res) {
    console.log(JSON.stringify(req.body));
    var wh = req.body;

    if (wh.type == "checkout.session.completed") {
        // subscription started
        const checkout = wh.data.object;
        const address = checkout.client_reference_id;
        const customerId = checkout.customer;
        const paymentLink = checkout.payment_link;
        if (paymentLink == "plink_1MqcWILgthn7o9uIwyolpeH1") {
            // get user
            const userDoc = await db.collection('users').doc(address).get();
            if (userDoc.exists) {
                var user = userDoc.data();
                var update = true;
                if (user.plan == "pro") {
                    // already on pro
                    update = false;
                    if (user.stripeCustomer != customerId) {
                        // but need customer id
                        update = true;
                    }
                }
                if (update) {
                    await userDoc.ref.update({
                        "stripeCustomer": customerId,
                        "plan": "pro"
                    });
                    await userDoc.ref.collection('notifications').add({
                        "image": user.profileImage ? user.profileImage : `https://web3-images-api.kibalabs.com/v1/accounts/${user.address}/image`,
                        "link": `https://airtist.xyz/`,
                        "timestamp": firebase.firestore.FieldValue.serverTimestamp(),
                        "name": "",
                        "text": `Upgrade to PRO plan is underway`,
                        "textLink": ""
                    });
                }
                return res.status(200).end();
            } else {
                console.log('no user found for ' + address);
                return res.status(200).end();
            }
        }
    } else if (wh.type == "customer.subscription.deleted") {
        // subscription ended
        const subscription = wh.data.object;
        const customerId = subscription.customer;
        // get matching user
        const userDoc = await db.collection('users').where("stripeCustomer", "==", customerId)
            .get()
            .then((querySnapshot) => {
                var count = 0;
                querySnapshot.forEach(async (userDoc) => {
                    count++;
                    await userDoc.ref.update({
                        "plan": "free"
                    });
                });
                if (count > 1) {
                    console.log("more than one user matched Stripe customerId " + customerId);
                }
                return res.status(200).end();
            });
    } else {
        // TODO: other events?
        return res.status(200).end();
    }
}); // /api/stripe

api.get('/images/:id.png', async function (req, res) {
    console.log("start /images/ with path", req.path);
    const id = req.params.id;
    var cache = 'public, max-age=86400, s-maxage=864000';
  
    // Step 1: Fetch Image
    //console.log("path", req.path);
    var file;
  
    try {
      file = await bucket.file(`${id}.png`).download();
      //console.log(file);
    }
    catch (e) {
      console.log(`image: did not find image for ${req.path} for id ${id}`);
      //return res.json({"result": "catch: no file yet"});
    }
  
    if (!file) {
      return res.json({"result": "no file yet"});
    }
  
    const img = file[0];
    res.set('Cache-Control', cache);
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': img.length
    });
    return res.end(img);
}); // image

api.get('/meta/:nftAddress/:id', async function (req, res) {
    console.log("start /meta/ with path", req.path);
    const nftAddress = req.params.nftAddress;
    const tokenId = req.params.id;
    console.log("nftAddress and tokenId", nftAddress, tokenId);
    console.log("tokenId+1", tokenId + 1);
    console.log("parseInt + 1", parseInt(tokenId) + 1);
    var cache = 'public, max-age=3600, s-maxage=86400';
    //cache = 'public, max-age=1, s-maxage=2'; 

    var meta;
  
    return db.collection("posts").where("nftContract", "==", nftAddress).where("tokenId", "==", parseInt(tokenId))
        .get()
        .then((querySnapshot) => {
            querySnapshot.forEach((doc) => {
                const post = doc.data();
                const postID = doc.id;
                meta = {};
                meta.name = post.title ? post.title : `AIrt #${tokenId}`; // TODO: update this for custom contracts
                meta.description = post.prompt; // TODO: update this for PRO users who decide to hide prompt
                meta.external_url = `https://airtist.xyz/p/${postID}`;
                meta.image = `https://api.airtist.xyz/images/${postID}.png`;
                meta.attributes = [
                    {
                        "trait_type": "Type", 
                        "value": post.type,
                    }, 
                    {
                        "trait_type": "Category", 
                        "value": post.category,
                    },
                    {
                        "trait_type": "Creator",
                        "value": post.user
                    }
                ];
                if ("name" in post) {
                    meta.attributes.push(
                        {
                            "trait_type": "Creator Name",
                            "value": post.name
                        }

                    );
                }
            });
            console.log("meta", JSON.stringify(meta));
            if (!meta) {
                return res.json({"error": "art not found"});
            }
            res.set('Cache-Control', cache);
            return res.json(meta); 
        });   
}); // meta

api.post("/api/login", async function (req, res) {
    var idToken = req.q.idToken;
    //console.log("idToken", idToken);
    // TODO: get JWT from POST body or Bearer header
    //idToken =  'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIswkImtpZCI6IlRZT2dnXy01RU9FYmxhWS1WVlJZcVZhREFncHRuZktWNDUzNU1aUEMwdzAifQ.eyJpYXQiOjE2NzkzMjM4MDUsImF1ZCI6IkJQay0zWXpRRS02UjNIMFdaY21FQWVpb3lPUlc1eHlHUWJvN09SdUVERWlxWm9EcXpXZVRRTm9iamt0OEctTHpJd0hhMWZwY1ItdmphSkZQSnZTRXpqTSIsIm5vbmNlIjoiMDMwNzM1ZjhmN2IzY2ZhZWQzYWIxYjQxODlhM2U1ZTI0ZmQwMzBmNGNjNTBiNzliYmE0MTNiYjE3NjViMThkZDAxIiwiaXNzIjoiaHR0cHM6Ly9hcGkub3BlbmxvZ2luLmNvbSIsIndhbGxldHMiOlt7InB1YmxpY19rZXkiOiIwMmI1YzdkNTNkYmQ0MTRlYzk4N2M0YzlhODU3ZTgxMTNkNjNhMTliZDdmMjYzMGY2MWU3YWQzYWI0OTlkMDExZDEiLCJ0eXBlIjoid2ViM2F1dGhfYXBwX2tleSIsImN1cnZlIjoic2VjcDI1NmsxIn1dLCJlbWFpbCI6Im1hcmtAbWFya2NhcmV5LmNvbSIsIm5hbWUiOiJNYXJrIENhcmV5IiwicHJvZmlsZUltYWdlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUdObXl4WkxwMnE2YVZaWHBaSl9lT2hRVDNGSXFXR3JFNmVOWnNURDlJenY9czk2LWMiLCJ2ZXJpZmllciI6InRvcnVzIiwidmVyaWZpZXJJZCI6Im1hcmtAbWFya2NhcmV5LmNvbSIsImFnZ3JlZ2F0ZVZlcmlmaWVyIjoidGtleS1nb29nbGUtY3lhbiIsImV4cCI6MTY3OTQxMDIwNX0.yg-_rjHHiNB0wvld4cJwHPoSfoMuHeQOHrWMIN-9pQ8oIHeHIFC5AdqIVu1lhepNQ2PSle4_VqhjHiG0YlUyuA';
    //console.log("idToken", idToken);
    const pub_key = req.q.address;
    console.log(pub_key);
    var jwksUrl = '';
    const isSocial = req.q.social;
    console.log("isSocial", isSocial);
    if (isSocial) {
        jwksUrl = jwksSocial;
    } else {
        jwksUrl = jwksExternal;
    }
    const jwks = jose.createRemoteJWKSet(new URL(jwksUrl));
    //console.log("jwks", jwks);
    const jwtDecoded = await jose.jwtVerify(idToken, jwks, { algorithms: ["ES256"] });
    const payload = jwtDecoded.payload;
    var address;
    if ("address" in payload.wallets[0]) {
        address = payload.wallets[0].address;
    } else {
        const compKey = payload.wallets[0].public_key;
        address = ethers.utils.computeAddress(`0x${compKey}`);
        payload.wallets[0].address = address;
    }
    // TODO:
    // create user in DB
    const userRef = db.collection('users').doc(address);
    const user = await userRef.get();
    if (user.exists) {
        return res.json(user.data());
    }
    var data = {
        "address": address
    };
    if ("email" in payload) {
        data.email = payload.email;
    }
    if ("name" in payload) {
        data.name = payload.name;
    }
    if ("profileImage" in payload) {
        data.profileImage = payload.profileImage;
    }
    var safeAddress = await getSafeAddress(address, false);
    console.log("safeAddress", safeAddress);
    if (safeAddress) {
        data.safeAddress = safeAddress;
        data.safeDeployed = false;
    }
    await db.collection('users').doc(address).set(data);
    // deploy Safe, or wait until later?
    return res.json(data);
});

module.exports.api = api;

module.exports.newUser = async function(snap, context) {
    const user = snap.data();
    const address = user.address;
    if (!address) {
      return;
    }
    var ens = await getENS(address);
    if (ens) {
        const userRef = snap.ref;
        await userRef.update({
            "name": ens
        });
    }
    return;
} // newUser

module.exports.newOrUpdatedPost = async function(change, context) {
    var postBefore = {};
    var isNew = false;
    if ( change.before.exists ) {
        postBefore = change.before.data();
    } else {
        isNew = true;
    }
    if ( !change.after.exists ) {
        // deleted post
        return;
    }
    const postDoc = change.after;
    const post = change.after.data();
    //const post = postDoc.data();
    var minterAddress = "";
    post.id = postDoc.id;
    var mintIt = false;
    if (isNew && post.selfmint) {
        mintIt = true;
        minterAddress = post.user;
    } else if ( "minterAddress" in post ) {
        if ( "minterAddress" in postBefore ) {
            mintIt = false;
        } else {
            mintIt = true;
            minterAddress = post.minterAddress;
        }
    }
    console.log("mintIt is " + mintIt, JSON.stringify(post));
    if ("tokenId" in post) {
        mintIt = false; // just to make extra sure, TODO: adjust this when open edition feature is added
    }
    var firstMint = false;
    if (mintIt) {
        //const postDoc = snap.ref;
        console.log('needs minting');
        const userDoc = await db.collection('users').doc(minterAddress).get();

        if (userDoc.exists) {
            const user = userDoc.data();  // "user" below refers to the minting user, who may or may not be the post creator
            // check if user has deployed their own NFT contract
            var creator;
            if (minterAddress != post.user) {
                // the minter is not the creator
                const creatorDoc = await db.collection('users').doc(post.user).get();
                creator = creatorDoc.data();
            } else {
                creator = user;
            }
            var nftAddress = creator.nftContract ? creator.nftContract : process.env.AIRTIST_ADDR;
            const signer = new ethers.Wallet(process.env.AIRTIST_HOT_PRIV, provider);
            var doApprovalsNow = false;
            if (user.safeDeployed == false) {
                firstMint = true;
                // first, deploy the safe
                const safeAddress = await getSafeAddress(user.address, true);
                if (safeAddress != user.safeAddress) {
                    console.log(`address of deployed safe (${safeAddress}) does not match predicted address (${user.safeAddress}) for user ${user.address}`);
                }
                // update user doc
                await userDoc.ref.update({
                    "safeDeployed": true,
                });
                doApprovalsNow = true;
            } // if safe deployed

            if (doApprovalsNow) {
                // TODO: actually check contract for current allowance?
                await doApprovals(user.safeAddress, nftAddress);
                // update user doc
                await userDoc.ref.update({
                    "needApprovals": false
                });
            }

            const network = await provider.getNetwork();
            const abi = [
                "function selfMint(address to)",
                "function publicMint(address creator, address to, uint256 amount, address currency)"
            ];
            const nft = new ethers.Contract(nftAddress, abi, signer);
            console.log("user.safeAddress", user.safeAddress);
            if (firstMint) {
                //const utils = require("@safe-global/relay-kit/utils");
                //utils.getUserNonce()
                const nonce = await getGelatoNonce(await signer.getAddress());
                console.log("nonce", nonce);
                // 1. relay mint for FREE
                // Generate the target payload
                const mintTxn = await nft.populateTransaction.publicMint(creator.safeAddress, user.safeAddress, "0", process.env.PAINT_ADDR);
                console.log(mintTxn.data);
                const request = {
                    "chainId": network.chainId,
                    "target": nftAddress,
                    "data": mintTxn.data,
                    "user": await signer.getAddress()
                };
                console.log("request", request);
                const relayResponse = await relay.sponsoredCallERC2771(
                    request,
                    signer,
                    process.env.GELATO_API_KEY
                );
                console.log(relayResponse, JSON.stringify(relayResponse));
                if ("taskId" in relayResponse) {
                    await postDoc.ref.update({
                        "mintStatus": "pending",
                        "mintTaskId": relayResponse.taskId,
                        "nftContract": nftAddress.toLowerCase(),
                        "chain": defaultChainId
                    });
                    const notificationDoc = await db.collection('users').doc(minterAddress).collection('notifications').add({
                        "image": `https://api.airtist.xyz/images/${post.id}.png`,
                        "link": `https://airtist.xyz/p/${post.id}`,
                        "timestamp": firebase.firestore.FieldValue.serverTimestamp(),
                        "text": `Minting has started for `,
                        "textLink": post.title ? post.title : "this post"
                    });
                } else {
                    console.log("error: relay error", JSON.stringify(relayResponse));
                }

                // 2. drop 4 pAINnt and start stream of 3 monthly
                await sleep(5000);
                
                // stream txn
                const streamABI = ["function stream(address to, int96 flowRate, uint256 amount)"];
                const streamer = new ethers.Contract(process.env.PAINT_STREAMER, streamABI, signer);
                const flowRate = THREE_PER_MONTH;
                const drop = "4000000000000000000"; // 4 to start (actually 5 but we deduct one for the firstMint)
                const streamTxn = await streamer.populateTransaction.stream(user.safeAddress, flowRate, drop);
                console.log("streamData", streamTxn.data);
                const streamRequest = {
                    "chainId": network.chainId,
                    "target": process.env.PAINT_STREAMER,
                    "data": streamTxn.data,
                    "user": await signer.getAddress(),
                    "userNonce": parseInt(nonce) + 1
                };
                console.log("request", streamRequest);
                const streamRelayResponse = await relay.sponsoredCallERC2771(
                    streamRequest,
                    signer,
                    process.env.GELATO_API_KEY
                );
                console.log(streamRelayResponse, JSON.stringify(streamRelayResponse));
            } else {
                if (minterAddress != post.user) {
                    return; // if not a "first mint", let the /api/mint endpoint handle it
                }
                // relay the mint
                // Generate the target payload
                const mintTxn = await nft.populateTransaction.selfMint(user.safeAddress);
                console.log(mintTxn.data);
                const request = {
                    "chainId": network.chainId,
                    "target": nftAddress,
                    "data": mintTxn.data,
                    "user": await signer.getAddress()
                };
                console.log("request", request);
                const relayResponse = await relay.sponsoredCallERC2771(
                    request,
                    signer,
                    process.env.GELATO_API_KEY
                );
                console.log(relayResponse, JSON.stringify(relayResponse));
                if ("taskId" in relayResponse) {
                    await postDoc.ref.update({
                        "mintStatus": "pending",
                        "mintTaskId": relayResponse.taskId,
                        "nftContract": nftAddress.toLowerCase(),
                        "chain": defaultChainId
                    });
                } else {
                    console.log("error: relay error", JSON.stringify(relayResponse));
                }
            } // if firstMint
        } else {
            console.log("user not found for " + post.user);
        } // if user
    }
    return;
} // newPost

module.exports.newLike = async function(likeDoc, context) {
    const like = likeDoc.data();
    const postDoc = await db.collection('posts').doc(context.params.postId).get();
    const post = postDoc.data();
    const image = like.profileImage ? like.profileImage : `https://web3-images-api.kibalabs.com/v1/accounts/${like.user}/image`;
    const likeNotification = await db.collection('users').doc(post.user).collection('notifications').add({
        "image": image,
        "link": `https://airtist.xyz/p/${postDoc.id}`,
        "timestamp": firebase.firestore.FieldValue.serverTimestamp(),
        "name": like.name ? like.name : abbrAddress(like.user),
        "text": ` liked your post `,
        "textLink": post.title ? post.title : ""
    });
} // newLike

module.exports.newComment = async function(commentDoc, context) {
    const comment = commentDoc.data();
    const postDoc = await db.collection('posts').doc(context.params.postId).get();
    const post = postDoc.data();
    const image = comment.profileImage ? comment.profileImage : `https://web3-images-api.kibalabs.com/v1/accounts/${comment.user}/image`;
    const commentNotification = await db.collection('users').doc(post.user).collection('notifications').add({
        "image": image,
        "link": `https://airtist.xyz/p/${postDoc.id}`,
        "timestamp": firebase.firestore.FieldValue.serverTimestamp(),
        "name": comment.name ? comment.name : abbrAddress(comment.user),
        "text": ` commented on your post `,
        "textLink": post.title ? post.title : ""
    });
} // newLike

module.exports.newRepost = async function(repostDoc, context) {
    const repost = repostDoc.data();
    const postDoc = await db.collection('posts').doc(context.params.postId).get();
    const post = postDoc.data();
    const image = repost.profileImage ? repost.profileImage : `https://web3-images-api.kibalabs.com/v1/accounts/${repost.user}/image`;
    const repostNotification = await db.collection('users').doc(post.user).collection('notifications').add({
        "image": image,
        "link": `https://airtist.xyz/p/${repost.postId}`,
        "timestamp": firebase.firestore.FieldValue.serverTimestamp(),
        "name": repost.name ? repost.name : abbrAddress(repost.user),
        "text": ` reposted your post `,
        "textLink": post.title ? post.title : ""
    });
} // newLike

module.exports.updateUser = async function(change, context) {
    const userBefore = change.before.data();
    const userAfter = change.after.data();
    if (userAfter.needApprovals) {
        // new contract get approvals
        if (userAfter.safeDeployed) {
            const nftAddress = userAfter.nftContract ? userAfter.nftContract : process.env.AIRTIST_ADDR;
            const resp = await doApprovals(userAfter.safeAddress, nftAddress);
            await change.after.ref.update({
                "needApprovals": false
            });
        }
    }
    if (userBefore.plan != userAfter.plan) {
        if (userAfter.plan == "pro") {
            // upgrade to pro
            var name = userAfter.nftContractName;
            var symbol = userAfter.nftContractSymbol;
            if (name && symbol) {
                const relayResponse = await deployNFTContractAndUpdateStream(name, symbol, userAfter.safeAddress);
                if ("taskId" in relayResponse) {
                    await change.after.ref.update({
                        "deployStatus": "pending",
                        "deployTaskId": relayResponse.taskId
                    });
                } else {
                    console.log("error: relay error", JSON.stringify(relayResponse));
                }
            } else {
                console.log("ERROR: trying to upgrade to pro without name & symbol", JSON.stringify(userAfter));
            }
        } else {
            // downgrade to free
            // 1. contract remains deployed (obvs), but flip user backed to shared contract
            await change.after.ref.update({
                "nftContractPro": userAfter.nftContract,
                "nftContract": process.env.AIRTIST_ADDR
            });
            await change.after.ref.collection('notifications').add({
                "image": userAfter.profileImage ? userAfter.profileImage : `https://web3-images-api.kibalabs.com/v1/accounts/${userAfter.address}/image`,
                "link": `https://airtist.xyz/`,
                "timestamp": firebase.firestore.FieldValue.serverTimestamp(),
                "name": "",
                "text": `Your PRO plan has been cancelled`,
                "textLink": ""
            });
            // 2. reduce pAInt stream to 3 per month
            const relayResponse = await updateStream(userAfter.safeAddress, THREE_PER_MONTH, 0);
        }
    }
    if (userBefore.deployToChain != userAfter.deployToChain) {
        if (!userAfter.nftContractName || !userAfter.nftContractSymbol || !userAfter.safeAddress) {
            console.log(`ERROR: trying to deploy to chain but missing data on user doc`);
            return;
        }
        const relayResponse = await deployNFTContract(userAfter.nftContractName, userAfter.nftContractSymbol, userAfter.safeAddress, userAfter.deployToChain);
        console.log("remoteDeploy relayResponse", relayResponse);
        var updates = {};
        if ("taskId" in relayResponse) {
            updates.deployStatus = "pending";
            updates.deployTaskId = relayResponse.taskId;
        }
        await change.after.ref.update(updates);
    }
    return;
} // updateUser

module.exports.cronMint = async function(context) {
    console.log('This will be run every 1 minutes!');
    // 1. check mintTasks
    db.collection("posts").where("mintStatus", "==", "pending")
        .get()
        .then((querySnapshot) => {
            querySnapshot.forEach(async (doc) => {
                const post = doc.data();
                post.id = doc.id;
                console.log("post", doc.id, JSON.stringify(post));
                if ("mintTaskId" in post) {
                    const task = await relay.getTaskStatus(post.mintTaskId);
                    console.log("mintTask status", JSON.stringify(task));
                    if (task.taskState == "ExecSuccess") {
                        if ("transactionHash" in task) {
                            const tx = await provider.getTransactionReceipt(task.transactionHash);
                            console.log("tx", JSON.stringify(tx));
                            const nft = new ethers.Contract(post.nftContract, nftJSON.abi, provider);
                            for (let i = 0; i < tx.logs.length; i++) {
                                const log = tx.logs[i];
                                if (log.address.toLowerCase() == post.nftContract.toLowerCase()) {
                                    const event = nft.interface.parseLog(log);
                                    console.log("event", JSON.stringify(event));
                                    if (event.name == "Transfer") {
                                        console.log("event.args.tokenId", event.args.tokenId);
                                        post.tokenId = parseInt(event.args.tokenId);
                                        await doc.ref.update({
                                            "mintStatus": "minted",
                                            "minted": true,
                                            "tokenId": parseInt(event.args.tokenId)
                                        });
                                        var notifyCreator = true;
                                        if ("minterAddress" in post) {
                                            if (post.mintChain == post.chain) {
                                                const minterNotification = await db.collection('users').doc(post.minterAddress.toLowerCase()).collection('notifications').add({
                                                    "image": `https://api.airtist.xyz/images/${post.id}.png`,
                                                    "link": `https://testnets.opensea.io/assets/goerli/${post.nftContract}/${post.tokenId}`,
                                                    "timestamp": firebase.firestore.FieldValue.serverTimestamp(),
                                                    "text": `Minting has completed. `,
                                                    "textLink": "View on Opensea"
                                                });
                                            } else {
                                                await transportNFT(doc, post);
                                            }
                                            if (post.minterAddress.toLowerCase() == post.user.toLowerCase()) {
                                                notifyCreator = false;
                                            }
                                        } else {
                                            if (post.mintChain == post.chain) {
                                                // noop
                                            } else {
                                                await transportNFT(doc, post);
                                            }
                                        }
                                        if (notifyCreator) {
                                            const creatorNotification = await db.collection('users').doc(post.user).collection('notifications').add({
                                                "image": `https://api.airtist.xyz/images/${post.id}.png`,
                                                "link": `https://testnets.opensea.io/assets/goerli/${post.nftContract}/${post.tokenId}`,
                                                "timestamp": firebase.firestore.FieldValue.serverTimestamp(),
                                                "text": `Your post has been minted. `,
                                                "textLink": "View on Opensea"
                                            });
                                        }
                                        const creatorDoc = await db.collection('users').doc(post.user).get();
                                        if (creatorDoc.exists) {
                                            await getBalances(creatorDoc.data());
                                        }
                                        if ("minterAddress" in post) {
                                            const minterDoc = await db.collection('users').doc(post.minterAddress).get();
                                            if (minterDoc.exists) {
                                                await getBalances(minterDoc.data());
                                            }
                                        }
                                    }
                                }
                            }

                        }
                    } else if (task.taskState == "Cancelled") {
                        await doc.ref.update({
                            "mintStatus": "cancelled"
                        });
                    }
                }
            });
        });

} // cronMint

module.exports.cronTransport = async function(context) {
    console.log('This will be run every 1 minutes!');
    // 1. check mintTasks
    db.collection("posts").where("transportStatus", "==", "pending")
        .get()
        .then((querySnapshot) => {
            querySnapshot.forEach(async (doc) => {
                const post = doc.data();
                post.id = doc.id;
                console.log("post", doc.id, JSON.stringify(post));
                if ("transportTransactionHash" in post) {
                    const txHash = post.transportTransactionHash;
                    const axelarStatus = await axelarGMP.queryTransactionStatus(txHash);
                    console.log('axelar status', JSON.stringify(axelarStatus));
                    if (axelarStatus.status == "destination_executed") {
                        await doc.ref.update({
                            "transportStatus": "transported",
                            "transportArrivalTransactionHash": axelarStatus.executed.transactionHash,
                            "chain": parseInt(post.mintChain)
                        });
                        const minterAddress = post.minterAddress ? post.minterAddress : post.user;
                        const slug = openSeaSlugs[post.mintChain];
                        const creatorNotification = await db.collection('users').doc(minterAddress).collection('notifications').add({
                            "image": `https://api.airtist.xyz/images/${post.id}.png`,
                            "link": `https://testnets.opensea.io/assets/${slug}/${post.nftContract}/${post.tokenId}`,
                            "timestamp": firebase.firestore.FieldValue.serverTimestamp(),
                            "text": `Your post has been transported. `,
                            "textLink": "View on Opensea"
                        });
                    }
                } else {
                    if ("transportTaskId" in post) {
                        const task = await relay.getTaskStatus(post.transportTaskId);
                        console.log("transportTask status", JSON.stringify(task));
                        if (task.taskState == "ExecSuccess") {
                            if ("transactionHash" in task) {
                                await doc.ref.update({
                                    "transportTransactionHash": task.transactionHash,
                                });
                            }
                        } else if (task.taskState == "Cancelled") {
                            await doc.ref.update({
                                "transportStatus": "cancelled"
                            });
                        }
                    }
                }
            });
        });

} // cronTransport

module.exports.cronDeploy = async function(context) {
    console.log('This will be run every 2 minutes!');
    // 1. check deployTasks
    db.collection("users").where("deployStatus", "==", "pending")
        .get()
        .then((querySnapshot) => {
            querySnapshot.forEach(async (doc) => {
                const user = doc.data();
                console.log("user", doc.id, JSON.stringify(user));
                if ("deployTaskId" in user) {
                    const task = await relay.getTaskStatus(user.deployTaskId);
                    console.log("deployTask status", JSON.stringify(task));
                    if (task.taskState == "ExecSuccess") {
                        if ("transactionHash" in task) {
                            const deployProvider = providers[task.chainId];
                            const tx = await deployProvider.getTransactionReceipt(task.transactionHash);
                            console.log("tx", JSON.stringify(tx));
                            const factory = new ethers.Contract(process.env.AIRTIST_FACTORY, factoryJSON.abi, deployProvider);
                            for (let i = 0; i < tx.logs.length; i++) {
                                const log = tx.logs[i];
                                if (log.address.toLowerCase() == process.env.AIRTIST_FACTORY.toLowerCase()) {
                                    const event = factory.interface.parseLog(log);
                                    console.log("event", JSON.stringify(event));
                                    if (event.name == "AIrtNFTCreated") {
                                        console.log("event.args.nftContract", event.args.nftContract);
                                        if ("nftContract" in user) {
                                            // user already has their own contract -- new remote contract should match same address
                                            if (user.nftContract != event.args.nftContract.toLowerCase()) {
                                                console.log(`ERROR: deployed remote contract has different address from home chain`, user.nftContract, event.args.nftContract.toLowerCase());
                                            }
                                        }
                                        var updates = {
                                            "nftContract": event.args.nftContract.toLowerCase(),
                                            "deployStatus": "deployed",
                                            "deployedChains": firebase.firestore.FieldValue.arrayUnion(task.chainId)
                                        };
                                        if (task.chainId == defaultChainId) {
                                            updates.needApprovals = true;
                                        }
                                        const relayResponse = await grantTransporterRole(event.args.nftContract, task.chainId);
                                        console.log("role relayResponse", relayResponse);
                                        if ("taskId" in relayResponse) {
                                            updates.roleStatus = "pending";
                                            updates.roleTaskId = relayResponse.taskId;
                                        }
                                        await doc.ref.update(updates);
                                        if (task.chainId == defaultChainId) {
                                            await doc.ref.collection('notifications').add({
                                                "image": user.profileImage ? user.profileImage : `https://web3-images-api.kibalabs.com/v1/accounts/${user.address}/image`,
                                                "link": `https://airtist.xyz/`,
                                                "timestamp": firebase.firestore.FieldValue.serverTimestamp(),
                                                "name": "",
                                                "text": `Upgrade to PRO plan is complete`,
                                                "textLink": ""
                                            });
                                            await getBalances(user);
                                        }
                                    }
                                }
                            }

                        }
                    }
                }
            });
        });

} // cronDeploy

module.exports.cronRole = async function(context) {
    console.log('This will be run every 2 minutes!');
    // 1. check deployTasks
    db.collection("users").where("roleStatus", "==", "pending")
        .get()
        .then((querySnapshot) => {
            querySnapshot.forEach(async (doc) => {
                const user = doc.data();
                console.log("user", doc.id, JSON.stringify(user));
                if ("roleTaskId" in user) {
                    const task = await relay.getTaskStatus(user.roleTaskId);
                    console.log("roleTask status", JSON.stringify(task));
                    if (task.taskState == "ExecSuccess") {
                        if ("transactionHash" in task) {
                            const deployProvider = providers[task.chainId];
                            const tx = await deployProvider.getTransactionReceipt(task.transactionHash);
                            console.log("tx", JSON.stringify(tx));
                            const nft = new ethers.Contract(user.nftContract, nftJSON.abi, deployProvider);
                            for (let i = 0; i < tx.logs.length; i++) {
                                const log = tx.logs[i];
                                if (log.address.toLowerCase() == user.nftContract.toLowerCase()) {
                                    const event = nft.interface.parseLog(log);
                                    console.log("event", JSON.stringify(event));
                                    if (event.name == "RoleGranted") {
                                        var updates = {
                                            "roleStatus": "granted"
                                        };
                                        await doc.ref.update(updates);
                                        if ("transportPostId" in user) {
                                            // now that role granted, time to transport
                                            console.log(`need to transport ${user.transportPostId}`);
                                            const docRef = db.collection('posts').doc(user.transportPostId);
                                            const postDoc = await docRef.get();
                                            if (postDoc.exists) {
                                                console.log("post exists");
                                                const post = postDoc.data();
                                                post.id = postDoc.id;
                                                await transportNFT(postDoc, post);
                                            }
                                        }
                                    }
                                }
                            }

                        }
                    }
                }
            });
        });

} // cronRole

