const web3authClientID = 'BPk-3YzQE-6R3H0WZcmEAeioyORW5xyGQbo7ORuEDEiqZoDqzWeTQNobjkt8G-LzIwHa1fpcR-vjaJFPJvSEzjM';
const rpcUrl = 'https://eth-goerli.alchemyapi.io/v2/n_mDCfTpJ8I959arPP7PwiOptjubLm57';
const chainId = '0x5'; // goerli

const firebaseConfig = {
    apiKey: "AIzaSyC9d9wf4CCvhx5RTbd_c4tioil1U-LOqNY",
    authDomain: "airtist-xyz.firebaseapp.com",
    projectId: "airtist-xyz",
    storageBucket: "airtist-xyz.appspot.com",
    messagingSenderId: "38287061985",
    appId: "1:38287061985:web:be757f64fda3260aae98a0"
  };
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
var resetFeed;

const path = window.location.pathname.split('/');
console.log(path);

if (path[1] == "profile") {
    console.log("show profile for " + path[2]);
}
if (path[1] == "p") {
    console.log("show post for " + path[2]);
}

let web3auth = null;
let provider = null;

(async function init() {
    $(".btn-logged-in").hide();
    $("#sign-tx").hide();

    const clientId = web3authClientID;

    web3auth = new window.Modal.Web3Auth({
        clientId,
        chainConfig: {
            chainNamespace: "eip155",
            chainId: chainId,
            rpcTarget: rpcUrl
        },
        web3AuthNetwork: "testnet",
    });

    const metamaskAdapter = new window.MetamaskAdapter.MetamaskAdapter({
        clientId,
        sessionTime: 86400, // 1 day in secondss
        web3AuthNetwork: "testnet",
        chainConfig: {
            chainNamespace: "eip155",
            chainId: chainId,
            rpcTarget: rpcUrl
        },
    });
    web3auth.configureAdapter(metamaskAdapter);

    const walletConnectAdapter =
        new window.WalletConnectV1Adapter.WalletConnectV1Adapter({
            adapterSettings: {
                bridge: "https://bridge.walletconnect.org"
            },
            clientId
        });
    web3auth.configureAdapter(walletConnectAdapter);

    await web3auth.initModal();
    if (web3auth.provider) {
        $(".btn-logged-in").show();
        $(".btn-logged-out").hide();
        if (web3auth.connectedAdapterName === "openlogin") {
        $("#sign-tx").show();
        }
    } else {
        $(".btn-logged-out").show();
        $(".btn-logged-in").hide();
    }
})(); // init()

function uiConsole(...args) {
    const el = document.querySelector("#console>p");
    if (el) {
        el.innerHTML = JSON.stringify(args || {}, null, 2);
    }
    console.log(JSON.stringify(args || {}, null, 2));
}

function loadFeed () {
    if (resetFeed) {
        resetFeed();
    }
    resetFeed = db.collection("posts").orderBy("timestamp", "asc")
        .onSnapshot((querySnapshot) => {
            querySnapshot.forEach((doc) => {
                console.log("post", JSON.stringify(doc.data()));
                var meta = doc.data();
                meta.id = doc.id;
                if ( $( "#post-" + doc.id ).length <= 0 ) {
                    $("#feed-posts").prepend( getFeedPostHTML(meta) );
                } else {
                    $( "#post-" + doc.id ).replaceWith( getFeedPostHTML(meta) );
                }

                doc.ref.collection("comments").orderBy("timestamp", "asc")
                    .onSnapshot((querySnapshot) => {
                        querySnapshot.forEach((comment) => {
                            console.log("comment", JSON.stringify(comment.data()));
                            var c = comment.data();
                            c.id = comment.id;
                            $(`#comments-${doc.id}`).append( getCommentHTML(c) );
                        });
                    });
            });
    });
}

