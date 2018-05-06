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
var shallow_equal_object_1 = require("shallow-equal-object");
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
        var client = new dav.Client(xhr);
        // get contacts
        var clientPromise = es6_promise_1.Promise.all([
            client.createAccount({
                accountType: 'carddav',
                server: account.url,
                loadCollections: true,
                loadObjects: true
            }),
            fs.readJson(__dirname + '/../account_' + account.url.replace(/^http[s]{0,1}:\/\//, '').replace(/[^\w-]/g, '_') + '.json')
                .catch(function (err) {
                console.log(err);
                return {};
            })
        ])
            .then(function (res) {
            // store
            clients.push(res[0].addressBooks);
            // compare current and previous contacts
            if (shallow_equal_object_1.shallowEqual(res[0].addressBooks, res[1])) {
                return false;
            }
            // write output to file
            return fs.writeJson(__dirname + '/../account_' + account.url.replace(/^http[s]{0,1}:\/\//, '').replace(/[^\w-]/g, '_') + '.json', res[0].addressBooks)
                .then(function (res) { return true; });
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
    return es6_promise_1.Promise.all(createAccounts);
    var e_1, _c;
}
exports.carddavClients = carddavClients;
/**
 * CardDAV: get vCards
 */
function carddavVcards() {
    var vcards = [];
    try {
        for (var clients_1 = __values(clients), clients_1_1 = clients_1.next(); !clients_1_1.done; clients_1_1 = clients_1.next()) {
            var client = clients_1_1.value;
            try {
                // iterate address books
                for (var client_1 = __values(client), client_1_1 = client_1.next(); !client_1_1.done; client_1_1 = client_1.next()) {
                    var addressBook = client_1_1.value;
                    vcards.push.apply(vcards, __spread(addressBook.objects));
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (client_1_1 && !client_1_1.done && (_a = client_1.return)) _a.call(client_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (clients_1_1 && !clients_1_1.done && (_b = clients_1.return)) _b.call(clients_1);
        }
        finally { if (e_3) throw e_3.error; }
    }
    return vcards;
    var e_3, _b, e_2, _a;
}
exports.carddavVcards = carddavVcards;
