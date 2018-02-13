"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
const fs = require("fs-extra");
/**
 * fix dav lib
 */
var davBefore = fs.readFileSync(__dirname + '/../node_modules/dav/dav.js', { encoding: 'utf8' });
var davAfter = davBefore
    .replace(/\{ name: 'displayname', namespace: ns\.DAV \}, /g, '')
    .replace(/res\.props\.displayname/g, '\'card\'');
fs.writeFileSync(__dirname + '/../node_modules/dav/dav.js', davAfter, 'utf8');
var dav = require('dav');
const es6_promise_1 = require("es6-promise");
//dav.debug.enabled = true
/**
 * The clients
 */
var clients = [];
/**
 * CardDAV: create client accounts
 */
function carddavClients() {
    console.log('CardDAV: creating clients');
    let createAccounts = [];
    for (let account of utils_1.settings.carddav.accounts) {
        let xhr = new dav.transport.Basic(new dav.Credentials({
            username: account.username,
            password: account.password
        }));
        let client = new dav.Client(xhr); // account.url.indexOf('.icloud.com') > -1 ? new davIcloud.Client(xhr) : new dav.Client(xhr)
        let clientPromise = client.createAccount({
            accountType: 'carddav',
            server: account.url,
            loadCollections: true,
            loadObjects: true
        })
            .then((account) => {
            clients.push({
                client: client,
                addressBooks: account.addressBooks
            });
            return es6_promise_1.Promise.resolve(true);
        });
        createAccounts.push(clientPromise);
    }
    return es6_promise_1.Promise.all(createAccounts).then((res) => {
        console.log('CardDAV: clients created');
        return es6_promise_1.Promise.resolve(true);
    });
}
exports.carddavClients = carddavClients;
// update function
function carddavUpdate() {
    console.log('CardDAV: updating');
    let updates = [];
    let ctags = [];
    for (let client of clients) {
        // iterate address books
        for (let addressBook of client.addressBooks) {
            ctags.push(addressBook.ctag);
            updates.push(client.client
                .syncAddressBook(addressBook)
                .catch((err) => {
                console.log('CardDAV: updating address book failed');
                return es6_promise_1.Promise.resolve(false);
            }));
        }
    }
    return es6_promise_1.Promise
        .all(updates)
        .then((res) => {
        for (let client of clients) {
            // iterate address books
            for (let addressBook of client.addressBooks) {
                if (ctags.indexOf(addressBook.ctag) < 0) {
                    console.log('CardDAV: updates available');
                    return es6_promise_1.Promise.resolve(true);
                }
            }
        }
        console.log('CardDAV: no updates');
        return es6_promise_1.Promise.resolve(false);
    });
}
exports.carddavUpdate = carddavUpdate;
/**
 * CardDAV: get vCards
 */
function carddavVcards() {
    let vcards = [];
    for (let client of clients) {
        // iterate address books
        for (let addressBook of client.addressBooks) {
            vcards.push(...addressBook.objects);
        }
    }
    return vcards;
}
exports.carddavVcards = carddavVcards;