async function getHeaders() {
    return new Promise(async (resolve, reject) => {
        const id_token = await web3auth.authenticateUser();
        uiConsole(id_token);
        var social = true;
        const user = await web3auth.getUserInfo();
        uiConsole(user);
        if ($.isEmptyObject(user)) {
            social = false;
        }
        const headers = {
            'Authorization': 'Bearer ' + id_token.idToken, 
            'X-web3Auth-Social': social,
            'Content-Type': 'application/json'
        };
        resolve(headers);
    });
}

async function postArt(data) {
    const headers = await getHeaders();
    const res = await fetch('/api/post', { 
        method: 'POST', 
        headers: new Headers(headers), 
        body: JSON.stringify(data)
    });
    var result = await res.json();
    uiConsole(result);
    $("button.uk-offcanvas-close").click();
    $("#post").text("Post");
    // TODO: reset fields
    var image = new Image();
	image.src = `/images/${result.id}.png`;
    loadFeed();
}

async function comment(data) {
    const headers = await getHeaders();
    const res = await fetch('/api/comment', { 
        method: 'POST', 
        headers: new Headers(headers), 
        body: JSON.stringify(data)
    });
    var result = await res.json();
    uiConsole(result);
    // TODO: reset field
    $(`#comments-${data.id}`).append( getCommentHTML(result) );
    $(`#comment-text-${data.id}`).val('');
}

async function like(data) {
    const headers = await getHeaders();
    const res = await fetch('/api/like', { 
        method: 'POST', 
        headers: new Headers(headers), 
        body: JSON.stringify(data)
    });
    var result = await res.json();
    uiConsole(result);
    updateLikes(data.id);
}

async function updateLikes(id) {
    // TODO:
}

$( document ).ready(function() {

    loadFeed();

    $("#loginOLD").click(async function (event) {
        console.log("login button clicked!");
        try {
            const provider = await web3auth.connect();
            $(".btn-logged-out").hide();
            $(".btn-logged-in").show();
            uiConsole("Logged in Successfully!");
            const id_token = await web3auth.authenticateUser();
            uiConsole(id_token);
            const ethersProvider = new ethers.providers.Web3Provider(provider);
            const signer = ethersProvider.getSigner();
            const address = await signer.getAddress();
            uiConsole(address);
            var social = true;
            const user = await web3auth.getUserInfo();
            uiConsole(user);
            if ($.isEmptyObject(user)) {
                social = false;
            }
            // TODO: store JWT locally
            id_token.social = social;
            id_token.address = address;
            const res = await fetch('/api/post', { 
                method: 'POST', 
                headers: new Headers({
                    'Authorization': 'Bearer ' + id_token.idToken, 
                    'X-web3Auth-Social': social,
                    'Content-Type': 'application/json'
                }), 
                body: JSON.stringify({"foo": "bar"})
            });
            var result = await res.json();
            uiConsole(result);
        } catch (error) {
            console.error(error.message);
        }
    });

    $("#login").click(async function (event) {
        console.log("login button clicked!");
        try {
            const provider = await web3auth.connect();
            $(".btn-logged-out").hide();
            $(".btn-logged-in").show();
            uiConsole("Logged in Successfully!");
            const user = await web3auth.getUserInfo();
            uiConsole(user);
            if ($.isEmptyObject(user)) {
                // TODO: ?
            } else {
                if ("profileImage" in user) {
                    $("img.header-avatar").attr("src", user.profileImage);
                }
            }
        } catch (error) {
            console.error(error.message);
        }
    });

    $("#post").click(async function(){
        console.log("post!");
        $(this).text("Posting...");
        var data = {};
        data.prompt = $("#prompt").val();
        if (!data.prompt) {
            // TODO: error, promptm required
            return false;
        }
        data.title = $("#title").val();
        data.mintable = $("#mintable").val();
        if (data.mintable) {
            data.mintable = true;
        }
        // TODO: other fields
        postArt(data);
        return false;
    });

    $( "#feed-posts" ).on( "click", ".comment-button", async function(e) {
        e.preventDefault();
        console.log("comment!");
        var data = {};
        data.id = $(this).data('id');
        data.comment = $(`#comment-text-${data.id}`).val();
        if (!data.comment) {
            // TODO: error, comment required
            return false;
        }
        comment(data);
        return false;
    });

    $( "#feed-posts" ).on( "click", ".like-button", async function(e) {
        e.preventDefault();
        console.log("like!");
        var data = {};
        data.id = $(this).data('id');
        like(data);
        $(this).find('svg').attr("fill", "red");
        $(this).find('.like-button-text').text(" Liked");
        return false;
    });

    $("#logout").click(async function (event) {
        try {
            await web3auth.logout();
            $(".btn-logged-in").hide();
            $(".btn-logged-out").show();
        } catch (error) {
            console.error(error.message);
        }
    });






    $("#get-user-info").click(async function (event) {
    try {
        const user = await web3auth.getUserInfo();
        uiConsole(user);
    } catch (error) {
        console.error(error.message);
    }
    });

    $("#get-id-token").click(async function (event) {
    try {
        const id_token = await web3auth.authenticateUser();
        uiConsole(id_token);
    } catch (error) {
        console.error(error.message);
    }
    });

    $("#get-chain-id").click(async function (event) {
    try {
        const chainId = await rpc.getChainId(web3auth.provider);
        uiConsole(chainId);
    } catch (error) {
        console.error(error.message);
    }
    });

    $("#get-accounts").click(async function (event) {
    try {
        const accounts = await rpc.getAccounts(web3auth.provider);
        uiConsole(accounts);
    } catch (error) {
        console.error(error.message);
    }
    });

    $("#get-balance").click(async function (event) {
    try {
        const balance = await rpc.getBalance(web3auth.provider);
        uiConsole(balance);
    } catch (error) {
        console.error(error.message);
    }
    });

    $("#send-transaction").click(async function (event) {
    try {
        const receipt = await rpc.sendTransaction(web3auth.provider);
        uiConsole(receipt);
    } catch (error) {
        console.error(error.message);
    }
    });

    $("#sign-message").click(async function (event) {
    try {
        const signedMsg = await rpc.signMessage(web3auth.provider);
        uiConsole(signedMsg);
    } catch (error) {
        console.error(error.message);
    }
    });

    $("#get-private-key").click(async function (event) {
    try {
        const privateKey = await rpc.getPrivateKey(web3auth.provider);
        uiConsole(privateKey);
    } catch (error) {
        console.error(error.message);
    }
    });

}); // docReady

