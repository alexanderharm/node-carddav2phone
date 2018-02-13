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
var es6_promise_1 = require("es6-promise");
var Vcf = require('vcf');
var xml = require("xml");
/**
 * handler for Snom
 * @param vcards
 */
function snomHandler(vcards) {
    console.log('Snom: start');
    var snomHandlers = [
        snomXcapHandler(vcards)
    ];
    return es6_promise_1.Promise.all(snomHandlers);
}
exports.snomHandler = snomHandler;
/**
 * Snom XCAP: handler function
 * @param vcards
 */
function snomXcapHandler(vcards) {
    console.log('Snom XCAP: start');
    // convert vCards to XCAP XML
    var data = xml(snomXcapProcessCards(vcards), { declaration: true });
    return snomXcapUpdate(data)
        .catch(function (err) {
        console.log('Snom XCAP: oops something went wrong');
        console.log(err);
        return es6_promise_1.Promise.resolve(false);
    });
}
/**
 * Snom XCAP: process vcards
 * @param vcards
 */
function snomXcapProcessCards(vcards) {
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
            var entry = snomXcapProcessCard(vcf.get('uid').valueOf(), names[0].trim(), names[1].trim(), tel);
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
    return {
        'resource-lists': [
            {
                _attr: {
                    'xmlns': 'urn:ietf:params:xml:ns:resource-lists',
                    'xmlns:cp': 'counterpath:properties'
                }
            },
            {
                list: __spread([
                    {
                        _attr: {
                            name: 'Contact List'
                        }
                    }
                ], entries)
            }
        ]
    };
    var e_1, _a;
}
/**
 * Snom XCAP: process single vcard
 * @param uid
 * @param last
 * @param first
 * @param tel
 */
function snomXcapProcessCard(uid, last, first, tels) {
    // object to hold different kinds of phone numbers, limit to home, work, mobile, default to home
    var entries = [];
    // test if tel is an array
    if (!Array.isArray(tels))
        tels = [tels];
    try {
        // iterate through all numbers
        for (var tels_1 = __values(tels), tels_1_1 = tels_1.next(); !tels_1_1.done; tels_1_1 = tels_1.next()) {
            var tel = tels_1_1.value;
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
    // process all types and numbers
    var typeOrder = utils_1.settings.fritzbox.order.length < 3 ? ['default'] : utils_1.settings.fritzbox.order;
    var name = utils_1.settings.fritzbox.name.indexOf(first) > 0 ? last + ' ' + first : first + ' ' + last;
    var i = 0;
    var telephony = [];
    var count = {
        business: 0,
        home: 0,
        mobile: 0
    };
    try {
        // go by type order
        for (var typeOrder_1 = __values(typeOrder), typeOrder_1_1 = typeOrder_1.next(); !typeOrder_1_1.done; typeOrder_1_1 = typeOrder_1.next()) {
            var type = typeOrder_1_1.value;
            try {
                for (var entries_1 = __values(entries), entries_1_1 = entries_1.next(); !entries_1_1.done; entries_1_1 = entries_1.next()) {
                    var entry = entries_1_1.value;
                    if (type === 'default' || type === entry.type) {
                        var n = entry.type + '_number';
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
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (entries_1_1 && !entries_1_1.done && (_b = entries_1.return)) _b.call(entries_1);
                }
                finally { if (e_3) throw e_3.error; }
            }
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (typeOrder_1_1 && !typeOrder_1_1.done && (_c = typeOrder_1.return)) _c.call(typeOrder_1);
        }
        finally { if (e_4) throw e_4.error; }
    }
    return {
        entry: __spread([
            {
                'display-name': name
            },
            {
                'cp:prop': [
                    {
                        _attr: {
                            name: 'entry_id',
                            value: uid
                        }
                    }
                ]
            },
            {
                'cp:prop': [
                    {
                        _attr: {
                            name: 'surname',
                            value: last
                        }
                    }
                ]
            },
            {
                'cp:prop': [
                    {
                        _attr: {
                            name: 'given_name',
                            value: first
                        }
                    }
                ]
            }
        ], telephony)
    };
    var e_2, _a, e_4, _c, e_3, _b;
}
/**
 * Snom XCAP: update
 * @param vcards
 */
function snomXcapUpdate(data) {
    console.log('Snom XCAP: trying to update');
    var updates = [];
    try {
        for (var _a = __values(utils_1.settings.snom.xcap.sipAccounts), _b = _a.next(); !_b.done; _b = _a.next()) {
            var account = _b.value;
            // build path
            var path = utils_1.settings.snom.xcap.webroot.trim();
            if (path.slice(-1) !== '/')
                path += '/';
            path += utils_1.settings.snom.xcap.dir.trim().replace(/^\//, '');
            if (path.slice(-1) !== '/')
                path += '/';
            path += 'users/sip:' + account.trim() + '/';
            path += utils_1.settings.snom.xcap.filename.trim();
            updates.push(fs.outputFile(path, data, { encoding: 'utf8' }));
        }
    }
    catch (e_5_1) { e_5 = { error: e_5_1 }; }
    finally {
        try {
            if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
        }
        finally { if (e_5) throw e_5.error; }
    }
    return es6_promise_1.Promise.all(updates)
        .then(function (res) {
        console.log('Snom XCAP: update successful');
        return es6_promise_1.Promise.resolve(true);
    });
    var e_5, _c;
}
