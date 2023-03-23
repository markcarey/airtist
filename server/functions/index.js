global.__base = __dirname + '/';
const functions = require("firebase-functions");

var art = require(__base + 'art');
exports.artApi = functions.runWith({secrets: ["AIRTIST_HOT_PRIV"]}).https.onRequest((req, res) => {
    return art.api(req, res);
}); // artApi

exports.artNewUser = functions.runWith({secrets: ["AIRTIST_HOT_PRIV"]}).firestore.document('users/{address}').onCreate((snap, context) => {
    return art.newUser(snap, context);
}); // artNewUser


