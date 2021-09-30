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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.carddavRetrieve = void 0;
var fs = require("fs-extra");
/**
 * fix dav lib for iCloud
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
 * CardDAV: create clients and retrieve vCards
 * @param settings
 */
function carddavRetrieve(settings) {
    console.log('CardDAV: creating clients');
    // Results
    var carddavResults = [];
    // vCards
    var carddavVcards = [];
    var vcardPromises = es6_promise_1.Promise.resolve();
    var _loop_1 = function (i) {
        var account = settings.carddav.accounts[i];
        var accountname = account.url.replace(/^http[s]{0,1}:\/\//, '').replace(/[^\w-]/g, '_');
        var username = account.username.replace(/[^\w-]/g, '_');
        var fname = __dirname + '/../account_' + accountname + '_' + username + '.json';
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
            var _a, _b;
            carddavVcards[i] = [];
            if (res[0].length === 0 && res[1].length === 0) {
                console.log(accountname + ': no vcards');
                carddavResults.push(false);
                return false;
            }
            if (res[0].length === 0) {
                console.log(accountname + ': no vcards downloaded, using stored ones');
                (_a = carddavVcards[i]).push.apply(_a, __spreadArray([], __read(res[1]), false));
                carddavResults.push(false);
                return false;
            }
            (_b = carddavVcards[i]).push.apply(_b, __spreadArray([], __read(res[0]), false));
            // compare current and previous contacts
            if ((0, shallow_equal_object_1.shallowEqual)(res[0], res[1])) {
                console.log(accountname + ': no updates');
                carddavResults.push(false);
                return false;
            }
            // write output to file
            console.log(accountname + ': updates available');
            carddavResults.push(true);
            return fs.writeJson(fname, res[0])
                .then(function () { return true; });
        });
        vcardPromises = vcardPromises.then(function (res) { return vcardPromise; });
    };
    for (var i = 0; i < settings.carddav.accounts.length; i++) {
        _loop_1(i);
    }
    return vcardPromises.then(function (res) { return [carddavResults, carddavVcards]; });
}
exports.carddavRetrieve = carddavRetrieve;
function getPrevVcards(accountname) {
    return fs.readJson(accountname)
        .catch(function (err) {
        if (err.code !== 'ENOENT')
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
        var e_1, _a, e_2, _b;
        try {
            // iterate address books
            for (var _c = __values(res.addressBooks), _d = _c.next(); !_d.done; _d = _c.next()) {
                var addressBook = _d.value;
                try {
                    for (var _e = (e_2 = void 0, __values(addressBook.objects)), _f = _e.next(); !_f.done; _f = _e.next()) {
                        var object = _f.value;
                        vcards.push(object.data.props.addressData);
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return vcards;
    })
        .catch(function (err) {
        console.log(err);
        return [];
    });
}
