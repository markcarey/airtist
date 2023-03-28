global.__base = __dirname + '/';
const functions = require("firebase-functions");

var art = require(__base + 'art');

exports.artApi = functions.runWith({secrets: ["AIRTIST_HOT_PRIV"]}).https.onRequest((req, res) => {
    return art.api(req, res);
}); // artApi

exports.artNewUser = functions.runWith({secrets: ["AIRTIST_HOT_PRIV"]}).firestore.document('users/{address}').onCreate((snap, context) => {
    return art.newUser(snap, context);
}); // artNewUser

exports.artNewPost = functions.runWith({secrets: ["AIRTIST_HOT_PRIV"]}).firestore.document('posts/{id}').onCreate((snap, context) => {
    return art.newPost(snap, context);
}); // artNewPost

exports.artNewLike = functions.firestore.document('posts/{postId}/likes/{likeId}').onCreate((snap, context) => {
    return art.newLike(snap, context);
}); // artNewLike
exports.artNewComment = functions.firestore.document('posts/{postId}/comments/{commentId}').onCreate((snap, context) => {
    return art.newComment(snap, context);
}); // artNewComment
exports.artNewRepost = functions.firestore.document('posts/{postId}/reposts/{repostId}').onCreate((snap, context) => {
    return art.newRepost(snap, context);
}); // artNewRepost

exports.artUpdateUser = functions.runWith({secrets: ["AIRTIST_HOT_PRIV"]}).firestore.document('users/{address}').onUpdate((change, context) => {
    return art.updateUser(change, context);
});

exports.artCronMint = functions.pubsub.schedule('every 1 minutes').onRun((context) => {
    return art.cronMint(context);
}); // artCronMint

exports.artCronDeploy = functions.pubsub.schedule('every 2 minutes').onRun((context) => {
    return art.cronDeploy(context);
}); // artCronDeploy



exports.artTest = functions.runWith({secrets: ["AIRTIST_HOT_PRIV"]}).https.onRequest((req, res) => {
    return art.apiOld(req, res);
}); // artTest



