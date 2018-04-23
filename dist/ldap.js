"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
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
var ldap = require('ldapjs');
var es6_promise_1 = require("es6-promise");
var Vcf = require('vcf');
/**
 * handler for LDAP
 * @param vcards
 */
function ldapHandler(vcards) {
    console.log('LDAP: start');
    // process cards
    var contacts = ldapProcessCards(vcards);
    // update LDAP
    return ldapUpdate(contacts)
        .catch(function (err) {
        console.log('LDAP: oops something went wrong');
        console.log(err);
        return es6_promise_1.Promise.resolve(false);
    });
}
exports.ldapHandler = ldapHandler;
/**
 * LDAP: process vCards
 * @param vcards
 */
function ldapProcessCards(vcards) {
    // all entries
    var entries = [];
    try {
        // iterate all vCards of the collection
        for (var vcards_1 = __values(vcards), vcards_1_1 = vcards_1.next(); !vcards_1_1.done; vcards_1_1 = vcards_1.next()) {
            var vcard = vcards_1_1.value;
            // parse vCard
            var vcf = new Vcf().parse(vcard.data.props.addressData);
            // skip if no telephone number
            var tel = vcf.get('tel');
            if (typeof tel === 'undefined')
                continue;
            // process card (pass 'Full Name' and telephone numbers)
            var names = vcf.get('n').valueOf().split(';');
            var entry = ldapProcessCard(vcf.get('uid').valueOf(), names[0].trim(), names[1].trim(), utils_1.utilOrgName(vcf), tel);
            if (entry)
                entries.push(entry);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (vcards_1_1 && !vcards_1_1.done && (_a = vcards_1.return)) _a.call(vcards_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return entries;
    var e_1, _a;
}
/**
 * process single vcard
 * @param uid
 * @param last
 * @param first
 * @param tels
 */
function ldapProcessCard(uid, last, first, org, tels) {
    // object to hold different kinds of phone numbers, limit to home, work, mobile, default to home
    var entries = [];
    // test if tel is an array
    if (!Array.isArray(tels))
        tels = [tels];
    try {
        // iterate through all numbers
        for (var tels_1 = __values(tels), tels_1_1 = tels_1.next(); !tels_1_1.done; tels_1_1 = tels_1.next()) {
            var tel = tels_1_1.value;
            // test if number
            if (!utils_1.utilNumberValid(tel.valueOf()))
                continue;
            // convert to PhoneNumber
            var phoneNumber = utils_1.utilNumberConvert(tel.valueOf());
            // determine type
            var type = utils_1.utilNumberGetType(tel.type, phoneNumber);
            // store number if of type voice
            if (type)
                entries.push({ type: type, number: utils_1.utilNumberSanitize(phoneNumber) });
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (tels_1_1 && !tels_1_1.done && (_a = tels_1.return)) _a.call(tels_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    // if empty return nothing
    if (entries.length === 0)
        return;
    // go by type order
    var telephony = {
        home: [],
        mobile: [],
        work: []
    };
    try {
        for (var entries_1 = __values(entries), entries_1_1 = entries_1.next(); !entries_1_1.done; entries_1_1 = entries_1.next()) {
            var entry = entries_1_1.value;
            telephony[entry.type].push(entry.number);
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (entries_1_1 && !entries_1_1.done && (_b = entries_1.return)) _b.call(entries_1);
        }
        finally { if (e_3) throw e_3.error; }
    }
    var telObj = {};
    if (telephony.home.length > 0)
        telObj.homePhone = telephony.home;
    if (telephony.mobile.length > 0)
        telObj.mobile = telephony.mobile;
    if (telephony.work.length > 0)
        telObj.telephoneNumber = telephony.work;
    return __assign({ uid: uid, commonName: utils_1.utilNameFormat(last, first, org), displayName: utils_1.utilNameFormat(last, first, org), surname: last, givenName: first }, telObj);
    var e_2, _a, e_3, _b;
}
/**
 * LDAP: bind
 * @param client
 */
function ldapBind(client) {
    console.log('LDAP: attempting bind');
    return new es6_promise_1.Promise(function (resolve, reject) {
        client.bind(utils_1.settings.ldap.user, utils_1.settings.ldap.password, function (err) {
            if (err)
                reject(err);
            resolve(true);
        });
    });
}
function ldapSearch(client) {
    console.log('LDAP: attempting search');
    var opts = {
        filter: '(objectClass=inetOrgPerson)',
        scope: 'sub',
        attributes: 'dn'
    };
    var entries = [];
    return new es6_promise_1.Promise(function (resolve, reject) {
        client.search(utils_1.settings.ldap.searchBase, opts, function (err, res) {
            if (err)
                reject(err);
            res.on('searchEntry', function (entry) {
                entries.push(entry);
            });
            res.on('error', function (err) {
                reject(err);
            });
            res.on('end', function (res) {
                console.log('LDAP: search complete');
                resolve(entries);
            });
        });
    });
}
function ldapDelete(client, entries) {
    console.log('LDAP: attempting delete');
    var delOps = [];
    var _loop_1 = function (entry) {
        var p = new es6_promise_1.Promise(function (resolve, reject) {
            client.del(entry, function (err) {
                if (err)
                    reject(err);
                resolve(true);
            });
        });
        delOps.push(p);
    };
    try {
        for (var entries_2 = __values(entries), entries_2_1 = entries_2.next(); !entries_2_1.done; entries_2_1 = entries_2.next()) {
            var entry = entries_2_1.value;
            _loop_1(entry);
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (entries_2_1 && !entries_2_1.done && (_a = entries_2.return)) _a.call(entries_2);
        }
        finally { if (e_4) throw e_4.error; }
    }
    return es6_promise_1.Promise.all(delOps).then(function (res) {
        console.log('LDAP: delete complete');
        return res;
    });
    var e_4, _a;
}
function ldapAdd(client, contacts) {
    console.log('LDAP: attempting add');
    var addOps = [];
    var _loop_2 = function (contact) {
        var p = new es6_promise_1.Promise(function (resolve, reject) {
            client.add('uid=' + contact.uid + ',' + utils_1.settings.ldap.searchBase, contact, function (err) {
                if (err)
                    reject(err);
                resolve(true);
            });
        });
        addOps.push(p);
    };
    try {
        for (var contacts_1 = __values(contacts), contacts_1_1 = contacts_1.next(); !contacts_1_1.done; contacts_1_1 = contacts_1.next()) {
            var contact = contacts_1_1.value;
            _loop_2(contact);
        }
    }
    catch (e_5_1) { e_5 = { error: e_5_1 }; }
    finally {
        try {
            if (contacts_1_1 && !contacts_1_1.done && (_a = contacts_1.return)) _a.call(contacts_1);
        }
        finally { if (e_5) throw e_5.error; }
    }
    return es6_promise_1.Promise.all(addOps).then(function (res) {
        console.log('LDAP: add complete');
        return res;
    });
    var e_5, _a;
}
/**
 * LDAP: update
 * @param contacts
 */
function ldapUpdate(contacts) {
    /**
     * since we don't know what exactly changed
     * all entries are deleted and recreated
     */
    // create client
    var client = ldap.createClient({
        url: utils_1.settings.ldap.url
    });
    // bind
    return ldapBind(client)
        .then(function (res) { return ldapSearch(client); })
        .then(function (entries) {
        return ldapDelete(client, entries);
    })
        .then(function (res) {
        // add entries
        return ldapAdd(client, contacts);
    })
        .then(function (res) {
        // check for success
        console.log('LDAP: update successful');
        return es6_promise_1.Promise.resolve(true);
    });
}
