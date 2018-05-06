"use strict";
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
 * vCards
 */
exports.carddavVcards = [];
/**
 * CardDAV: create clients and retrieve vCards
 */
function carddavRetrieve() {
    console.log('CardDAV: creating clients');
    var vcardPromises = [];
    var _loop_1 = function (account) {
        var fname = __dirname + '/../account_' + account.url.replace(/^http[s]{0,1}:\/\//, '').replace(/[^\w-]/g, '_') + '_' + account.username + '.json';
        var xhr = new dav.transport.Basic(new dav.Credentials({
            username: account.username,
            password: account.password
        }));
        var client = new dav.Client(xhr);
        // get contacts
        var vcardPromise = es6_promise_1.Promise.all([
            getVcards(account, client),
            getPrevVcards(fname)
        ])
            .then(function (res) {
            if (res[0].length === 0)
                exports.carddavVcards.push.apply(exports.carddavVcards, __spread(res[1]));
            exports.carddavVcards.push.apply(exports.carddavVcards, __spread(res[0]));
            // compare current and previous contacts
            if (shallow_equal_object_1.shallowEqual(res[0], res[1]))
                return false;
            // write output to file
            return fs.writeJson(fname, res[0])
                .then(function () { return true; });
        });
        vcardPromises.push(vcardPromise);
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
    return es6_promise_1.Promise.all(vcardPromises);
    var e_1, _c;
}
exports.carddavRetrieve = carddavRetrieve;
function getPrevVcards(accountname) {
    return fs.readJson(accountname)
        .catch(function (err) {
        console.log(err);
        return [];
    });
}
function getVcards(account, client) {
    var vcards = [];
    return client.createAccount({
        accountType: 'carddav',
        server: account.url,
        loadCollections: true,
        loadObjects: true
    })
        .then(function (res) {
        try {
            // iterate address books
            for (var _a = __values(res.addressBooks), _b = _a.next(); !_b.done; _b = _a.next()) {
                var addressBook = _b.value;
                vcards.push.apply(vcards, __spread(addressBook.objects));
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
            }
            finally { if (e_2) throw e_2.error; }
        }
        console.log(vcards);
        return vcards;
        var e_2, _c;
    })
        .catch(function (err) {
        console.log(err);
        return [];
    });
}
