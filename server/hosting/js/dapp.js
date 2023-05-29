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
var resetFeed, resetProfile, resetUsers, resetProfilePosts, resetTrendingPosts, resetIndie;
var notificationCount = 0;
var posts = {};
var users = {};
var loggedInUser;
var balances = {};

var openSeaSlugs = [];
openSeaSlugs[5] = "goerli";
openSeaSlugs[420] = "optimism-goerli";
openSeaSlugs[421613] = "arbitrum-goerli";

var currencies = {
    "0xB66cf6eAf3A2f7c348e91bf1504d37a834aBEB8A": "pAInt",
    "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6": "WETH"
};
const stripePaymentLink = "https://buy.stripe.com/test_aEU5nc7Fr5eBcIo3cc?client_reference_id=";

const path = window.location.pathname.split('/');
var currentPage = "feed";
var idForPage = '';
//console.log(path);

if (path[1]) {
    currentPage = path[1];
}
if (path[2]) {
    idForPage = path[2];
}

let web3auth = null;
let provider = null;

var simpleBar;
if ( document.getElementById("notifications") ) {
    simpleBar = new SimpleBar(document.getElementById('notifications'));
}

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
        var hasProfileImage = true;
        if (!user.profileImage) {
            hasProfileImage = false;
            user.profileImage = "https://web3-images-api.kibalabs.com/v1/accounts/" + user.address + "/image";
        }
        $("img.header-avatar").attr("src", user.profileImage);
        if (resetProfile) {
            resetProfile();
        }
        resetProfile = db.collection("users").where("address", "==", user.address)
            .onSnapshot((querySnapshot) => {
                querySnapshot.forEach((doc) => {
                    //console.log("user", JSON.stringify(doc.data()));
                    var meta = doc.data();
                    users[meta.address] = meta;
                    if ( $( "#sidebar-profile" ).length <= 0 ) {
                        $("div.sidebar_inner").prepend( getSidebarProfileHTML(meta) );
                    } else {
                        $( "#sidebar-profile").replaceWith( getSidebarProfileHTML(meta) );
                    }
                    if ("name" in meta) {
                        $("#name").val(meta.name);
                    }
                    if (hasProfileImage) {
                        $("#image").val(meta.profileImage);
                    }
                    if ("about" in meta) {
                        $("#about").val(meta.about);
                    }
                    if ("location" in meta) {
                        $("#location").val(meta.location);
                    }
                    if ("chain" in meta) {
                        $("#user-chain").val(meta.chain);
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

                    
                    doc.ref.collection("notifications").orderBy("timestamp", "asc")
                        .onSnapshot((querySnapshot) => {
                            querySnapshot.forEach((notification) => {
                                //console.log("notification", JSON.stringify(notification.data()));
                                var n = notification.data();
                                n.id = notification.id;
                                if ( $( "#notification-" + n.id ).length <= 0 ) {
                                    n.new = true;
                                    notificationCount++;
                                    $(`#notifications`).find(".simplebar-content").prepend( getNotificationHTML(n) );
                                } else {
                                    n.new = false;
                                    $( "#notification-" + n.id ).replaceWith( getNotificationHTML(n) );
                                }
                                if (simpleBar) {
                                    simpleBar.recalculate();
                                }
                                //notificationCount = $("#notifications").find("li.notification.new").length;
                                if (notificationCount > 0) {
                                    $("#notification-count").text(notificationCount).show();
                                } else {
                                    $("#notification-count").text(notificationCount).hide();
                                }
                                //updateBalances();
                            });
                        });

                    doc.ref.collection("wallet").doc("balances")
                        .onSnapshot((doc) => {
                            if (doc.exists) {
                                balances = doc.data();
                                var paintBalance = parseFloat(ethers.utils.formatEther(ethers.BigNumber.from(balances.pAInt)));
                                var wethBalance = 0;
                                if ("WETH" in balances) {
                                    wethBalance = parseFloat(ethers.utils.formatEther(ethers.BigNumber.from(balances.WETH)));
                                }
                                if (meta.safeDeployed) {
                                    $("#paint-balance").text(paintBalance.toFixed(0));
                                } else {
                                    $("#paint-balance").text(5);  // not real tokens (yet)
                                }
                                $("#wallet .paint").text(paintBalance.toFixed(3));
                                $("#wallet .weth").text(wethBalance.toFixed(3));
                            }
                        });

                    if (meta.safeDeployed == false) {
                        $("#paint-balance").text(5);  // not real tokens (yet)
                    } else {
                        $(".wallet-link").attr("href", `https://app.safe.global/balances?safe=gor:${user.safeAddress}`);
                        updateBalances();
                    }
                    updateFollowButtons();

                });
            });
    } // if "address"
    if (user.safeDeployed) {
        $(".wallet-link").attr("href", `https://app.safe.global/balances?safe=gor:${user.safeAddress}`);
        updateBalances();
    } else {
        $("#paint-balance").text(5);
    }
    updateFollowButtons();
}

