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

//import { ethers } from 'ethers'
//import safeEthersLib from '@safe-global/safe-ethers-lib'
//const EthersAdapter = safeEthersLib.default;

//import { SafeAccountConfig } from '@safe-global/safe-core-sdk'
//import pkg from '@safe-global/safe-core-sdk';
//const { SafeAccountConfig } = pkg;
//import { SafeFactory } from '@safe-global/safe-core-sdk'

const safeCoreSDK = require('@safe-global/safe-core-sdk');
const Safe = safeCoreSDK.default;
const SafeFactory = safeCoreSDK.SafeFactory;
const safeEthersLib = require('@safe-global/safe-ethers-lib');
const EthersAdapter = safeEthersLib.default;

const relayKit = require('@safe-global/relay-kit');
//console.log("relayKit", relayKit);
const GelatoRelayAdapter = relayKit.GelatoRelayAdapter;
//console.log("GelatoRelayAdapter", GelatoRelayAdapter);
const relayAdapter = new GelatoRelayAdapter(process.env.GELATO_API_KEY);
//console.log(relayAdapter);

//import { GelatoRelaySDK } from "@gelatonetwork/relay-sdk";
const GelatoRelaySDK = require("@gelatonetwork/relay-sdk");
//console.log("GelatoRelaySDK", GelatoRelaySDK);
const relay = new GelatoRelaySDK.GelatoRelay();
//console.log("relay", relay);

const fetch = require('node-fetch');

const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const provider = new ethers.providers.JsonRpcProvider({"url": process.env.API_URL_GOERLI});
var providers = [];
providers[0] = provider;
var signer;
var ensProvider = new ethers.providers.JsonRpcProvider({"url": "https://" + process.env.RPC_ETH});

const jwksSocial = 'https://api.openlogin.com/jwks';
const jwksExternal = 'https://authjs.web3auth.io/jwks';

