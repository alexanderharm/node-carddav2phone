"use strict";
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
var iconv = require("iconv-lite");
var md5 = require("md5");
var es6_promise_1 = require("es6-promise");
var rp = require('request-promise-native');
var xml = require("xml");
/**
 * handler for Fritz!Box
 * @param addressBooks
 * @param settingsFB
 */
function fritzBoxHandler(addressBooks, settingsFB) {
    console.log('Fritz!Box: start');
    var fritzBoxPromises = es6_promise_1.Promise.resolve(true);
    var _loop_1 = function (i) {
        var telephoneBook = settingsFB.telephoneBooks[i];
        // convert addressBooks to Fritz!Box XML
        var data = xml(fritzBoxProcessCards(telephoneBook, addressBooks), { declaration: true });
        fritzBoxPromises = fritzBoxPromises.then(function () { return fritzBoxUpdate(data, telephoneBook.id, settingsFB); });
    };
    // loop over all telephone books
    for (var i = 0; i < settingsFB.telephoneBooks.length; i++) {
        _loop_1(i);
    }
    return fritzBoxPromises
        .catch(function (err) {
        console.log('Fritz!Box: oops something went wrong');
        console.log(err);
        return es6_promise_1.Promise.resolve(false);
    });
}
exports.fritzBoxHandler = fritzBoxHandler;
/**
 * Fritz!Box: process addressBooks
 * @param telephoneBook
 * @param addressBooks
 */