async function updateBalances() {
    const headers = await getHeaders();
    const resBalances = await fetch('/api/balances', { 
        method: 'GET', 
        headers: new Headers(headers)
    });
    var userWithBalances = await resBalances.json();
    balances = userWithBalances.balances;
}

async function loadProfile (address) {
    if (resetProfile) {
        resetProfile();
    }
    resetProfile = db.collection("users").where("address", "==", address)
        .onSnapshot((querySnapshot) => {
            querySnapshot.forEach((doc) => {
                //console.log("user", JSON.stringify(doc.data()));
                var meta = doc.data();
                users[meta.address] = meta;
                users[meta.address].doc = doc;
                if ( $( "#profile-cover" ).length <= 0 ) {
                    $("#profile").prepend( getProfileCoverHTML(meta) );
                } else {
                    $( "#profile-cover").replaceWith( getProfileCoverHTML(meta) );
                }
            });
            updateFollowButtons();

            $("#grid-posts").html('');
            if (resetProfilePosts) {
                resetProfilePosts();
            }
            resetProfilePosts = db.collection("posts").orderBy("timestamp", "asc").where("user", "==", address)
                .onSnapshot((querySnapshot) => {
                    var count = 0;
                    querySnapshot.forEach((doc) => {
                        count++;
                        //console.log("post", JSON.stringify(doc.data()));
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
                //console.log("user", JSON.stringify(doc.data()));
                var meta = doc.data();
                users[meta.address] = meta;
                if (count <= 5) {
                    if ( $( "#sidebar-user-" + doc.id ).length <= 0 ) {
                        $("#sidebar-users").prepend( getSidebarUserHTML(meta) );
                    } else {
                        $( "#sidebar-user-" + doc.id ).replaceWith( getSidebarUserHTML(meta) );
                    }
                    updateFollowButtons();
                }

                if ( $( "#trending-user-" + doc.id ).length <= 0 ) {
                    $("#trending-users").prepend( getTrendingUserHTML(meta) );
                } else {
                    $( "#trending-user-" + doc.id ).replaceWith( getTrendingUserHTML(meta) );
                }
            });
        });
}

function loadFeed (postId) {
    if (resetFeed) {
        resetFeed();
    }
    resetFeed = db.collection("posts").orderBy("timestamp", "asc")
        .onSnapshot((querySnapshot) => {
            var count = 0;
            querySnapshot.forEach((doc) => {
                count++;
                //console.log("post", JSON.stringify(doc.data()));
                var meta = doc.data();
                meta.id = doc.id;
                posts[meta.id] = meta;
                posts[meta.id].doc = doc;
                if ( $( "#post-" + doc.id ).length <= 0 ) {
                    $("#feed-posts").prepend( getFeedPostHTML(meta) );
                } else {
                    $( "#post-" + doc.id ).replaceWith( getFeedPostHTML(meta) );
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
                            //console.log("comment", JSON.stringify(comment.data()));
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
            if (postId) {
                $(".feed-post").not("#post-"+postId).hide();
            }
            updateFollowButtons();
            updateBalances();
    });
}

async function getLikeSummaryHTML(doc, querySnapshot) {
    return new Promise(async (resolve, reject) => {
        var count = 0;
        var html = '';
        var first = '';
        await querySnapshot.forEach((like) => {
            count++;
            //console.log("like", JSON.stringify(like.data()));
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
        //uiConsole(id_token);
        var social = true;
        const user = await web3auth.getUserInfo();
        //uiConsole(user);
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
    //uiConsole(result);
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
    //uiConsole(result);
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
    //uiConsole(result);
}

async function repost(data) {
    const headers = await getHeaders();
    const res = await fetch('/api/repost', { 
        method: 'POST', 
        headers: new Headers(headers), 
        body: JSON.stringify(data)
    });
    var result = await res.json();
    //uiConsole(result);
}

async function mint(data) {
    const headers = await getHeaders();
    // TODO: check balances first?
    const res = await fetch('/api/mint', { 
        method: 'POST', 
        headers: new Headers(headers), 
        body: JSON.stringify(data)
    });
    var result = await res.json();
    //uiConsole(result);
}


async function follow(address) {
    const headers = await getHeaders();
    var data = {
        "address": address
    };
    const res = await fetch('/api/follow', { 
        method: 'POST', 
        headers: new Headers(headers), 
        body: JSON.stringify(data)
    });
    var result = await res.json();
    if (loggedInUser) {
        if ("following" in loggedInUser) {
            loggedInUser.following.push(address.toLowerCase());
        } else {
            loggedInUser.following = [];
            loggedInUser.following.push(address.toLowerCase());
        }
    }
    updateFollowButtons();
    //uiConsole(result);
}

async function upgrade(data) {
    const headers = await getHeaders();
    const res = await fetch('/api/upgrade', { 
        method: 'POST', 
        headers: new Headers(headers), 
        body: JSON.stringify(data)
    });
    var result = await res.json();
    //uiConsole(result);
    if (result.result == "ok") {
        if (loggedInUser && ("address" in loggedInUser)) {
            window.location = stripePaymentLink + loggedInUser.address;
        } else {
            console.log("cannot send payment link without address for loggedInUser");
        }
    }
}

async function saveProfile(data) {
    const headers = await getHeaders();
    const res = await fetch('/api/profile', { 
        method: 'POST', 
        headers: new Headers(headers), 
        body: JSON.stringify(data)
    });
    var result = await res.json();
    $("#save-profile").text("Saved");
}

async function postModal(data) {
    $("#story-modal").html( getModalHTML(data) );
    const doc = data.doc;
    await doc.ref.collection("likes").orderBy("timestamp", "desc")
        .onSnapshot(async (querySnapshot) => {
            const html = await getLikeSummaryHTML(doc, querySnapshot);
            //console.log(html, doc.id);
            $(`#modal-like-summary-${doc.id}`).html(html);
        });
    await doc.ref.collection("comments").orderBy("timestamp", "asc")
        .onSnapshot(async (querySnapshot) => {
            querySnapshot.forEach((comment) => {
                //console.log("comment", JSON.stringify(comment.data()));
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

function updateFollowButtons() {
    if (loggedInUser) {
        $(".follow-button").each(function(){
            //console.log("found follow button!");
            var target = $(this).data('address');
            //console.log("target", target);
            //console.log("loggedInUser", loggedInUser);
            if ("following" in loggedInUser) {
                const following = loggedInUser.following.map(address => address.toLowerCase());
                if (following.includes(target.toLowerCase())) {
                    $(this).text("Following").prop('disabled', true);
                }
            }
            if (target.toLowerCase() == loggedInUser.address.toLowerCase()) {
                $(this).prop('disabled', true);
            }
        });
        $(".nomint").each(function(){
            var creator = $(this).data("user");
            if ("address" in loggedInUser) {
                if (loggedInUser.address.toLowerCase() == creator.toLowerCase()) {
                    $(this).show();
                }
            }
        });
    }    
}

async function saveNFT(data) {
    const headers = await getHeaders();
    const res = await fetch('/api/nftsettings', { 
        method: 'POST', 
        headers: new Headers(headers), 
        body: JSON.stringify(data)
    });
    var result = await res.json();
    $("#save-chain").text("Saved");
}

function navigateTo(currentPage, idForPage) {
    if (currentPage == "feed") {
        $(".view").hide();
        $("#feed, .feed-post").show();
        $(".menu").removeClass("active");
        $(".menu-feed").addClass("active");
        history.pushState({}, "", "/");
    } else if (currentPage == "profile") {
        $(".view").hide();
        if (idForPage) {
            loadProfile(idForPage);
            history.pushState({}, "", `/profile/${idForPage}`);
        } else {
            history.pushState({}, "", "/profile/");
        }
        $("#profile").show();
        $(".menu").removeClass("active");
        $(".menu-profile").addClass("active");
    } else if (currentPage == "trending") {
        $(".view").hide();
        $("#trending").show();
        $(".menu").removeClass("active");
        $(".menu-trending").addClass("active");
        history.pushState({}, "", "/trending/");
    } else if (currentPage == "settings") {
        $(".view").hide();
        $("#settings").show();
        $(".menu").removeClass("active");
        $(".menu-settings").addClass("active");
        history.pushState({}, "", "/settings/");
    } else if (currentPage == "p") {
        if (idForPage) {
            $(".view").hide();
            $("#feed").show();
            $(".menu").removeClass("active");
            $(".menu-feed").addClass("active");
            $(".feed-post").not("#feed-post-"+idForPage).hide();
            history.pushState({}, "", `/p/${idForPage}`);
        }
    }
}



$( document ).ready(function() {

    navigateTo(currentPage, idForPage);

    if ((currentPage == "p") && idForPage) {
        loadFeed(idForPage);
    } else {
        loadFeed();
    }
    loadUsers();

    //loadProfile();

    $("#login").click(async function (event) {
        console.log("login button clicked!");
        try {
            const provider = await web3auth.connect();
            $(".btn-logged-out").hide();
            $(".btn-logged-in").show();
            //uiConsole("Logged in Successfully!");
            const user = await web3auth.getUserInfo();
            //uiConsole(user);
            if ($.isEmptyObject(user)) {
                // Wallet user
                await web3auth.authenticateUser();
            } else {
                if ("profileImage" in user) {
                    $("img.header-avatar").attr("src", user.profileImage);
                }
            }
            loadUserProfile();
        } catch (error) {
            console.error(error.message);
        }
    });

    $("#selfmint").change(function(){
        if ( $(this).is(':checked') ) {
            $("#mintable").prop("checked", false);
        }
    });
    $("#mintable").change(function(){
        if ( $(this).is(':checked') ) {
            $("#selfmint").prop("checked", false);
        }
    });

    $("#post").click(async function(){
        console.log("post!");
        $(this).text("Posting...");
        var data = {};
        data.prompt = $("#prompt").val();
        if (!data.prompt) {
            // TODO: error, prompt required
            return false;
        }
        data.title = $("#title").val();;
        if ( $("#mintable").is(":checked") ) {
            data.mintable = true;
        } else {
            data.mintable = false;
        }
        if ( $("#selfmint").is(":checked") ) {
            data.selfmint = true;
        } else {
            data.selfmint = false;
        }
        data.category = $("#category").val();
        data.type = $("#type").val();
        data.price = $("#price").val();
        data.currency = $("#currency").val();
        console.log("art data", data);
        postArt(data);
        return false;
    });

    $("#save-profile").click(function(){
        // email skipped intentionally for now
        $(this).text("Saving...");
        var data = {
            "name": $("#name").val(),
            "profileImage": $("#image").val(),
            "about": $("#about").val(),
            "location": $("#location").val()
        }
        saveProfile(data);
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
        $(this).find('i').css("color", "red");
        $(this).find('.like-button-text').text(" Liked");
        return false;
    });

    $( "#feed-posts, #story-modal" ).on( "click", ".repost", async function(e) {
        e.preventDefault();
        console.log("repost!");
        var data = {};
        data.parent = $(this).data('id');
        repost(data);
        $(this).find('i').css("color", "red");
        $(this).find('.repost-button-text').text(" Reposted");
        return false;
    });

    $( "#feed-posts, #story-modal" ).on( "click", ".mint", async function(e) {
        e.preventDefault();
        console.log("mint!");
        if (loggedInUser) {
            if (loggedInUser.safeDeployed == false) {
                //alert("You have not minted any of your own art yet! Before you can mint other's art, please use the POST button to create some art and check the option to mint it.");
                //return false;
            }
        }
        var data = {};
        data.id = $(this).data('id');
        data.chain = $(this).data('mintchain');
        if (!data.chain) {
            data.chain = 5;
        }
        mint(data);
        $(this).find('i').css("color", "red");
        $(this).parents('.mint-drop').addClass("hidden").hide();
        $(this).parents('.mint-link').find(".mint-button-text").text(" Minting...");
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

    $(".upgrade-page").click(function(){
        window.location = `https://axelart.xyz/upgrade/`;
        return false;
    });

    $("#upgrade, .upgrade").click(async function(){
        console.log("upgrade!");
        var data = {};
        data.name = $("#contract-name").val();
        data.symbol = $("#contract-symbol").val();
        if (data.name && data.symbol) {
            $(this).text("Upgrading...");
            upgrade(data);
        } else {
            $(".upgrade-main").hide();
            $(".upgrade-form").show();
            $("#contract-name").focus();
            $("#upgrade-form-button").text("UPGRADE NOW");
        }
        return false;
    });

    $( "#feed-posts, #grid-posts, #trending-grid, #sidebar-trending" ).on( "click", ".post-modal", async function(e) {
        console.log("post modal!");
        const id = $(this).data('id');
        var data = posts[id];
        postModal(data);
        return true;
    });

    $( "#sidebar-users, #profile" ).on( "click", ".follow-button", async function(e) {
        e.preventDefault();
        console.log("follow!");
        const address = $(this).data('address');
        follow(address);
        $(this).text('Following');
        return false;
    });

    $(".menu").find("a").click(function(e){
        const page = $(this).data("page");
        if (page) {
            if (page == "profile") {
                currentPage = "profile";
                if (loggedInUser && ("address" in loggedInUser)) {
                    loadProfile(loggedInUser.address);
                }
            }
            navigateTo(page);
            return false;
        } else {
            return true;
        }
    });

    $(".notification-header, #notification-count").click(function(){
        UIkit.drop(document.getElementById('notification-drop')).show();
        $("#notifications").find("li.notification.new").removeClass("new");
        notificationCount = 0;
        $("#notification-count").hide();
    });

    $(".settings-tab-link").click(function(){
        const target = $(this).data("target");
        $(".settings-tab").hide();
        $(`.settings-${target}`).show();
        $(".settings-tab-link").parent("li").removeClass("uk-active");
        $(this).parent("li").addClass("uk-active");
        return false;
    });

    $("#save-chain").click(function(){
        const userChain = $("#user-chain").val();
        var data = {};
        data.userchain = userChain;
        saveNFT(data);
        $(this).text("Saving...");
        return false;
    });

    $(".logout").click(async function (event) {
        try {
            await web3auth.logout();
            $(".btn-logged-in").hide();
            $(".btn-logged-out").show();
            //navigateTo("feed");
            window.location = 'https://axelart.xyz';
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
    var icon = openseaIcon();
    if (data.currency == "0") {
        data.currency = "0xB66cf6eAf3A2f7c348e91bf1504d37a834aBEB8A";
    }
    const coin = data.currency ? data.currency : "0xB66cf6eAf3A2f7c348e91bf1504d37a834aBEB8A"; 
    data.coin = coin;
    var mintHTML = `
    <a href="#" data-id="${data.id}" data-user="${data.user}" class="mint nomint flex items-center space-x-2 flex-1 justify-end" style="display: none;">
        <div><i class="uil-wallet mr-1" style="font-size: 130%;"></i><span class="mint-button-text">Mint (1 pAInt)</span></div>
    </a>
    `;
    data.mintLabel = `Mint (1 pAInt)`;
    const drop = mintDropDownHTML(data);
    mintHTML = `
    <a href="#" data-id="${data.id}" class="flex items-center space-x-2 flex-1 justify-end">
        ${drop}
    </a>
    `;
    if (data.minted) {
        var slug = `goerli`;
        if ("chain" in data) {
            slug = openSeaSlugs[data.chain];
        }
        mintHTML = `
        <a href="https://testnets.opensea.io/assets/${slug}/${data.nftContract}/${data.tokenId}" target="_blank" data-id="${data.id}" class="flex items-center space-x-2 flex-1 justify-end">
            <div>
                ${icon}
            </div>
        </a>
        `;
    } else if (data.mintable) {
        mintHTML = `
        <a href="#" data-id="${data.id}" class="mint flex items-center space-x-2 flex-1 justify-end">
            <div><i class="uil-wallet mr-1" style="font-size: 130%;"></i><span class="mint-button-text">Mint (${data.price} ${currencies[coin]})</span></div>
        </a>
        `;
        data.mintLabel = `Mint (${data.price} ${currencies[coin]})`;
        const dropDown = mintDropDownHTML(data);
        mintHTML = `
        <a href="#" data-id="${data.id}" class="flex items-center space-x-2 flex-1 justify-end">
            ${dropDown}
        </a>
        `;
    } else if (loggedInUser && (loggedInUser.address.toLowerCase() == data.user.toLowerCase())) {
        // logged in user is creator, so give option to mint for 1 pAInt
        mintHTML = `
        <a href="#" data-id="${data.id}" class="mint flex items-center space-x-2 flex-1 justify-end">
            <div><i class="uil-wallet mr-1" style="font-size: 130%;"></i><span class="mint-button-text">Mint (1 pAInt)</span></div>
        </a>
        `;
        data.mintLabel = `Mint (1 pAInt)`;
        const dropDown = mintDropDownHTML(data);
        mintHTML = `
        <a href="#" data-id="${data.id}" class="flex items-center space-x-2 flex-1 justify-end">
            ${dropDown}
        </a>
        `;
    }
    if ("mintStatus" in data) {
        if (data.mintStatus == "pending") {
            mintHTML = `
            <a href="#" data-id="${data.id}" data-user="${data.user}" class="nomint flex items-center space-x-2 flex-1 justify-end">
                <div><i class="uil-wallet mr-1" style="font-size: 130%;"></i><span class="mint-button-text">Minting...</span></div>
            </a>
            `;
        }
    }
    html = `
    <div id="post-${data.id}" class="feed-post bg-white shadow rounded-md dark:bg-gray-900 -mx-2 lg:mx-0">

        <!-- post header-->
        <div class="flex justify-between items-center px-4 py-3">
            <div class="flex flex-1 items-center space-x-4">
                <a href="#">
                    <div class="bg-gradient-to-tr from-yellow-600 to-pink-600 p-0.5 rounded-full">  
                        <img src="${data.profileImage}" class="bg-gray-200 border border-white rounded-full w-8 h-8">
                    </div>
                </a>
                <span class="block font-semibold dark:text-gray-100"> ${data.name} </span>
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
                <a href="#" data-id="${data.id}" class="repost flex items-center space-x-2">
                    <div><i class="uil-refresh mr-1" style="font-size: 130%;"></i><span class="repost-button-text">Repost</span></div>
                </a>
                ${mintHTML}
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
        data.profileImage = "https://web3-images-api.kibalabs.com/v1/accounts/" + data.address + "/image";
    }
    html = `
    <div id="sidebar-profile" class="flex flex-col items-center my-6 uk-visible@s">
        <div
            class="bg-gradient-to-tr from-yellow-600 to-pink-600 p-1 rounded-full transition m-0.5 mr-2  w-24 h-24">
            <img src="${data.profileImage}"
                class="user-avatar bg-gray-200 border-4 border-white rounded-full w-full h-full">
        </div>
        <a href="/profile/${data.user}" class="text-xl font-medium mt-4 uk-link-reset"> ${data.name}
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
  data.about = data.about ? data.about : "";
  data.location = data.location ? data.location : "";
  var pro = '';
  if ( ("plan" in data) && (data.plan == "pro") ) {
    pro = `<span class="pro-badge">PRO</span>`;
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

            <h2 class="font-semibold lg:text-2xl text-lg mb-2"> ${data.name}${pro}</h2>
            <p class="lg:text-left mb-2 text-center  dark:text-gray-100">${data.about} </p>

                            <div class="flex font-semibold mb-3 space-x-2  dark:text-gray-10">
                                <a href="#">${data.location}</a>
                            </div>
                
                <div class="capitalize flex font-semibold space-x-3 text-center text-sm my-2">
                    <a href="#" data-address="${data.address}" class="follow-button bg-pink-500 shadow-sm p-2 pink-500 px-6 rounded-md text-white hover:text-white hover:bg-pink-600"> Follow</a>
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
    var followButton = `<a href="#" data-address="${data.address}" class="follow-button border border-gray-200 font-semibold px-4 py-1 rounded-full hover:bg-pink-600 hover:text-white hover:border-pink-600 dark:border-gray-800"> Follow </a>`;
    if (loggedInUser) {
        const target = data.address;
        if ("following" in loggedInUser) {
            const following = loggedInUser.following.map(address => address.toLowerCase());
            if (following.includes(target.toLowerCase())) {
                followButton = `<a href="#" data-address="${data.address}" class="follow-button border border-gray-200 font-semibold px-4 py-1 rounded-full hover:bg-pink-600 hover:text-white hover:border-pink-600 dark:border-gray-800"> Following </a>`;
            }
        }
        if (target.toLowerCase() == loggedInUser.address.toLowerCase()) {
            followButton = '';
        }
    }
    html = `
    <div id="sidebar-user-${data.address}" class="flex items-center justify-between py-3">
        <div class="flex flex-1 items-center space-x-4">
            <a href="/profile/${data.address}">
                <img src="${data.profileImage}" class="bg-gray-200 rounded-full w-10 h-10">
            </a>
            <div class="flex flex-col">
                <span class="block font-semibold"> ${data.name} </span>
            </div>
        </div>
        
        ${followButton}
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
    var icon = openseaIcon();
    if (data.currency == "0") {
        data.currency = "0xB66cf6eAf3A2f7c348e91bf1504d37a834aBEB8A";
    }
    const coin = data.currency ? data.currency : "0xB66cf6eAf3A2f7c348e91bf1504d37a834aBEB8A"; 
    var mintHTML = `
    <a href="#" data-id="${data.id}" data-user="${data.user}" class="mint flex items-center space-x-4" style="display: none;">
        <div class="flex font-bold items-baseline"> <i class="uil-wallet mr-1"> </i> <span class="mint-button-text">Mint</span></div>
    </a>
    `;
    if (data.minted) {
        var slug = `goerli`;
        if ("chain" in data) {
            slug = openSeaSlugs[data.chain];
        }
        mintHTML = `
        <a href="https://testnets.opensea.io/assets/${slug}/${data.nftContract}/${data.tokenId}" target="_blank" data-id="${data.id}" class="flex items-center space-x-4">
            <div class="flex font-bold items-baseline">${icon}</div>
        </a>
        `;
    } else if (data.mintable) {
        mintHTML = `
        <a href="#" data-id="${data.id}" data-user="${data.user}" class="mint flex items-center space-x-4">
            <div class="flex font-bold items-baseline"> <i class="uil-wallet mr-1"> </i> <span class="mint-button-text">Mint (${data.price} ${currencies[coin]})</span></div>
        </a>
        `;
    } else if (loggedInUser && (loggedInUser.address.toLowerCase() == data.user.toLowerCase())) {
        // logged in user is creator, so give option to mint for 1 pAInt
        mintHTML = `
        <a href="#" data-id="${data.id}" data-user="${data.user}" class="mint flex items-center space-x-4">
            <div class="flex font-bold items-baseline"> <i class="uil-wallet mr-1"> </i> <span class="mint-button-text">Mint (1 pAInt)</span></div>
        </a>
        `;
    }
    if ("mintStatus" in data) {
        if (data.mintStatus == "pending") {
            mintHTML = `
            <a href="#" data-id="${data.id}" data-user="${data.user}" class="nomint flex items-center space-x-4">
                <div class="flex font-bold items-baseline"> <i class="uil-wallet mr-1"> </i> <span class="mint-button-text">Minting...</span></div>
            </a>
            `;
        }
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
                            <a href="#" data-id="${data.id}" class="like-button flex items-center space-x-4">
                                <div class="flex font-bold items-baseline"> <i class="uil-heart mr-1"> </i> <span class="like-button-text">Like</span></div>
                            </a>
                            <a href="#" data-id="${data.id}" class="comment-link flex items-center space-x-4">
                                <div class="flex font-bold items-baseline"> <i class="uil-comment-alt-message mr-1"> </i> Comment</div>
                            </a>
                            <a href="#" data-id="${data.id}" class="repost flex items-center space-x-4">
                                <div class="flex font-bold items-baseline"> <i class="uil-refresh mr-1"> </i> <span class="repost-button-text">Repost</span></div>
                            </a>
                            ${mintHTML}
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

function getNotificationHTML(data) {
    var html = '';
    var target = "";
    if ("link" in data) {
        if ( data.link.includes("airtist") || data.link.includes("axelart") ) {
            target = "";
        } else {
            target = "_blank";
        }
    } else {
        data.link = "#";
    }
    var name = data.name ? data.name : "";
    var textLink = data.textLink ? data.textLink : ""; 
    var newOne = data.new ? "new" : "";
    var timeago =  moment.unix(data.timestamp.seconds - 30).fromNow();
    html = `
    <li id="notification-${data.id}" class="notification ${newOne}">
        <a href="${data.link}" target="${target}">
            <div class="drop_avatar"> <img src="${data.image}" alt="">
            </div>
            <div class="drop_content">
                <p> <strong>${name}</strong>  ${data.text}
                    <span class="text-link">${textLink}  </span>
                </p>
                <span class="time-ago"> ${timeago} </span>
            </div>
        </a>
    </li>
    `;
    return html;
}

function getLoadMoreHTML(data) {
    return `
    <div class="flex justify-center mt-6" id="toggle" hidden>
        <a href="/"
            class="bg-white dark:bg-gray-900 font-semibold my-3 px-6 py-2 rounded-full shadow-md dark:bg-gray-800 dark:text-white">
            Load more ..</a>
    </div>
    `;
}

function mintDropDownHTML(data) {
    var html = '';
    html = `
    <div class="mint-link">
        <a href="#" data-id="${data.id}" class="flex items-center space-x-2 flex-1 justify-end">
        </a>
        <a href="#" aria-expanded="false" class=""> <i
                class="uil-wallet text-2xl hover:bg-gray-200 rounded-full mr-1 transition dark:hover:bg-gray-701"></i>
                <span class="mint-button-text">${data.mintLabel}</span></a>
        <div class="mint-drop bg-white w-56 shadow-md mx-auto p-2 mt-12 rounded-md text-gray-500 hidden text-base border border-gray-100 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700 uk-drop uk-drop-top-right"
            uk-drop="mode: hover;pos: top-right">

            <ul class="space-y-1">
                <li>
                    <a href="#" data-id="${data.id}" data-mintchain="5"
                        class="mint flex items-center px-3 py-2 hover:bg-gray-200 hover:text-gray-800 rounded-md dark:hover:bg-gray-800">
                        <img
                            src="https://goerli.etherscan.io/images/svg/brands/ethereum-original.svg" class="chain-icon" /> Ethereum
                    </a>
                </li>
                <li>
                    <a href="#" data-id="${data.id}" data-mintchain="420"
                        class="mint flex items-center px-3 py-2 hover:bg-gray-200 hover:text-gray-800 rounded-md dark:hover:bg-gray-800">
                        <img
                            src="https://goerli-optimism.etherscan.io/images/svg/brands/main.svg" class="chain-icon" />
                        Optimism
                    </a>
                </li>
                <li>
                    <a href="#" data-id="${data.id}" data-mintchain="421613"
                        class="mint flex items-center px-3 py-2 hover:bg-gray-200 hover:text-gray-800 rounded-md dark:hover:bg-gray-800">
                        <img
                            src="https://goerli.arbiscan.io/images/svg/brands/arbitrum.svg" class="chain-icon" /> Arbitrum
                    </a>
                </li>

            </ul>

        </div>
    </div>
    `;
    return html;
}

function openseaIcon() {
    return `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block;"><path d="M24 12C24 18.6271 18.6271 24 12 24C5.37296 24 0 18.6271 0 12C0 5.37296 5.37296 0 12 0C18.6285 0 24 5.37296 24 12Z" fill="#2081E2"></path><path d="M5.92022 12.4029L5.97199 12.3216L9.09367 7.4381C9.1393 7.36661 9.24655 7.374 9.28106 7.45166C9.80258 8.62044 10.2526 10.074 10.0418 10.979C9.95176 11.3513 9.70519 11.8555 9.42778 12.3216C9.39204 12.3894 9.35258 12.456 9.31066 12.5201C9.29092 12.5497 9.25764 12.5669 9.22188 12.5669H6.01144C5.92514 12.5669 5.8746 12.4732 5.92022 12.4029Z" fill="white"></path><path d="M19.8347 13.3104V14.0834C19.8347 14.1278 19.8075 14.1673 19.7682 14.1845C19.5265 14.2881 18.6992 14.6678 18.3552 15.1462C17.4774 16.368 16.8068 18.115 15.3075 18.115H9.05308C6.83636 18.115 5.04004 16.3126 5.04004 14.0884V14.0169C5.04004 13.9577 5.0881 13.9096 5.1473 13.9096H8.63392C8.70294 13.9096 8.75348 13.9738 8.74734 14.0415C8.72266 14.2684 8.7646 14.5001 8.87185 14.711C9.07897 15.1315 9.50802 15.394 9.97158 15.394H11.6976V14.0464H9.9913C9.90378 14.0464 9.85202 13.9454 9.90256 13.8739C9.92104 13.8455 9.94201 13.8159 9.96418 13.7827C10.1257 13.5533 10.3562 13.1971 10.5856 12.7915C10.7421 12.5177 10.8938 12.2255 11.0158 11.932C11.0406 11.879 11.0602 11.8248 11.0799 11.7718C11.1132 11.6781 11.1478 11.5906 11.1725 11.503C11.1971 11.429 11.2167 11.3513 11.2365 11.2786C11.2945 11.0296 11.3192 10.7658 11.3192 10.4921C11.3192 10.3848 11.3142 10.2726 11.3043 10.1653C11.2994 10.0482 11.2846 9.93108 11.2698 9.81396C11.2599 9.7104 11.2415 9.60806 11.2218 9.50082C11.1971 9.34424 11.1625 9.1889 11.1231 9.0323L11.1095 8.97314C11.0799 8.86586 11.0553 8.76356 11.0208 8.6563C10.9234 8.3197 10.8112 7.99176 10.6928 7.68478C10.6497 7.56272 10.6004 7.4456 10.551 7.32848C10.4783 7.15216 10.4043 6.9919 10.3365 6.84024C10.302 6.7712 10.2724 6.70832 10.2428 6.6442C10.2095 6.57146 10.175 6.49872 10.1405 6.4297C10.1158 6.37668 10.0875 6.32736 10.0677 6.27804L9.85693 5.88844C9.82734 5.83544 9.87666 5.77256 9.9346 5.78858L11.2538 6.14612H11.2575C11.2599 6.14612 11.2611 6.14736 11.2625 6.14736L11.4362 6.19544L11.6274 6.2497L11.6976 6.2694V5.4853C11.6976 5.1068 12.0009 4.7998 12.3757 4.7998C12.5631 4.7998 12.7332 4.87624 12.8553 5.00076C12.9774 5.1253 13.0538 5.29544 13.0538 5.4853V6.64916L13.1943 6.68858C13.2055 6.6923 13.2166 6.69722 13.2264 6.70462C13.261 6.73052 13.3102 6.76872 13.3731 6.8156C13.4225 6.85502 13.4755 6.90312 13.5395 6.95244C13.6666 7.05476 13.8182 7.18668 13.9846 7.33834C14.029 7.37654 14.0722 7.416 14.1116 7.45546C14.3262 7.65518 14.5666 7.88942 14.7959 8.14834C14.8599 8.22108 14.9229 8.29504 14.9869 8.37272C15.0511 8.45162 15.1189 8.5293 15.1781 8.60698C15.2557 8.71054 15.3396 8.8178 15.4124 8.93C15.4469 8.98301 15.4863 9.03724 15.5196 9.09026C15.6133 9.23204 15.6959 9.37876 15.7748 9.52548C15.8081 9.59328 15.8426 9.66724 15.8722 9.74C15.9597 9.93602 16.0287 10.1358 16.0731 10.3355C16.0867 10.3786 16.0966 10.4255 16.1015 10.4674V10.4773C16.1163 10.5364 16.1213 10.5993 16.1262 10.6634C16.1459 10.8681 16.136 11.0727 16.0917 11.2786C16.0731 11.3662 16.0485 11.4488 16.0189 11.5364C15.9894 11.6201 15.9597 11.7076 15.9215 11.7903C15.8475 11.9616 15.7599 12.133 15.6564 12.2933C15.6231 12.3525 15.5837 12.4154 15.5443 12.4745C15.5011 12.5374 15.4567 12.5966 15.4173 12.6545C15.363 12.7285 15.305 12.8062 15.2459 12.8752C15.1929 12.948 15.1387 13.0208 15.0794 13.0848C14.9969 13.1822 14.918 13.2747 14.8353 13.3634C14.786 13.4215 14.733 13.4806 14.6787 13.5336C14.6257 13.5927 14.5715 13.6457 14.5222 13.6951C14.4396 13.7777 14.3706 13.8418 14.3125 13.8948L14.1769 14.0194C14.1573 14.0366 14.1313 14.0464 14.1043 14.0464H13.0538V15.394H14.3755C14.6713 15.394 14.9525 15.2892 15.1794 15.0969C15.2569 15.0291 15.596 14.7357 15.9967 14.2931C16.0103 14.2783 16.0275 14.2671 16.0473 14.2622L19.6978 13.2069C19.7657 13.1871 19.8347 13.2389 19.8347 13.3104Z" fill="white"></path></svg>
    `;
}