function abbrAddress(address){
    return address.slice(0,4) + "..." + address.slice(address.length - 4);
}

function getFeedPostHTML(data) {
    var html = '';
    if (!data.name) {
        data.name = abbrAddress(data.user);
    }
    if (!data.profileImage) {
        data.profileImage = "https://web3-images-api.kibalabs.com/v1/accounts/" + data.user + "/image";
    }
    html = `
    <!-- post 1-->
    <div id="post-${data.id}" class="bg-white shadow rounded-md dark:bg-gray-900 -mx-2 lg:mx-0">

        <!-- post header-->
        <div class="flex justify-between items-center px-4 py-3">
            <div class="flex flex-1 items-center space-x-4">
                <a href="#">
                    <div class="bg-gradient-to-tr from-yellow-600 to-pink-600 p-0.5 rounded-full">  
                        <img src="${data.profileImage}" class="bg-gray-200 border border-white rounded-full w-8 h-8">
                    </div>
                </a>
                <span class="block capitalize font-semibold dark:text-gray-100"> ${data.name} </span>
            </div>
        <div>
            <a href="#"> <i class="icon-feather-more-horizontal text-2xl hover:bg-gray-200 rounded-full p-2 transition -mr-1 dark:hover:bg-gray-700"></i> </a>
            <div class="bg-white w-56 shadow-md mx-auto p-2 mt-12 rounded-md text-gray-500 hidden text-base border border-gray-100 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700" uk-drop="mode: hover;pos: top-right">
        
                <ul class="space-y-1">
                <li> 
                    <a href="#" class="flex items-center px-3 py-2 hover:bg-gray-200 hover:text-gray-800 rounded-md dark:hover:bg-gray-800">
                        <i class="uil-share-alt mr-1"></i> Share
                    </a> 
                </li>
                <li> 
                    <a href="#" class="flex items-center px-3 py-2 hover:bg-gray-200 hover:text-gray-800 rounded-md dark:hover:bg-gray-800">
                        <i class="uil-edit-alt mr-1"></i>  Edit Post 
                    </a> 
                </li>
                <li> 
                    <a href="#" class="flex items-center px-3 py-2 hover:bg-gray-200 hover:text-gray-800 rounded-md dark:hover:bg-gray-800">
                        <i class="uil-favorite mr-1"></i>  Add favorites 
                    </a> 
                </li>
                <li>
                    <hr class="-mx-2 my-2 dark:border-gray-800">
                </li>
                </ul>
            
            </div>
        </div>
        </div>

        <div uk-lightbox>
            <a href="/images/${data.id}.png">  
                <img src="/images/${data.id}.png" alt="" style="width:100%;">
            </a>
        </div>
        

        <div class="py-3 px-4 space-y-3"> 
            
            <div class="flex space-x-4 lg:font-bold">
                <a href="#" data-id="${data.id}" class="like-button like flex items-center space-x-2">
                    <div class="p-2 rounded-full text-black">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="22" height="22" class="dark:text-gray-100">
                            <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                        </svg>
                    </div>
                    <div class="like-button-text"> Like</div>
                </a>
                <a href="#" data-id="${data.id}" class="flex items-center space-x-2">
                    <div class="p-2 rounded-full text-black">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="22" height="22" class="dark:text-gray-100">
                            <path fill-rule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clip-rule="evenodd" />
                        </svg>
                    </div>
                    <div> Comment</div>
                </a>
                <a href="#" class="flex items-center space-x-2 flex-1 justify-end">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="22" height="22" class="dark:text-gray-100">
                        <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                    </svg>
                    <div> Share</div>
                </a>
            </div>
            <div class="flex items-center space-x-3"> 
                <div class="flex items-center">
                    <img src="/assets/images/avatars/avatar-1.jpg" alt="" class="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900">
                    <img src="/assets/images/avatars/avatar-4.jpg" alt="" class="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900 -ml-2">
                    <img src="/assets/images/avatars/avatar-2.jpg" alt="" class="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900 -ml-2">
                </div>
                <div class="dark:text-gray-100">
                    Liked <strong> Johnson</strong> and <strong> 209 Others </strong>
                </div>
            </div>

            <div id="comments-${data.id}" class="border-t pt-4 space-y-4 dark:border-gray-600">

            </div>

            <div class="bg-gray-100 bg-gray-100 rounded-full rounded-md relative dark:bg-gray-800">
                <input type="text" id="comment-text-${data.id}" data-id="${data.id}" placeholder="Add your Comment.." class="bg-transparent max-h-10 shadow-none">
                <div class="absolute bottom-0 flex h-full items-center right-0 right-3 text-xl space-x-2">
                    <a href="#" data-id="${data.id}" class="comment-button"> <i class="uil-arrow-circle-right"></i></a>
                </div>
            </div>

        </div>

    </div>
    `;
    return html;
}

function getCommentHTML(data) {
    html = '';
    html = `
    <div id="comment-${data.id}" class="flex">
        <div class="w-10 h-10 rounded-full relative flex-shrink-0">
            <img src="${data.profileImage}" alt="" class="absolute h-full rounded-full w-full">
        </div>
        <div class="text-gray-700 py-2 px-3 rounded-md bg-gray-100 h-full relative lg:ml-5 ml-2 lg:mr-20  dark:bg-gray-800 dark:text-gray-100">
            <p class="leading-6">${data.comment}</p>
            <div class="absolute w-3 h-3 top-3 -left-1 bg-gray-100 transform rotate-45 dark:bg-gray-800"></div>
        </div>
    </div>
    `;
    return html;
}
