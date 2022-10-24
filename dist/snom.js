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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.snomTbookHandler = exports.snomHandler = void 0;
var utils_1 = require("./utils");
var mailer_1 = require("./mailer");
var fs = require("fs-extra");
var es6_promise_1 = require("es6-promise");
var xml = require("xml");
/**
 * handler for Snom
 * @param addressBooks
 * @param settingsSnom
 */
function snomHandler(addressBooks, settingsSnom) {
    console.log('Snom: start');
    var snomHandlers = [];
    if (settingsSnom.xcap)
        snomHandlers.push(snomXcapHandler(addressBooks, settingsSnom.xcap));
    if (settingsSnom.tbook)
        snomHandlers.push(snomTbookHandler(addressBooks, settingsSnom.tbook));
    return es6_promise_1.Promise.all(snomHandlers);
}
exports.snomHandler = snomHandler;
/**
 * Snom XCAP: handler function
 * @param addressBooks
 * @param settingsSnomXcap
 */
function snomXcapHandler(addressBooks, settingsSnomXcap) {
    console.log('Snom XCAP: start');
    var snomXcapPromises = es6_promise_1.Promise.resolve(true);
    var _loop_1 = function (i) {
        var telephoneBook = settingsSnomXcap.telephoneBooks[i];
        // convert vCards to XCAP XML
        var data = xml(snomXcapProcessCards(telephoneBook, addressBooks), { declaration: true });
        snomXcapPromises = snomXcapPromises.then(function () { return snomXcapUpdate(data, telephoneBook, settingsSnomXcap); });
    };
    // loop over all telephone books
    for (var i = 0; i < settingsSnomXcap.telephoneBooks.length; i++) {
        _loop_1(i);
    }
    return snomXcapPromises
        .catch(function (err) {
        console.log('Snom XCAP: oops something went wrong');
        console.log(err);
        return es6_promise_1.Promise.resolve(false);
    });
}
/**
 * Snom XCAP: process address books
 * @param telephoneBook
 * @param addressBooks
 */
function snomXcapProcessCards(telephoneBook, addressBooks) {
    var e_1, _a, e_2, _b;
    // all entries
    var entries = [];
    // prevent duplicate entries
    var uniqueEntries = [];
    // XCAP does not like duplicate numbers!
    var xcapUniqueNumbers = [];
    // determine which vCards from which accounts are needed
    var accounts = [];
    if ("accounts" in telephoneBook) {
        accounts = telephoneBook.accounts;
    }
    else {
        // default to all address books
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
                    if (vcf.lastName.length === 0 && vcf.firstName.length === 0 && vcf.orgName.length === 0)
                        continue;
                    if (vcf.tels.length === 0)
                        continue;
                    // check for dial prefix
                    var prefix = "prefix" in account ? account.prefix : '';
                    // process card
                    var entry = snomXcapProcessCard(vcf, telephoneBook.fullname, telephoneBook.order, prefix, telephoneBook.duplicates, uniqueEntries, xcapUniqueNumbers);
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
        'resource-lists': [
            {
                _attr: {
                    'xmlns': 'urn:ietf:params:xml:ns:resource-lists',
                    'xmlns:cp': 'counterpath:properties'
                }
            },
            {
                list: __spreadArray([
                    {
                        _attr: {
                            name: 'Contact List'
                        }
                    }
                ], __read(entries), false)
            }
        ]
    };
}
/**
 * Snom XCAP: process single vcard
 * @param vcf
 * @param fullname
 * @param order
 * @param prefix
 * @param duplicates
 * @param uniqueEntries
 * @param xcapUniqueNumbers
 */
