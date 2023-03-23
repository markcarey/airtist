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
var resetFeed, resetProfile, resetUsers;
var posts = {};
var users = {};
var loggedInUser;

const path = window.location.pathname.split('/');
var currentPage = "feed";
var idForPage = '';
console.log(path);

if (path[1]) {
    currentPage = path[1];
}
if (path[2]) {
    idForPage = path[2];
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
        loadUserProfile();
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

async function loadUserProfile () {
    const headers = await getHeaders();
    const res = await fetch('/api/profile', { 
        method: 'GET', 
        headers: new Headers(headers)
    });
    var user = await res.json();
    loggedInUser = user;
    if ("address" in user) {
        if (!user.profileImage) {
            user.profileImage = "https://web3-images-api.kibalabs.com/v1/accounts/" + data.address + "/image";
        }
        $("img.header-avatar").attr("src", user.profileImage);
        if (resetProfile) {
            resetProfile();
        }
        resetProfile = db.collection("users").where("address", "==", user.address)
            .onSnapshot((querySnapshot) => {
                querySnapshot.forEach((doc) => {
                    console.log("user", JSON.stringify(doc.data()));
                    var meta = doc.data();
                    users[meta.address] = meta;
                    if ( $( "#sidebar-profile" ).length <= 0 ) {
                        $("div.sidebar_inner").prepend( getSidebarProfileHTML(meta) );
                    } else {
                        $( "#sidebar-profile").replaceWith( getSidebarProfileHTML(meta) );
                    }
                    if (currentPage == "profile") {
                        if (!idForPage) {
                            loadProfile(meta.address);
                            if ( $( "#profile-cover" ).length <= 0 ) {
                                //$("#profile").prepend( getProfileCoverHTML(meta) );
                            } else {
                                //$( "#profile-cover").replaceWith( getProfileCoverHTML(meta) );
                            }
                        }
                    }
                });
            });
    } // if "address"
}

async function loadProfile (address) {
    if (resetProfile) {
        resetProfile();
    }
    resetProfile = db.collection("users").where("address", "==", address)
        .onSnapshot((querySnapshot) => {
            querySnapshot.forEach((doc) => {
                console.log("user", JSON.stringify(doc.data()));
                var meta = doc.data();
                users[meta.address] = meta;
                users[meta.address].doc = doc;
                if ( $( "#profile-cover" ).length <= 0 ) {
                    $("#profile").prepend( getProfileCoverHTML(meta) );
                } else {
                    $( "#profile-cover").replaceWith( getProfileCoverHTML(meta) );
                }
            });

            db.collection("posts").orderBy("timestamp", "asc").where("user", "==", address)
                .onSnapshot((querySnapshot) => {
                    var count = 0;
                    querySnapshot.forEach((doc) => {
                        count++;
                        console.log("post", JSON.stringify(doc.data()));
                        var meta = doc.data();
                        meta.id = doc.id;
                        posts[meta.id] = meta;
                        posts[meta.id].doc = doc;
                        if ( $( "#post-grid-" + doc.id ).length <= 0 ) {
                            meta.type = "post";
                            $("#grid-posts").prepend( getGridPostHTML(meta) );
                        } else {
                            meta.type = "post";
                            $( "#post-grid-" + doc.id ).replaceWith( getGridPostHTML(meta) );
                        }
                    });
                });



        });
}

async function loadUsers () {
    if (resetUsers) {
        resetUsers();
    }
    resetUsers = db.collection("users").orderBy("followerCount", "desc")
        .onSnapshot((querySnapshot) => {
            var count = 0;
            querySnapshot.forEach((doc) => {
                count++;
                console.log("user", JSON.stringify(doc.data()));
                var meta = doc.data();
                users[meta.address] = meta;
                if (count <= 5) {
                    if ( $( "#sidebar-user-" + doc.id ).length <= 0 ) {
                        $("#sidebar-users").prepend( getSidebarUserHTML(meta) );
                    } else {
                        $( "#sidebar-user-" + doc.id ).replaceWith( getSidebarUserHTML(meta) );
                    }
                }

                if ( $( "#trending-user-" + doc.id ).length <= 0 ) {
                    $("#trending-users").prepend( getTrendingUserHTML(meta) );
                } else {
                    $( "#trending-user-" + doc.id ).replaceWith( getTrendingUserHTML(meta) );
                }
            });
        });
}

function loadFeed () {
    if (resetFeed) {
        resetFeed();
    }
    resetFeed = db.collection("posts").orderBy("timestamp", "asc")
        .onSnapshot((querySnapshot) => {
            var count = 0;
            querySnapshot.forEach((doc) => {
                count++;
                console.log("post", JSON.stringify(doc.data()));
                var meta = doc.data();
                meta.id = doc.id;
                posts[meta.id] = meta;
                posts[meta.id].doc = doc;
                if ( $( "#post-" + doc.id ).length <= 0 ) {
                    $("#feed-posts").prepend( getFeedPostHTML(meta) );
                } else {
                    $( "#post-" + doc.id ).replaceWith( getFeedPostHTML(meta) );
                }
                if ( $( "#post-grid-" + doc.id ).length <= 0 ) {
                    meta.type = "post";
                    $("#grid-posts").prepend( getGridPostHTML(meta) );
                } else {
                    meta.type = "post";
                    $( "#post-grid-" + doc.id ).replaceWith( getGridPostHTML(meta) );
                }
                if ( $( "#trending-grid-" + doc.id ).length <= 0 ) {
                    meta.type = "trending";
                    $("#trending-grid").prepend( getGridPostHTML(meta) );
                } else {
                    meta.type = "trending";
                    $( "#trending-grid-" + doc.id ).replaceWith( getGridPostHTML(meta) );
                }
                if (count <= 10) {
                    if ( $( "#sidebar-trending-" + doc.id ).length <= 0 ) {
                        meta.type = "trending";
                        $("#sidebar-trending").prepend( getSidebarTrendingPostsHTML(meta) );
                    } else {
                        meta.type = "trending";
                        $( "#sidebar-trending-" + doc.id ).replaceWith( getSidebarTrendingPostsHTML(meta) );
                    }
                }

                doc.ref.collection("comments").orderBy("timestamp", "asc")
                    .onSnapshot((querySnapshot) => {
                        querySnapshot.forEach((comment) => {
                            console.log("comment", JSON.stringify(comment.data()));
                            var c = comment.data();
                            c.id = comment.id;
                            if ( $( "#comment-" + c.id ).length <= 0 ) {
                                $(`#comments-${doc.id}`).append( getCommentHTML(c) );
                            } else {
                                $( "#comment-" + c.id ).replaceWith( getCommentHTML(c) );
                            }
                        });
                    });

                doc.ref.collection("likes").orderBy("timestamp", "desc")
                    .onSnapshot(async (querySnapshot) => {
                        const html = await getLikeSummaryHTML(doc, querySnapshot);
                        $(`#like-summary-${doc.id}`).html(html);
                    });
            });
    });
}

async function getLikeSummaryHTML(doc, querySnapshot) {
    return new Promise(async (resolve, reject) => {
        var count = 0;
        var html = '';
        var first = '';
        await querySnapshot.forEach((like) => {
            count++;
            console.log("like", JSON.stringify(like.data()));
            var l = like.data();
            l.id = like.id;
            if (count == 1) {
                first = l.name;
                if (!first) {
                    first = abbrAddress(l.user);
                }
                if (!l.profileImage) {
                    l.profileImage = "https://web3-images-api.kibalabs.com/v1/accounts/" + l.user + "/image";
                }
                html += `
                <div id="like-avatars-${doc.id}" class="flex items-center">
                <img src="${l.profileImage}" alt="" class="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900">
                `;
            }
            if ( (count) > 1 && (count <= 3) ) {
                html += `<img src="${l.profileImage}" alt="" class="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900 -ml-2">`;
            }
        });
        if (count > 1) {
            html += `
                </div>
                <div class="like-summary dark:text-gray-100">
                    Liked by <strong>${first}</strong> and <strong> ${count-1} others </strong>
                </div>
            `;
        } else if (count == 1) {
            html += `
                </div>
                <div class="like-summary dark:text-gray-100">
                    Liked by <strong>${first}</strong>
                </div>
            `;
        }
        resolve(html);
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
    //$(`#comments-${data.id}`).append( getCommentHTML(result) );
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

async function postModal(data) {
    $("#story-modal").html( getModalHTML(data) );
    const doc = data.doc;
    await doc.ref.collection("likes").orderBy("timestamp", "desc")
        .onSnapshot(async (querySnapshot) => {
            const html = await getLikeSummaryHTML(doc, querySnapshot);
            console.log(html, doc.id);
            $(`#modal-like-summary-${doc.id}`).html(html);
        });
    await doc.ref.collection("comments").orderBy("timestamp", "asc")
        .onSnapshot(async (querySnapshot) => {
            querySnapshot.forEach((comment) => {
                console.log("comment", JSON.stringify(comment.data()));
                var c = comment.data();
                c.id = comment.id;
                if ( $( "#modal-comment-" + c.id ).length <= 0 ) {
                    $(`#modal-comments-${doc.id}`).append( getModalCommentHTML(c) );
                } else {
                    $( "#modal-comment-" + c.id ).replaceWith( getModalCommentHTML(c) );
                }
            });
        });
}

async function updateLikes(id) {
    // TODO:
}

$( document ).ready(function() {

    if (currentPage == "feed") {
        $(".view").hide();
        $("#feed").show();
    } else if (currentPage == "profile") {
        $(".view").hide();
        if (idForPage) {
            loadProfile(idForPage);
        }
        $("#profile").show();
    } else if (currentPage == "trending") {
        $(".view").hide();
        $("#trending").show();
    }

    loadFeed();
    loadUsers();

    //loadProfile();

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
                // Wallet user
                await web3auth.authenticateUser();
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

    $( "#feed-posts" ).on( "click", ".comment-link", async function(e) {
        e.preventDefault();
        var id = $(this).data('id');
        $(`#comment-text-${id}`).focus();
        return false;
    });

    $( "#story-modal" ).on( "click", ".comment-link", async function(e) {
        e.preventDefault();
        var id = $(this).data('id');
        $(`#modal-comment-text-${id}`).focus();
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

    $( "#feed-posts, #story-modal" ).on( "click", ".like-button", async function(e) {
        e.preventDefault();
        console.log("like!");
        var data = {};
        data.id = $(this).data('id');
        like(data);
        //$(this).find('svg').attr("fill", "red");
        $(this).find('i').css("color", "red");
        $(this).find('.like-button-text').text(" Liked");
        return false;
    });

    $( "#story-modal" ).on( "click", ".comment-button", async function(e) {
        e.preventDefault();
        console.log("comment!");
        var data = {};
        data.id = $(this).data('id');
        data.comment = $(`#modal-comment-text-${data.id}`).val();
        if (!data.comment) {
            // TODO: error, comment required
            return false;
        }
        comment(data);
        $(`#modal-comment-text-${data.id}`).val('');
        return false;
    });

    $( "#feed-posts, #grid-posts, #trending-grid, #sidebar-trending" ).on( "click", ".post-modal", async function(e) {
        console.log("post modal!");
        const id = $(this).data('id');
        var data = posts[id];
        postModal(data);
        return true;
    });

    $(".logout").click(async function (event) {
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
                   <div><i class="uil-heart mr-1" style="font-size: 130%;"></i><span class="like-button-text">Like</span></div>
                </a>
                <a href="#comment-text-${data.id}" data-id="${data.id}" class="comment-link flex items-center space-x-2">
                    <div><i class="uil-comment-alt-message mr-1" style="font-size: 130%;"></i>Comment</div>
                </a>
                <a href="#" data-id="${data.id}" class="mint flex items-center space-x-2 flex-1 justify-end">
                    <div><i class="uil-wallet mr-1" style="font-size: 130%;"></i>Mint</div>
                </a>
            </div>

            <div id="like-summary-${data.id}" class="flex items-center space-x-3"> 

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
    if (!data.name) {
        data.name = abbrAddress(data.user);
    }
    if (!data.profileImage) {
        data.profileImage = "https://web3-images-api.kibalabs.com/v1/accounts/" + data.user + "/image";
    }
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

function getSidebarProfileHTML(data) {
    var html = '';
    if (!data.name) {
        data.name = abbrAddress(data.address);
    }
    if (!data.profileImage) {
        data.profileImage = "https://web3-images-api.kibalabs.com/v1/accounts/" + data.user + "/image";
    }
    html = `
    <div id="sidebar-profile" class="flex flex-col items-center my-6 uk-visible@s">
        <div
            class="bg-gradient-to-tr from-yellow-600 to-pink-600 p-1 rounded-full transition m-0.5 mr-2  w-24 h-24">
            <img src="${data.profileImage}"
                class="user-avatar bg-gray-200 border-4 border-white rounded-full w-full h-full">
        </div>
        <a href="/profile/${data.user}" class="text-xl font-medium capitalize mt-4 uk-link-reset"> ${data.name}
        </a>
        <div class="flex justify-around w-full items-center text-center uk-link-reset text-gray-800 mt-6">
            <div>
                <a href="#">
                    <strong>Posts</strong>
                    <div> ${data.postCount ? data.postCount: 0}</div>
                </a>
            </div>
            <div>
                <a href="#">
                    <strong>Following</strong>
                    <div> ${data.followingCount ? data.followingCount : 0}</div>
                </a>
            </div>
            <div>
                <a href="#">
                    <strong>Followers</strong>
                    <div> ${data.followerCount ? data.followerCount : 0}</div>
                </a>
            </div>
        </div>
    </div>
    `;
    return html;    
}

function getGridPostHTML(data) {
  var html = '';
  if (!data.name) {
    data.name = abbrAddress(data.user);
  }
  if (!data.profileImage) {
    data.profileImage = "https://web3-images-api.kibalabs.com/v1/accounts/" + data.user + "/image";
  }
  html = `
  <div id="${data.type}-grid-${data.id}">
    <div
        class="bg-green-400 max-w-full lg:h-56 h-48 rounded-lg relative overflow-hidden shadow uk-transition-toggle">
        <a href="#story-modal" class="post-modal" data-id="${data.id}" uk-toggle>
            <img src="/images/${data.id}.png" class="w-full h-full absolute object-cover inset-0">
        </a>
        <div
            class="flex flex-1 items-center absolute bottom-0 w-full p-3 text-white custom-overly1 uk-transition-slide-bottom-medium">
            <a href="#" class="lg:flex flex-1 items-center hidden">
                <div> ${data.name} </div>
            </a>
            <div class="flex space-x-2 flex-1 lg:flex-initial justify-around">
                <a href="#"> <i class="uil-heart"></i> ${data.likeCount ? data.likeCount : 0} </a>
                <a href="#"> <i class="uil-comment-alt-message"></i> ${data.commentCount ? data.commentCount : 0} </a>
            </div>
        </div>

    </div>
  </div>
  `;
  return html;
}


function getProfileCoverHTML(data) {
  var html = '';
  if (!data.name) {
    data.name = abbrAddress(data.address);
  }
  if (!data.profileImage) {
    data.profileImage = "https://web3-images-api.kibalabs.com/v1/accounts/" + data.address + "/image";
  }
  html = `
    <div id="profile-cover" class="flex lg:flex-row flex-col items-center lg:py-8 lg:space-x-8">

        <div>
            <div class="bg-gradient-to-tr from-yellow-600 to-pink-600 p-1 rounded-full m-0.5 mr-2  w-56 h-56 relative overflow-hidden uk-transition-toggle">  
                <img src="${data.profileImage}" class="bg-gray-200 border-4 border-white rounded-full w-full h-full dark:border-gray-900">

                <div class="absolute -bottom-3 custom-overly1 flex justify-center pt-4 pb-7 space-x-3 text-2xl text-white uk-transition-slide-bottom-medium w-full">
                    <a href="#" class="hover:text-white">
                        <i class="uil-camera"></i>
                    </a>
                    <a href="#" class="hover:text-white">
                        <i class="uil-crop-alt"></i>
                    </a>
                </div>
            </div>
        </div>

        <div class="lg:w/8/12 flex-1 flex flex-col lg:items-start items-center"> 

            <h2 class="font-semibold lg:text-2xl text-lg mb-2"> ${data.name}</h2>
            <p class="lg:text-left mb-2 text-center  dark:text-gray-100"> </p>
                
                <div class="capitalize flex font-semibold space-x-3 text-center text-sm my-2">
                    <a href="#" class="bg-pink-500 shadow-sm p-2 pink-500 px-6 rounded-md text-white hover:text-white hover:bg-pink-600"> Follow</a>
                    <div>

                    <a href="#" class="bg-gray-300 flex h-12 h-full items-center justify-center rounded-full text-xl w-9 dark:bg-gray-700"> 
                        <i class="icon-feather-chevron-down"></i> 
                    </a>
                        
                    <div class="bg-white w-56 shadow-md mx-auto p-2 mt-12 rounded-md text-gray-500 hidden text-base dark:bg-gray-900" uk-drop="mode: click">
                    
                        <ul class="space-y-1">
                        <li> 
                            <a href="#" class="flex items-center px-3 py-2 hover:bg-gray-200 hover:text-gray-800 rounded-md dark:hover:bg-gray-700">
                                <i class="uil-user-minus mr-2"></i>Unfollow
                            </a> 
                        </li>
                        <li> 
                            <a href="#" class="flex items-center px-3 py-2 hover:bg-gray-200 hover:text-gray-800 rounded-md dark:hover:bg-gray-700">
                                <i class="uil-share-alt mr-2"></i> Share
                            </a> 
                        </li>
                        <li>
                            <hr class="-mx-2 my-2  dark:border-gray-700">
                        </li>
                        <li> 
                            <a href="#" class="flex items-center px-3 py-2 text-red-500 hover:bg-red-100 hover:text-red-500 rounded-md dark:hover:bg-red-600">
                                <i class="uil-stop-circle mr-2"></i> Block
                            </a> 
                        </li>
                        </ul>
                    
                    </div>

                    </div>

                </div>

                <div class="divide-gray-300 divide-transparent divide-x grid grid-cols-3 lg:text-left lg:text-lg mt-3 text-center w-full dark:text-gray-100">
                    <div class="flex lg:flex-row flex-col"> ${data.postCount ? data.postCount: 0} <strong class="lg:pl-2">Posts</strong></div>
                    <div class="lg:pl-4 flex lg:flex-row flex-col"> ${data.followerCount ? data.followerCount: 0} <strong class="lg:pl-2">Followers</strong></div>
                    <div class="lg:pl-4 flex lg:flex-row flex-col"> ${data.followingCount ? data.followingCount: 0} <strong class="lg:pl-2">Following</strong></div>
                </div>

        </div>

        <div class="w-20"></div>

    </div>
  `;
  return html;
}

function getTrendingUserHTML(data) {
    var html = '';
    if (!data.name) {
      data.name = abbrAddress(data.address);
    }
    if (!data.profileImage) {
      data.profileImage = "https://web3-images-api.kibalabs.com/v1/accounts/" + data.address + "/image";
    }
    html = `
    <li>
        <div
            class="relative bg-gradient-to-tr from-yellow-600 to-pink-600 p-1 rounded-full transform -rotate-2 hover:rotate-3 transition hover:scale-105 m-1">
            <img src="${data.profileImage}"
                class="w-20 h-20 rounded-full border-2 border-white bg-gray-200">
        </div>
        <a href="/profile/${data.address}" class="block font-medium text-center text-gray-500 text-x truncate w-24">
            ${data.name} </a>
    </li>
    `;
    return html;
}

function getSidebarUserHTML(data) {
    html = '';
    if (!data.name) {
        data.name = abbrAddress(data.address);
    }
    if (!data.profileImage) {
        data.profileImage = "https://web3-images-api.kibalabs.com/v1/accounts/" + data.address + "/image";
    }
    html = `
    <div class="flex items-center justify-between py-3">
        <div class="flex flex-1 items-center space-x-4">
            <a href="/profile/${data.address}">
                <img src="${data.profileImage}" class="bg-gray-200 rounded-full w-10 h-10">
            </a>
            <div class="flex flex-col">
                <span class="block capitalize font-semibold"> ${data.name} </span>
            </div>
        </div>
        
        <a href="#" data-address="${data.address}" class="follow-button border border-gray-200 font-semibold px-4 py-1 rounded-full hover:bg-pink-600 hover:text-white hover:border-pink-600 dark:border-gray-800"> Follow </a>
    </div>
    `;
    return html;
}

function getModalHTML(data) {
    var html = '';
    if (!data.name) {
        data.name = abbrAddress(data.user);
    }
    if (!data.profileImage) {
        data.profileImage = "https://web3-images-api.kibalabs.com/v1/accounts/" + data.user + "/image";
    }
    html = `
    <div class="uk-modal-dialog story-modal">
        <button class="uk-modal-close-default lg:-mt-9 lg:-mr-9 -mt-5 -mr-5 shadow-lg bg-white rounded-full p-4 transition dark:bg-gray-600 dark:text-white" type="button" uk-close></button>

            <div class="story-modal-media">
                <img src="/images/${data.id}.png" alt=""  class="inset-0 h-full w-full object-cover">
            </div>
            <div class="flex-1 bg-white dark:bg-gray-900 dark:text-gray-100">
            
                <!-- post header-->
                <div class="border-b flex items-center justify-between px-5 py-3 dark:border-gray-600">
                    <div class="flex flex-1 items-center space-x-4">
                        <a href="#">
                            <div class="bg-gradient-to-tr from-yellow-600 to-pink-600 p-0.5 rounded-full">
                                <img src="${data.profileImage}"
                                    class="bg-gray-200 border border-white rounded-full w-8 h-8">
                            </div>
                        </a>
                        <span class="block text-lg font-semibold"> ${data.name} </span>
                    </div>
                    <a href="#"> 
                        <i  class="icon-feather-more-horizontal text-2xl rounded-full p-2 transition -mr-1"></i>
                    </a>
                </div>
                <div class="story-content p-4" data-simplebarX>

                    <p> ${data.title} </p>
                    
                    <div class="py-4 ">
                        <div class="flex justify-around">
                            <a href="#" data-id="${data.id}" class="like-button flex items-center space-x-3">
                                <div class="flex font-bold items-baseline"> <i class="uil-heart mr-1"> </i> <span class="like-button-text">Like</span></div>
                            </a>
                            <a href="#" data-id="${data.id}" class="comment-link flex items-center space-x-3">
                                <div class="flex font-bold items-baseline"> <i class="uil-comment-alt-message mr-1"> </i> Comment</div>
                            </a>
                            <a href="#" data-id="${data.id}" class="mint flex items-center space-x-3">
                                <div class="flex font-bold items-baseline"> <i class="uil-wallet mr-1"> </i> Mint</div>
                            </a>
                        </div>
                        <hr class="-mx-4 my-3">
                        <div id="modal-like-summary-${data.id}" class="flex items-center space-x-3"> 

                        </div>
                    </div>

                <div id="modal-comments-${data.id}" class="-mt-1 space-y-1">

                </div>


                </div>
                <div class="p-3 border-t dark:border-gray-600">
                    <div class="bg-gray-200 dark:bg-gray-700 rounded-full rounded-md relative">
                        <input type="text" id="modal-comment-text-${data.id}" data-id="${data.id}" placeholder="Add your Comment.." class="bg-transparent max-h-8 shadow-none">
                        <div class="absolute bottom-0 flex h-full items-center right-0 right-3 text-xl space-x-2">
                            <a href="#" data-id="${data.id}" class="comment-button"> <i class="uil-arrow-circle-right"></i></a>
                        </div>                        
                    </div>
                </div>

            </div>

    </div>
    `;
    return html;
}

function getModalCommentHTML(data) {
    var html = '';
    if (!data.name) {
        data.name = abbrAddress(data.user);
    }
    if (!data.profileImage) {
        data.profileImage = "https://web3-images-api.kibalabs.com/v1/accounts/" + data.user + "/image";
    }
    html = `
    <div id="modal-comment-${data.id}" class="flex flex-1 items-center space-x-2">
        <img src="${data.profileImage}" class="rounded-full w-8 h-8">
        <div class="flex-1 p-2">
            ${data.comment}
        </div>
    </div>
    `;
    return html;
}

function getSidebarTrendingPostsHTML(data) {
    var html = '';
    if (!data.name) {
        data.name = abbrAddress(data.user);
    }
    if (!data.profileImage) {
        data.profileImage = "https://web3-images-api.kibalabs.com/v1/accounts/" + data.user + "/image";
    }
    html = `
    <div id="sidebar-trending-${data.id}" class="bg-red-500 max-w-full h-40 rounded-lg relative overflow-hidden uk-transition-toggle"> 
        <a href="#story-modal" data-id="${data.id}" class="post-modal" uk-toggle>
            <img src="/images/${data.id}.png" class="w-full h-full absolute object-cover inset-0">
        </a>
        <div class="flex flex-1 justify-around items-center absolute bottom-0 w-full p-2 text-white custom-overly1 uk-transition-slide-bottom-medium">   
            <a href="#"> <i class="uil-heart"></i> ${data.likeCount ? data.likeCount : 0} </a>
            <a href="#"> <i class="uil-comment-alt-message"></i> ${data.commentCount ? data.commentCount : 0} </a>
        </div>
    </div>
    `;
    return html;
}