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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pascomCsvHandler = exports.pascomHandler = void 0;
var utils_1 = require("./utils");
var dist_1 = __importDefault(require("jsonexport/dist"));
var fs = require("fs-extra");
var es6_promise_1 = require("es6-promise");
/**
 * handler for pascom
 * @param addressBooks
 * @param settingsPascom
 */
function pascomHandler(addressBooks, settingsPascom) {
    console.log('Pascom: start');
    var pascomHandlers = [];
    if (settingsPascom.csv)
        pascomHandlers.push(pascomCsvHandler(addressBooks, settingsPascom.csv));
    return es6_promise_1.Promise.all(pascomHandlers);
}
exports.pascomHandler = pascomHandler;
/**
 * handler for snom XML
 * @param addressBooks
 * @param settingsPascomCsv
 */
function pascomCsvHandler(addressBooks, settingsPascomCsv) {
    console.log('PascomCsv: start');
    var pascomCsvPromises = es6_promise_1.Promise.resolve(true);
    var _loop_1 = function (i) {
        var telephoneBook = settingsPascomCsv.telephoneBooks[i];
        // convert vCards to  XML
        var data = pascomCsvProcessCards(telephoneBook, addressBooks);
        pascomCsvPromises = pascomCsvPromises.then(function () { return pascomCsvUpdate(data, telephoneBook, settingsPascomCsv); });
    };
    // loop over all telephone books
    for (var i = 0; i < settingsPascomCsv.telephoneBooks.length; i++) {
        _loop_1(i);
    }
    return pascomCsvPromises
        .catch(function (err) {
        console.log('PascomCsv: oops something went wrong');
        console.log(err);
        return es6_promise_1.Promise.resolve(false);
    });
}
exports.pascomCsvHandler = pascomCsvHandler;
/**
 * PascomCsv : process address books
 * @param telephoneBook
 * @param addressBooks
 */
function pascomCsvProcessCards(telephoneBook, addressBooks) {
    var e_1, _a, e_2, _b;
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
                    // skip if no name no org or telephone number
                    if (vcf.lastName.length === 0 && vcf.firstName.length === 0 && vcf.orgName.length === 0)
                        continue;
                    if (vcf.tels.length === 0)
                        continue;
                    // check for dial prefix
                    var prefix = "prefix" in account ? account.prefix : '';
                    // process card
                    var entry = pascomCsvProcessCard(vcf, telephoneBook.fullname, prefix, telephoneBook.duplicates, uniqueEntries);
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
    return __spreadArray([], __read(entries), false);
}
/**
 * PascomCsv : process single vcard
 * @param vcf
 * @param fullname
 * @param prefix
 * @param duplicates
 * @param uniqueEntries
 */