function snomXcapProcessCard(vcf, fullname, order, prefix, duplicates, uniqueEntries, xcapUniqueNumbers) {
    var e_3, _a, e_4, _b, e_5, _c;
    // entry name
    var entryName = (0, utils_1.utilNameFormat)(vcf.lastName, vcf.firstName, vcf.orgName, fullname);
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
            // check for duplicate phone number
            if (xcapUniqueNumbers.indexOf(tel.number) > -1) {
                var errorMsg = 'Duplicate number (' + tel.number + ') on ' + entryName;
                console.log('WARNING: ' + errorMsg);
                (0, mailer_1.sendMail)('Sync: Duplicate phone number detected', errorMsg);
                continue;
            }
            xcapUniqueNumbers.push(tel.number);
            // store entry
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
    // process all types and numbers
    var typeOrder = order.length !== 3 ? ['default'] : order;
    var telephony = [];
    var count = {
        work: 0,
        home: 0,
        mobile: 0
    };
    try {
        // go by type order
        for (var typeOrder_1 = __values(typeOrder), typeOrder_1_1 = typeOrder_1.next(); !typeOrder_1_1.done; typeOrder_1_1 = typeOrder_1.next()) {
            var type = typeOrder_1_1.value;
            try {
                for (var entries_1 = (e_5 = void 0, __values(entries)), entries_1_1 = entries_1.next(); !entries_1_1.done; entries_1_1 = entries_1.next()) {
                    var entry = entries_1_1.value;
                    if (type === 'default' || type === entry.type) {
                        var n = entry.type.replace('work', 'business') + '_number';
                        if (count[entry.type] > 0)
                            n += '#' + count[entry.type];
                        telephony.push({
                            'cp:prop': [
                                {
                                    _attr: {
                                        name: n,
                                        value: entry.number
                                    }
                                }
                            ]
                        });
                        count[entry.type]++;
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
        entry: __spreadArray([
            {
                'display-name': entryName
            },
            {
                'cp:prop': [
                    {
                        _attr: {
                            name: 'entry_id',
                            value: vcf.uid
                        }
                    }
                ]
            },
            {
                'cp:prop': [
                    {
                        _attr: {
                            name: 'surname',
                            value: vcf.lastName
                        }
                    }
                ]
            },
            {
                'cp:prop': [
                    {
                        _attr: {
                            name: 'given_name',
                            value: vcf.firstName
                        }
                    }
                ]
            },
            {
                'cp:prop': [
                    {
                        _attr: {
                            name: 'company',
                            value: vcf.orgName
                        }
                    }
                ]
            }
        ], __read(telephony), false)
    };
}
/**
 * Snom XCAP: update
 * @param data
 * @param telephoneBook
 * @param settingsSnomXcap
 */
function snomXcapUpdate(data, telephoneBook, settingsSnomXcap) {
    var e_6, _a;
    console.log('Snom XCAP: trying to update');
    var updates = [];
    try {
        for (var _b = __values(telephoneBook.usernames), _c = _b.next(); !_c.done; _c = _b.next()) {
            var username = _c.value;
            // build path
            var path = settingsSnomXcap.webroot.trim();
            if (path.slice(-1) !== '/')
                path += '/';
            path += settingsSnomXcap.dir.trim().replace(/^\//, '');
            if (path.slice(-1) !== '/')
                path += '/';
            path += 'users/sip:' + username.trim() + '/';
            path += telephoneBook.filename.trim();
            updates.push(fs.outputFile(path, data, { encoding: 'utf8' }));
        }
    }
    catch (e_6_1) { e_6 = { error: e_6_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_6) throw e_6.error; }
    }
    return es6_promise_1.Promise.all(updates)
        .then(function (res) {
        console.log('Snom XCAP: update successful');
        return es6_promise_1.Promise.resolve(true);
    });
}
/**
 * handler for snom XML
 * @param addressBooks
 * @param settingsSnomTbook
 */
function snomTbookHandler(addressBooks, settingsSnomTbook) {
    console.log('SnomTbook: start');
    var snomTbookPromises = es6_promise_1.Promise.resolve(true);
    var _loop_2 = function (i) {
        var telephoneBook = settingsSnomTbook.telephoneBooks[i];
        // convert vCards to  XML
        var data = xml(snomTbookProcessCards(telephoneBook, addressBooks), { declaration: true });
        snomTbookPromises = snomTbookPromises.then(function () { return snomTbookUpdate(data, telephoneBook, settingsSnomTbook); });
    };
    // loop over all telephone books
    for (var i = 0; i < settingsSnomTbook.telephoneBooks.length; i++) {
        _loop_2(i);
    }
    return snomTbookPromises
        .catch(function (err) {
        console.log('SnomTbook: oops something went wrong');
        console.log(err);
        return es6_promise_1.Promise.resolve(false);
    });
}
exports.snomTbookHandler = snomTbookHandler;
/**
 * SnomTbook : process address books
 * @param telephoneBook
 * @param addressBooks
 */
function snomTbookProcessCards(telephoneBook, addressBooks) {
    var e_7, _a, e_8, _b;
    // all entries
    var entries = [];
    // prevent duplicate entries
    var uniqueEntries = [];
    // determine which vCards from which accounts are needed
    var accounts = [];
    if ("accounts" in telephoneBook) {
        accounts = telephoneBook.accounts;
    }
    else {
        // default to all address books
        for (var i = 0; i < addressBooks.length; i++) {
            accounts.push({ "account": i + 1 });
        }
    }
    // replace work with business
    var telephoneBookOrder = telephoneBook.order;
    if (telephoneBookOrder.indexOf('work') > -1)
        telephoneBookOrder[telephoneBookOrder.indexOf('work')] = 'business';
    try {
        // iterate over all accounts
        for (var accounts_2 = __values(accounts), accounts_2_1 = accounts_2.next(); !accounts_2_1.done; accounts_2_1 = accounts_2.next()) {
            var account = accounts_2_1.value;
            try {
                // iterate all vCards of the address book
                for (var _c = (e_8 = void 0, __values(addressBooks[account.account - 1])), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var vcard = _d.value;
                    // parse vCard
                    var vcf = (0, utils_1.utilParseVcard)(vcard);
                    // skip if no telephone number
                    if (vcf.tels.length === 0)
                        continue;
                    // check for dial prefix
                    var prefix = "prefix" in account ? account.prefix : '';
                    // process card
                    var entry = snomTbookProcessCard(vcf, telephoneBook.fullname, telephoneBookOrder, prefix, telephoneBook.duplicates, uniqueEntries);
                    if (entry)
                        entries.push.apply(entries, __spreadArray([], __read(entry), false));
                }
            }
            catch (e_8_1) { e_8 = { error: e_8_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                }
                finally { if (e_8) throw e_8.error; }
            }
        }
    }
    catch (e_7_1) { e_7 = { error: e_7_1 }; }
    finally {
        try {
            if (accounts_2_1 && !accounts_2_1.done && (_a = accounts_2.return)) _a.call(accounts_2);
        }
        finally { if (e_7) throw e_7.error; }
    }
    return {
        tbook: __spreadArray([
            { _attr: { complete: 'true' } }
        ], __read(entries), false)
    };
}
/**
 * SnomTbook : process single vcard
 * @param vcf
 * @param fullname
 * @param order
 * @param prefix
 * @param duplicates
 * @param uniqueEntries
 */
function snomTbookProcessCard(vcf, fullname, order, prefix, duplicates, uniqueEntries) {
    var e_9, _a, e_10, _b, e_11, _c, e_12, _d, e_13, _e;
    // entry name
    var entryName = (0, utils_1.utilNameFormat)(vcf.lastName, vcf.firstName, vcf.orgName, fullname);
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
        for (var _f = __values(vcf.tels), _g = _f.next(); !_g.done; _g = _f.next()) {
            var tel = _g.value;
            var type = tel.type === 'work' ? 'business' : tel.type;
            entries.push({ type: type, number: (prefix === '' ? tel.number : prefix + tel.number).replace('+', '00') });
        }
    }
    catch (e_9_1) { e_9 = { error: e_9_1 }; }
    finally {
        try {
            if (_g && !_g.done && (_a = _f.return)) _a.call(_f);
        }
        finally { if (e_9) throw e_9.error; }
    }
    // if empty return nothing
    if (entries.length === 0)
        return;
    // process all types and numbers
    var typeOrder = order.length !== 3 ? ['default'] : order;
    var i = 0;
    var telephony = [];
    // depends on quantity of phone numbers
    var referenceNumber = '0';
    if (entries.length === 1) {
        try {
            for (var typeOrder_2 = __values(typeOrder), typeOrder_2_1 = typeOrder_2.next(); !typeOrder_2_1.done; typeOrder_2_1 = typeOrder_2.next()) {
                var type = typeOrder_2_1.value;
                try {
                    for (var entries_2 = (e_11 = void 0, __values(entries)), entries_2_1 = entries_2.next(); !entries_2_1.done; entries_2_1 = entries_2.next()) {
                        var entry = entries_2_1.value;
                        if (type === 'default' || type === entry.type) {
                            telephony.push({ item: [
                                    {
                                        _attr: { context: 'active' }
                                    },
                                    {
                                        first_name: vcf.firstName
                                    },
                                    {
                                        last_name: vcf.lastName
                                    },
                                    {
                                        organization: vcf.orgName
                                    },
                                    {
                                        number: entry.number
                                    },
                                    {
                                        number_type: entry.type
                                    }
                                ]
                            });
                            i++;
                        }
                    }
                }
                catch (e_11_1) { e_11 = { error: e_11_1 }; }
                finally {
                    try {
                        if (entries_2_1 && !entries_2_1.done && (_c = entries_2.return)) _c.call(entries_2);
                    }
                    finally { if (e_11) throw e_11.error; }
                }
            }
        }
        catch (e_10_1) { e_10 = { error: e_10_1 }; }
        finally {
            try {
                if (typeOrder_2_1 && !typeOrder_2_1.done && (_b = typeOrder_2.return)) _b.call(typeOrder_2);
            }
            finally { if (e_10) throw e_10.error; }
        }
    }
    else {
        try {
            for (var typeOrder_3 = __values(typeOrder), typeOrder_3_1 = typeOrder_3.next(); !typeOrder_3_1.done; typeOrder_3_1 = typeOrder_3.next()) {
                var type = typeOrder_3_1.value;
                try {
                    for (var entries_3 = (e_13 = void 0, __values(entries)), entries_3_1 = entries_3.next(); !entries_3_1.done; entries_3_1 = entries_3.next()) {
                        var entry = entries_3_1.value;
                        if (type === 'default' || type === entry.type) {
                            if (i === 0) {
                                telephony.push({ item: [
                                        {
                                            _attr: { context: 'active' }
                                        },
                                        {
                                            first_name: vcf.firstName
                                        },
                                        {
                                            last_name: vcf.lastName
                                        },
                                        {
                                            organization: vcf.orgName
                                        },
                                        {
                                            number: entry.number
                                        }
                                    ]
                                });
                                referenceNumber = entry.number;
                                telephony.push({ item: [
                                        {
                                            _attr: { context: 'active' }
                                        },
                                        {
                                            first_name: 'Member_Alias'
                                        },
                                        {
                                            last_name: referenceNumber
                                        },
                                        {
                                            number: entry.number
                                        },
                                        {
                                            number_type: entry.type
                                        }
                                    ]
                                });
                            }
                            else {
                                telephony.push({ item: [
                                        {
                                            _attr: { context: 'active' }
                                        },
                                        {
                                            first_name: 'Member_Alias'
                                        },
                                        {
                                            last_name: referenceNumber
                                        },
                                        {
                                            number: entry.number
                                        },
                                        {
                                            number_type: entry.type
                                        }
                                    ]
                                });
                            }
                            i++;
                        }
                    }
                }
                catch (e_13_1) { e_13 = { error: e_13_1 }; }
                finally {
                    try {
                        if (entries_3_1 && !entries_3_1.done && (_e = entries_3.return)) _e.call(entries_3);
                    }
                    finally { if (e_13) throw e_13.error; }
                }
            }
        }
        catch (e_12_1) { e_12 = { error: e_12_1 }; }
        finally {
            try {
                if (typeOrder_3_1 && !typeOrder_3_1.done && (_d = typeOrder_3.return)) _d.call(typeOrder_3);
            }
            finally { if (e_12) throw e_12.error; }
        }
    }
    return telephony;
}
/**
 * SnomTbook : update
 * @param data
 * @param telephoneBook
 * @param settingsSnomTbook
 */
function snomTbookUpdate(data, telephoneBook, settingsSnomTbook) {
    console.log('SnomTbook : trying to update');
    var updates = [];
    // build path
    var path = settingsSnomTbook.webroot.trim();
    if (path.slice(-1) !== '/')
        path += '/';
    path += settingsSnomTbook.dir.trim().replace(/^\//, '');
    if (path.slice(-1) !== '/')
        path += '/';
    path += telephoneBook.filename.trim();
    return es6_promise_1.Promise.resolve(true)
        .then(function (res) { return fs.outputFile(path, data, { encoding: 'utf8' }); })
        .then(function (res) {
        console.log('SnomTbook : update successful');
        return es6_promise_1.Promise.resolve(true);
    });
}