function fritzBoxProcessCards(telephoneBook, addressBooks) {
    var e_1, _a, e_2, _b;
    // all entries
    var entries = [];
    // prevent duplicate entries
    var uniqueEntries = [];
    // determine which addressBooks from which accounts are needed
    var accounts = [];
    if ("accounts" in telephoneBook) {
        accounts = telephoneBook.accounts;
    }
    else {
        // default to all addressBooks
        for (var i = 0; i < addressBooks.length; i++) {
            accounts.push({ "account": i + 1 });
        }
    }
    try {
        // iterate over all accounts
        for (var accounts_1 = __values(accounts), accounts_1_1 = accounts_1.next(); !accounts_1_1.done; accounts_1_1 = accounts_1.next()) {
            var account = accounts_1_1.value;
            try {
                // iterate all vCards of the address book
                for (var _c = (e_2 = void 0, __values(addressBooks[account.account - 1])), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var vcard = _d.value;
                    // parse vCard
                    var vcf = utils_1.utilParseVcard(vcard);
                    // skip if no telephone number
                    if (vcf.tels.length === 0)
                        continue;
                    // check for dial prefix
                    var prefix = "prefix" in account ? account.prefix : '';
                    // process card (pass 'Full Name' and telephone numbers)
                    var entry = fritzBoxProcessCard(vcf, telephoneBook.fullname, telephoneBook.order, prefix, telephoneBook.duplicates, uniqueEntries);
                    if (entry)
                        entries.push(entry);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (accounts_1_1 && !accounts_1_1.done && (_a = accounts_1.return)) _a.call(accounts_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return {
        phonebooks: [{
                phonebook: __spread([
                    {
                        _attr: {
                            name: telephoneBook.name
                        }
                    }
                ], entries)
            }]
    };
}
/**
 * process single vCard
 * @param vcf
 * @param fullname
 * @param order
 * @param prefix
 * @param duplicates
 * @param uniqueEntries
 */
function fritzBoxProcessCard(vcf, fullname, order, prefix, duplicates, uniqueEntries) {
    var e_3, _a, e_4, _b, e_5, _c;
    // entry name
    var entryName = utils_1.utilNameFormat(vcf.names[0], vcf.names[1], vcf.org, fullname);
    // check for duplicates
    if (!duplicates) {
        if (uniqueEntries.indexOf(entryName) > -1)
            return;
        uniqueEntries.push(entryName);
    }
    // object to hold different kinds of phone numbers, limit to home, work, mobile, default to home
    var entries = [];
    try {
        // iterate through all numbers
        for (var _d = __values(vcf.tels), _e = _d.next(); !_e.done; _e = _d.next()) {
            var tel = _e.value;
            entries.push({ type: tel.type, number: prefix === '' ? tel.number : (prefix + tel.number).replace('+', '00') });
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
        }
        finally { if (e_3) throw e_3.error; }
    }
    // if empty return nothing
    if (entries.length === 0)
        return;
    // add VIP, QuickDial, Vanity information
    var category = 0;
    if (/fb_vip/i.test(vcf.note))
        category = 1;
    var quickDial = '';
    var quickDialNumber = '';
    var quickDialRe = /fb_quickdial\s*([0-9]{2})\s*\(([+0-9][0-9\ ]+)\)/i.exec(vcf.note);
    if (quickDialRe) {
        quickDial = quickDialRe[1];
        quickDialNumber = utils_1.utilNumberSanitize(utils_1.utilNumberConvert(quickDialRe[2]));
    }
    var vanity = '';
    var vanityNumber = '';
    var vanityRe = /fb_vanity\s*([a-z]{2,8})\s*\(([+0-9][0-9\ ]+)\)/i.exec(vcf.note);
    if (vanityRe) {
        vanity = vanityRe[1];
        vanityNumber = utils_1.utilNumberSanitize(utils_1.utilNumberConvert(vanityRe[2]));
    }
    // process all types and numbers
    var typeOrder = order.length !== 3 ? ['default'] : order;
    var i = 0;
    var telephony = [];
    try {
        for (var typeOrder_1 = __values(typeOrder), typeOrder_1_1 = typeOrder_1.next(); !typeOrder_1_1.done; typeOrder_1_1 = typeOrder_1.next()) {
            var type = typeOrder_1_1.value;
            try {
                for (var entries_1 = (e_5 = void 0, __values(entries)), entries_1_1 = entries_1.next(); !entries_1_1.done; entries_1_1 = entries_1.next()) {
                    var entry = entries_1_1.value;
                    if (type === 'default' || type === entry.type) {
                        var attr = {
                            id: i,
                            prio: i == 0 ? '1' : '0',
                            type: entry.type
                        };
                        if (entry.number === quickDialNumber)
                            attr.quickdial = quickDial;
                        if (entry.number === vanityNumber)
                            attr.vanity = vanity;
                        telephony.push({
                            number: [
                                {
                                    _attr: attr
                                },
                                entry.number
                            ]
                        });
                        i++;
                    }
                }
            }
            catch (e_5_1) { e_5 = { error: e_5_1 }; }
            finally {
                try {
                    if (entries_1_1 && !entries_1_1.done && (_c = entries_1.return)) _c.call(entries_1);
                }
                finally { if (e_5) throw e_5.error; }
            }
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (typeOrder_1_1 && !typeOrder_1_1.done && (_b = typeOrder_1.return)) _b.call(typeOrder_1);
        }
        finally { if (e_4) throw e_4.error; }
    }
    return {
        contact: [
            {
                category: category
            },
            {
                person: [{
                        realName: entryName
                    }]
            },
            {
                telephony: telephony
            }
        ]
    };
}
/**
 * get SID from Fritz!Box
 * @param settings
 */
function fritzBoxSid(settingsFB) {
    console.log('Fritz!Box: authenticate');
    return es6_promise_1.Promise.resolve()
        .then(function (res) {
        var opt = {
            uri: 'http://' + settingsFB.url + '/login_sid.lua'
        };
        return rp(opt);
    })
        .then(function (res) {
        return utils_1.utilParseXml(res);
    })
        .then(function (res) {
        var sid = res.SessionInfo.SID[0];
        // return res if applicable
        if (sid !== '0000000000000000')
            return res;
        // build challenge response
        var challenge = res.SessionInfo.Challenge[0];
        var response = challenge + '-' + md5(iconv.encode(challenge + '-' + settingsFB.password, 'ucs2'));
        var opt = {
            uri: 'http://' + settingsFB.url + '/login_sid.lua',
            qs: {
                username: settingsFB.username,
                response: response
            }
        };
        return rp(opt);
    })
        .then(function (res) {
        return utils_1.utilParseXml(res);
    })
        .then(function (res) {
        var sid = res.SessionInfo.SID[0];
        if (sid !== '0000000000000000') {
            console.log('Fritz!Box: login successful');
            return sid;
        }
        return es6_promise_1.Promise.reject('Fritz!Box: login failed');
    });
}
/**
 * Fritz!Box: update
 * @param data
 * @param telephoneBookId
 * @param settings
 */
function fritzBoxUpdate(data, telephoneBookId, settingsFB) {
    // get SID from Fritz!Box
    console.log('Fritz!Box: attempting login');
    return fritzBoxSid(settingsFB)
        .then(function (sid) {
        // update phonebook
        console.log('Fritz!Box: trying to update');
        var opt = {
            method: 'POST',
            uri: 'http://' + settingsFB.url + '/cgi-bin/firmwarecfg',
            formData: {
                sid: sid,
                PhonebookId: telephoneBookId,
                PhonebookImportFile: {
                    value: data,
                    options: {
                        filename: 'updatepb.xml',
                        contentType: 'text/xml'
                    }
                }
            }
        };
        return rp(opt);
    })
        .then(function (res) {
        // check for success
        if (res.indexOf(settingsFB.message) > -1) {
            console.log('Fritz!Box: update successful');
            return es6_promise_1.Promise.resolve(true);
        }
        console.log('Fritz!Box: update failed');
        return es6_promise_1.Promise.reject(res);
    });
}