function pascomCsvProcessCard(vcf, fullname, prefix, duplicates, uniqueEntries) {
    var e_3, _a, e_4, _b, e_5, _c, e_6, _d, e_7, _e, e_8, _f;
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
        for (var _g = __values(vcf.tels), _h = _g.next(); !_h.done; _h = _g.next()) {
            var tel = _h.value;
            if (tel.number) {
                entries.push({ type: tel.type, number: (prefix === '' ? tel.number : prefix + tel.number).replace('+', '00') });
            }
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (_h && !_h.done && (_a = _g.return)) _a.call(_g);
        }
        finally { if (e_3) throw e_3.error; }
    }
    // if empty return nothing
    if (entries.length === 0)
        return;
    // sort by type order
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
    // reduce to single number per type
    var numberHome = telephony.home.length > 0 ? telephony.home[0] : "";
    var numberMobile = telephony.mobile.length > 0 ? telephony.mobile[0] : "";
    var numberWork = telephony.work.length > 0 ? telephony.work[0] : "";
    // reset entries for fax numbers
    entries = [];
    try {
        // iterate through all numbers
        for (var _j = __values(vcf.faxs), _k = _j.next(); !_k.done; _k = _j.next()) {
            var fax = _k.value;
            if (fax.number) {
                entries.push({ type: fax.type, number: (prefix === '' ? fax.number : prefix + fax.number).replace('+', '00') });
            }
        }
    }
    catch (e_5_1) { e_5 = { error: e_5_1 }; }
    finally {
        try {
            if (_k && !_k.done && (_c = _j.return)) _c.call(_j);
        }
        finally { if (e_5) throw e_5.error; }
    }
    // sort by type order
    var faxes = {
        home: [],
        work: []
    };
    try {
        for (var entries_2 = __values(entries), entries_2_1 = entries_2.next(); !entries_2_1.done; entries_2_1 = entries_2.next()) {
            var entry = entries_2_1.value;
            faxes[entry.type].push(entry.number);
        }
    }
    catch (e_6_1) { e_6 = { error: e_6_1 }; }
    finally {
        try {
            if (entries_2_1 && !entries_2_1.done && (_d = entries_2.return)) _d.call(entries_2);
        }
        finally { if (e_6) throw e_6.error; }
    }
    // reduce to single number per type
    var faxHome = faxes.home.length > 0 ? faxes.home[0] : "";
    var faxWork = faxes.work.length > 0 ? faxes.work[0] : "";
    // reset entries for emails
    entries = [];
    try {
        // iterate through all numbers
        for (var _l = __values(vcf.emails), _m = _l.next(); !_m.done; _m = _l.next()) {
            var email = _m.value;
            entries.push({ type: email.type, email: email.address });
        }
    }
    catch (e_7_1) { e_7 = { error: e_7_1 }; }
    finally {
        try {
            if (_m && !_m.done && (_e = _l.return)) _e.call(_l);
        }
        finally { if (e_7) throw e_7.error; }
    }
    // sort by type order
    var emails = {
        home: [],
        work: []
    };
    try {
        for (var entries_3 = __values(entries), entries_3_1 = entries_3.next(); !entries_3_1.done; entries_3_1 = entries_3.next()) {
            var entry = entries_3_1.value;
            emails[entry.type].push(entry.email);
        }
    }
    catch (e_8_1) { e_8 = { error: e_8_1 }; }
    finally {
        try {
            if (entries_3_1 && !entries_3_1.done && (_f = entries_3.return)) _f.call(entries_3);
        }
        finally { if (e_8) throw e_8.error; }
    }
    // reduce to single number per type
    var emailHome = emails.home.length > 0 ? emails.home[0] : "";
    var emailWork = emails.work.length > 0 ? emails.work[0] : "";
    return {
        displayName: entryName,
        firstName: vcf.firstName,
        lastName: vcf.lastName,
        orgName: vcf.orgName,
        work: numberWork,
        mobile: numberMobile,
        home: numberHome,
        fax: faxWork ? faxWork : faxHome,
        email: emailWork ? emailWork : emailHome,
        notes: vcf.note.replace(/"/g, '"""')
    };
}
/**
 * PascomCsv : update
 * @param data
 * @param telephoneBook
 * @param settingsPascomCsv
 */
function pascomCsvUpdate(data, telephoneBook, settingsPascomCsv) {
    console.log('PascomCsv : trying to update');
    var updates = [];
    // build path
    var path = settingsPascomCsv.outputdir.trim();
    if (path.slice(-1) !== '/')
        path += '/';
    path += telephoneBook.filename.trim();
    // convert to pascom csv format
    var options = {
        headers: ["displayName", "work", "firstName", "lastName", "orgName", "email", "mobile", "home", "fax", "notes"],
        rename: ["displayname", "phone", "givenname", "surname", "organisation", "email", "mobile", "homephone", "fax", "notes"],
        forceTextDelimiter: true
    };
    return es6_promise_1.Promise.resolve(true)
        .then(function (res) { return (0, dist_1.default)(data, options); })
        .then(function (res) { return fs.outputFile(path, res, { encoding: 'utf8' }); })
        .then(function (res) {
        console.log('PascomCsv : update successful');
        return es6_promise_1.Promise.resolve(true);
    });
}
