"use strict";
var __values = (this && this.__values) || function (o) {
    var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
    if (m) return m.call(o);
    return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spread = (this && this.__spread) || function () {
    for (var ar = [], i = 0; i < arguments.length; i++) ar = ar.concat(__read(arguments[i]));
    return ar;
};
Object.defineProperty(exports, "__esModule", { value: true });
var utils_1 = require("./utils");
var fs = require("fs-extra");
/**
 * fix dav lib
 */
var davBefore = fs.readFileSync(__dirname + '/../node_modules/dav/dav.js', { encoding: 'utf8' });
var davAfter = davBefore
    .replace(/\{ name: 'displayname', namespace: ns\.DAV \}, /g, '')
    .replace(/res\.props\.displayname/g, '\'card\'');
fs.writeFileSync(__dirname + '/../node_modules/dav/dav.js', davAfter, 'utf8');
var dav = require('dav');
var es6_promise_1 = require("es6-promise");
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
    var createAccounts = [];
    var _loop_1 = function (account) {
        var xhr = new dav.transport.Basic(new dav.Credentials({
            username: account.username,
            password: account.password
        }));
        var client = new dav.Client(xhr); // account.url.indexOf('.icloud.com') > -1 ? new davIcloud.Client(xhr) : new dav.Client(xhr)
        var clientPromise = client.createAccount({
            accountType: 'carddav',
            server: account.url,
            loadCollections: true,
            loadObjects: true
        })
            .then(function (account) {
            clients.push({
                client: client,
                addressBooks: account.addressBooks
            });
            return es6_promise_1.Promise.resolve(true);
        });
        createAccounts.push(clientPromise);
    };
    try {
        for (var _a = __values(utils_1.settings.carddav.accounts), _b = _a.next(); !_b.done; _b = _a.next()) {
            var account = _b.value;
            _loop_1(account);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return es6_promise_1.Promise.all(createAccounts).then(function (res) {
        console.log('CardDAV: clients created');
        return es6_promise_1.Promise.resolve(true);
    });
    var e_1, _c;
}
exports.carddavClients = carddavClients;
// update function
function carddavUpdate() {
    console.log('CardDAV: updating');
    var updates = [];
    var ctags = [];
    try {
        for (var clients_1 = __values(clients), clients_1_1 = clients_1.next(); !clients_1_1.done; clients_1_1 = clients_1.next()) {
            var client = clients_1_1.value;
            try {
                // iterate address books
                for (var _a = __values(client.addressBooks), _b = _a.next(); !_b.done; _b = _a.next()) {
                    var addressBook = _b.value;
                    ctags.push(addressBook.ctag);
                    updates.push(client.client
                        .syncAddressBook(addressBook)
                        .catch(function (err) {
                        console.log('CardDAV: updating address book failed');
                        return es6_promise_1.Promise.resolve(false);
                    }));
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (clients_1_1 && !clients_1_1.done && (_d = clients_1.return)) _d.call(clients_1);
        }
        finally { if (e_3) throw e_3.error; }
    }
    return es6_promise_1.Promise
        .all(updates)
        .then(function (res) {
        try {
            for (var clients_2 = __values(clients), clients_2_1 = clients_2.next(); !clients_2_1.done; clients_2_1 = clients_2.next()) {
                var client = clients_2_1.value;
                try {
                    // iterate address books
                    for (var _a = __values(client.addressBooks), _b = _a.next(); !_b.done; _b = _a.next()) {
                        var addressBook = _b.value;
                        if (ctags.indexOf(addressBook.ctag) < 0) {
                            console.log('CardDAV: updates available');
                            return es6_promise_1.Promise.resolve(true);
                        }
                    }
                }
                catch (e_4_1) { e_4 = { error: e_4_1 }; }
                finally {
                    try {
                        if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                    }
                    finally { if (e_4) throw e_4.error; }
                }
            }
        }
        catch (e_5_1) { e_5 = { error: e_5_1 }; }
        finally {
            try {
                if (clients_2_1 && !clients_2_1.done && (_d = clients_2.return)) _d.call(clients_2);
            }
            finally { if (e_5) throw e_5.error; }
        }
        console.log('CardDAV: no updates');
        return es6_promise_1.Promise.resolve(false);
        var e_5, _d, e_4, _c;
    });
    var e_3, _d, e_2, _c;
}
exports.carddavUpdate = carddavUpdate;
/**
 * CardDAV: get vCards
 */
function carddavVcards() {
    var vcards = [];
    try {
        for (var clients_3 = __values(clients), clients_3_1 = clients_3.next(); !clients_3_1.done; clients_3_1 = clients_3.next()) {
            var client = clients_3_1.value;
            try {
                // iterate address books
                for (var _a = __values(client.addressBooks), _b = _a.next(); !_b.done; _b = _a.next()) {
                    var addressBook = _b.value;
                    vcards.push.apply(vcards, __spread(addressBook.objects));
                }
            }
            catch (e_6_1) { e_6 = { error: e_6_1 }; }
            finally {
                try {
                    if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                }
                finally { if (e_6) throw e_6.error; }
            }
        }
    }
    catch (e_7_1) { e_7 = { error: e_7_1 }; }
    finally {
        try {
            if (clients_3_1 && !clients_3_1.done && (_d = clients_3.return)) _d.call(clients_3);
        }
        finally { if (e_7) throw e_7.error; }
    }
    return vcards;
    var e_7, _d, e_6, _c;
}
exports.carddavVcards = carddavVcards;
