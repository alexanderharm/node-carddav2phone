"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
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
exports.ldapHandler = void 0;
var utils_1 = require("./utils");
var ldap = require('ldapjs');
var es6_promise_1 = require("es6-promise");
/**
 * handler for LDAP
 * @param addressBooks
 * @param settingsLdap
 */
function ldapHandler(addressBooks, settingsLdap) {
    console.log('LDAP: start');
    var ldapPromises = es6_promise_1.Promise.resolve(true);
    var _loop_1 = function (i) {
        var telephoneBook = settingsLdap.telephoneBooks[i];
        // process address books
        var contacts = ldapProcessCards(telephoneBook, addressBooks);
        ldapPromises = ldapPromises.then(function () { return ldapUpdate(contacts, telephoneBook); });
    };
    // loop over all telephone books
    for (var i = 0; i < settingsLdap.telephoneBooks.length; i++) {
        _loop_1(i);
    }
    return ldapPromises
        .catch(function (err) {
        console.log('LDAP: oops something went wrong');
        console.log(err);
        return es6_promise_1.Promise.resolve(false);
    });
}
exports.ldapHandler = ldapHandler;
/**
 * LDAP: process address books
 * @param telephoneBook
 * @param addressBooks
 */
function ldapProcessCards(telephoneBook, addressBooks) {
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
                    var vcf = (0, utils_1.utilParseVcard)(vcard);
                    // skip if no name or telephone number
                    if (vcf.names.length === 0)
                        continue;
                    if (vcf.tels.length === 0)
                        continue;
                    // check for dial prefix
                    var prefix = "prefix" in account ? account.prefix : '';
                    // process card
                    var entry = ldapProcessCard(vcf, prefix, telephoneBook.fullname, telephoneBook.duplicates, uniqueEntries);
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
    return entries;
}
/**
 * process single vcard
 * @param vcf
 * @param prefix
 * @param fullname
  * @param duplicates
 * @param uniqueEntries
 */
function ldapProcessCard(vcf, prefix, fullname, duplicates, uniqueEntries) {
    var e_3, _a, e_4, _b;
    // entry name
    var entryName = (0, utils_1.utilNameFormat)(vcf.names[0], vcf.names[1], vcf.org, fullname);
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
        for (var _c = __values(vcf.tels), _d = _c.next(); !_d.done; _d = _c.next()) {
            var tel = _d.value;
            entries.push({ type: tel.type, number: prefix === '' ? tel.number : (prefix + tel.number).replace('+', '00') });
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
        }
        finally { if (e_3) throw e_3.error; }
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
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (entries_1_1 && !entries_1_1.done && (_b = entries_1.return)) _b.call(entries_1);
        }
        finally { if (e_4) throw e_4.error; }
    }
    var contact = {};
    contact.surname = vcf.names[0];
    contact.givenName = vcf.names[1];
    if (telephony.home.length > 0)
        contact.homePhone = telephony.home[0];
    if (telephony.mobile.length > 0)
        contact.mobile = telephony.mobile[0];
    if (telephony.work.length > 0)
        contact.telephoneNumber = telephony.work[0];
    return __assign({ objectClass: ['top', 'person', 'inetOrgPerson', 'organizationalPerson'], uid: vcf.uid, commonName: entryName, displayName: entryName }, contact);
}
/**
 * LDAP: bind
 * @param client
 * @param user
 * @param password
 */
function ldapBind(client, user, password) {
    console.log('LDAP: attempting bind');
    return new es6_promise_1.Promise(function (resolve, reject) {
        client.bind(user, password, function (err) {
            if (err)
                reject(err);
            resolve(true);
        });
    });
}
function ldapSearch(client, searchBase) {
    console.log('LDAP: attempting search');
    var opts = {
        filter: '(objectClass=inetOrgPerson)',
        scope: 'sub',
        attributes: 'dn'
    };
    var entries = [];
    return new es6_promise_1.Promise(function (resolve, reject) {
        client.search(searchBase, opts, function (err, res) {
            if (err)
                reject(err);
            res.on('searchEntry', function (entry) {
                entries.push(entry.objectName);
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
    var e_5, _a;
    console.log('LDAP: attempting delete');
    var delOps = [];
    var _loop_2 = function (entry) {
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
            _loop_2(entry);
        }
    }
    catch (e_5_1) { e_5 = { error: e_5_1 }; }
    finally {
        try {
            if (entries_2_1 && !entries_2_1.done && (_a = entries_2.return)) _a.call(entries_2);
        }
        finally { if (e_5) throw e_5.error; }
    }
    return es6_promise_1.Promise.all(delOps).then(function (res) {
        console.log('LDAP: delete complete');
        return res;
    });
}
function ldapAdd(client, contacts, searchBase) {
    var e_6, _a;
    console.log('LDAP: attempting add');
    var addOps = [];
    var _loop_3 = function (contact) {
        if (contact) {
            var p = new es6_promise_1.Promise(function (resolve, reject) {
                client.add('uid=' + contact.uid + ',' + searchBase, contact, function (err) {
                    if (err)
                        reject(err);
                    resolve(true);
                });
            });
            addOps.push(p);
        }
    };
    try {
        for (var contacts_1 = __values(contacts), contacts_1_1 = contacts_1.next(); !contacts_1_1.done; contacts_1_1 = contacts_1.next()) {
            var contact = contacts_1_1.value;
            _loop_3(contact);
        }
    }
    catch (e_6_1) { e_6 = { error: e_6_1 }; }
    finally {
        try {
            if (contacts_1_1 && !contacts_1_1.done && (_a = contacts_1.return)) _a.call(contacts_1);
        }
        finally { if (e_6) throw e_6.error; }
    }
    return es6_promise_1.Promise.all(addOps).then(function (res) {
        console.log('LDAP: add complete');
        return res;
    });
}
/**
 * LDAP: update
 * @param contacts
 * @param telephoneBook
 */
function ldapUpdate(contacts, telephoneBook) {
    /**
     * since we don't know what exactly changed
     * all entries are deleted and recreated
     */
    // create client
    var client = ldap.createClient({ url: telephoneBook.url });
    // bind
    return ldapBind(client, telephoneBook.user, telephoneBook.password)
        // search
        .then(function (res) { return ldapSearch(client, telephoneBook.searchBase); })
        .then(function (entries) { return ldapDelete(client, entries); })
        .then(function (res) { return ldapAdd(client, contacts, telephoneBook.searchBase); })
        .then(function (res) {
        // check for success
        console.log('LDAP: update successful');
        return es6_promise_1.Promise.resolve(true);
    });
}