function getContracts(pk, provider) {
    signer = new ethers.Wallet(pk, provider);
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

async function generate(prompt, id) {
    return new Promise(async (resolve, reject) => {
      const aiResponse = await openai.createImage({
        "prompt": prompt,
        "n": 1,
        "size": '512x512' // TODO: increase for production?
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
            data.postCount = 0;
            data.followerCount = 0;
            data.followingCount = 0;
            await db.collection('users').doc(address).set(data);
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
    data.user = req.user.address;
    data.name = req.user.name ? req.user.name: '';
    data.profileImage = req.user.profileImage ? req.user.profileImage : '';
    data.timestamp = firebase.firestore.FieldValue.serverTimestamp();
    data.minted = false;
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
        commentCount: firebase.firestore.FieldValue.increment(1)
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
        likeCount: firebase.firestore.FieldValue.increment(1)
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

api.get('/images/:id.png', async function (req, res) {
    console.log("start /images/ with path", req.path);
    const id = req.params.id;
    var cache = 'public, max-age=3600, s-maxage=86400';
  
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

module.exports.newPost = async function(snap, context) {
    const post = snap.data();
    const mintIt = post.selfmint;
    console.log("mintIt is " + mintIt, JSON.stringify(post));
    if (mintIt) {
        const postDoc = snap.ref;
        console.log('needs minting');
        const userDoc = await db.collection('users').doc(post.user).get();
        if (userDoc.exists) {
            const user = userDoc.data();
            const signer = new ethers.Wallet(process.env.AIRTIST_HOT_PRIV, provider);
            if (user.safeDeployed == false) {
                // first, deploy the safe
                const safeAddress = await getSafeAddress(user.address, true);
                if (safeAddress != user.safeAddress) {
                    console.log(`address of deployed safe (${safeAddress}) does not match predicted address (${user.safeAddress}) for user ${user.address}`);
                }
                // TODO: send enableFallback Txn for Safe
                const ethAdapter = new EthersAdapter({
                    "ethers": ethers,
                    "signerOrProvider": signer
                });
                const safeSDK = await Safe.create({ "ethAdapter": ethAdapter, "safeAddress": safeAddress });
                //const safeTransaction = safeSDK.createEnableFallbackHandlerTx(process.env.FALLBACK_HANDLER_ADDR);
                //const signedSafeTransaction = await safeSDK.signTransaction(safeTransaction);
                //console.log("signedSafeTransaction", JSON.stringify(signedSafeTransaction));
                //const executeTxResponse = await safeSDK.executeTransaction(signedSafeTransaction);
                //console.log("executeTxResponse", JSON.stringify(executeTxResponse));

                // approve txn data. TODO: fill in contracts for $AIrt and $WETH
                const approveABI = ["function approve(address spender, uint256 amount)"];
                const data = ""; // TODO: finish this later
                const approveTransactionData = [
                    {
                        "to": process.env.AIRTIST_ADDR,
                        "data": data,
                        "value": 0
                    },
                    {
                        "to": process.env.AIRTIST_ADDR,
                        "data": data,
                        "value": 0
                    }
                ];
                // TODO: rest of approval steps: create, sign, execute

                // update user doc
                await userDoc.ref.update({
                    "safeDeployed": true
                });
            } // if safe deployed

            // relay the mint
            const abi = ["function safeMint(address to)"];
            // Generate the target payload
            const contract = new ethers.Contract(process.env.AIRTIST_ADDR, abi, signer);
            console.log("user.safeAddres", user.safeAddress);
            const { data } = await contract.populateTransaction.safeMint(user.safeAddress);
            console.log(data);
            const network = await provider.getNetwork();
            const request = {
                "chainId": network.chainId,
                "target": process.env.AIRTIST_ADDR,
                "data": data,
                "user": await signer.getAddress()
            };
            console.log("request", request);
            const relayResponse = await relay.sponsoredCallERC2771(
                request,
                signer,
                process.env.GELATO_API_KEY
            );
            if ("taskId" in relayResponse) {
                await userDoc.ref.update({
                    "mintTaskId": relayResponse.taskId
                });
            } else {
                console.log("error: relay error", JSON.stringify(relayResponse));
            }
        } else {
            console.log("user not found for " + post.user);
        } // if user
    }
    return;
} // newPost

//export async function api(req, res) {
module.exports.apiOld = async function(req,res) {
    //console.log("provider", provider);

    const network = await provider.getNetwork();
    //console.log(network);

    if (process.env.AIRTIST_HOT_PRIV == null) {
        console.log("mising pk");
    }
    if (!process.env.AIRTIST_HOT_PRIV) {
        console.log("!mising pk");
    }
    if (process.env.AIRTIST_HOT_PRIV == '') {
        console.log("mising pk empyt string");
    }

    // Initialize signers
    const owner1Signer = new ethers.Wallet(process.env.AIRTIST_HOT_PRIV, provider);
    const signer = new ethers.Wallet(process.env.AIRTIST_HOT_PRIV, provider);
    //const owner2Signer = new ethers.Wallet(process.env.OWNER_2_PRIVATE_KEY!, provider);
    //const owner3Signer = new ethers.Wallet(process.env.OWNER_3_PRIVATE_KEY!, provider);
    //console.log(EthersAdapter);
    //console.log("owner1Signer", owner1Signer);
    //console.log("signer", signer);
    const ethAdapter = new EthersAdapter({
        "ethers": ethers,
        "signerOrProvider": owner1Signer
    });
    //console.log(ethAdapter);
    //console.log(SafeFactory);
    //console.log(ethAdapterOwner1);
    //const safeFactory = await SafeFactory.create({ ethAdapterOwner1 });
    const safeFactory = await SafeFactory.create({ "ethAdapter": ethAdapter });
    var owners = [await owner1Signer.getAddress(), process.env.SIDEDOOR_HOT, process.env.SIDEDOOR_COLD];
    console.log(owners);
    const threshold = 1;
    const safeAccountConfig = {
        "owners": owners,
        "threshold": threshold
    };
    const safeDeploymentConfig = {
        //"saltNonce": EOAaddress    // TODO: pass this from client web3auth
    }
    //const safeSdkOwner1 = await safeFactory.deploySafe({ safeAccountConfig });

    //const safeAddress = safeSdkOwner1.getAddress();
    const safeAddress = await getSafeAddress(process.env.SIDEDOOR_COLD, false);

    console.log('Your Safe has been deployed:');
    console.log(`https://goerli.etherscan.io/address/${safeAddress}`);
    console.log(`https://app.safe.global/gor:${safeAddress}`);

    //const abi = ["function mint(address to)"];
    const abi = ["function safeMint(address to)"];
    // Generate the target payload
    const contract = new ethers.Contract(process.env.AIRTIST_ADDR, abi, signer);
    const testAddress = "0x0F74e1B1b88Dfe9DE2dd5d066BE94345ab0590F1";
    const { data } = await contract.populateTransaction.safeMint(testAddress);
    console.log(data);

    const txnData = {
        "to": process.env.AIRTIST_ADDR,
        "data": data,
        "value": 0
    };
      
    if (false) {
    const safeSDK = await Safe.create({ "ethAdapter": ethAdapter, "safeAddress": safeAddress });
    //const safeSDK = await Safe.create({ ethAdapter, "safeAddress": "0xAd534BE4F45d6E61a4FfB2eb6eabF5EADB2BCF8c" });  // change this!!!
    const safeTransaction = await safeSDK.createTransaction({ "safeTransactionData": txnData });
    console.log("safeTransation", JSON.stringify(safeTransaction));
    console.log("safeTransation.data", JSON.stringify(safeTransaction.data));

    const signedSafeTransaction = await safeSDK.signTransaction(safeTransaction);
    console.log("signedSafeTransaction", JSON.stringify(signedSafeTransaction));
    //const executeTxResponse = await safeSDK.executeTransaction(signedSafeTransaction);
    //console.log("executeTxResponse", JSON.stringify(executeTxResponse));
    }

    const options = {
        isSponsored: true // This parameter is mandatory to use the 1Balance method
    }
    if (false) {
    const gelatoTask = await relayAdapter.relayTransaction({
        "target": process.env.AIRTIST_ADDR, 
        "encodedTransaction": data,
        "chainId": 5,
        options
    });
    console.log(gelatoTask);
    }


    const request = {
        "chainId": provider.network.chainId,
        "target": process.env.AIRTIST_ADDR,
        "data": data,
        "user": await signer.getAddress()
    };
    //const relayResponse = await relay.sponsoredCallERC2771(request, provider, process.env.GELATO_API_KEY);
    //const relayResponse = await relay.sponsoredCallERC2771(
    //    {"request": request},
    //    {"walletOrProvider": 
    //        {
    //            "provider": provider
    //        }
    //    },
    //    {"sponsorApiKey": process.env.GELATO_API_KEY}
    //);

    console.log("request", request);

    const relayResponse = await relay.sponsoredCallERC2771(
        request,
        signer,
        process.env.GELATO_API_KEY
    );
    
    return res.json({"safe": safeAddress, "task": relayResponse});
}