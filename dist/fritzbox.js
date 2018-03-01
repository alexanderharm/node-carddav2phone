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
var iconv = require("iconv-lite");
var md5 = require("md5");
var es6_promise_1 = require("es6-promise");
var rp = require('request-promise-native');
var Vcf = require('vcf');
var xml = require("xml");
/**
 * handler for Fritz!Box
 * @param vcards
 */
function fritzBoxHandler(vcards) {
    console.log('Fritz!Box: start');
    // convert vCards to Fritz!Box XML
    var data = xml(fritzBoxProcessCards(vcards), { declaration: true });
    return fritzBoxUpdate(data)
        .catch(function (err) {
        console.log('Fritz!Box: oops something went wrong');
        console.log(err);
        return es6_promise_1.Promise.resolve(false);
    });
}
exports.fritzBoxHandler = fritzBoxHandler;
/**
 * Fritz!Box: process vCards
 * @param vcards
 */
function fritzBoxProcessCards(vcards) {
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
            var entry = fritzBoxProcessCard(names[0].trim(), names[1].trim(), tel);
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
        phonebooks: [{
                phonebook: __spread([
                    {
                        _attr: {
                            name: utils_1.settings.fritzbox.telephoneBookName
                        }
                    }
                ], entries)
            }]
    };
    var e_1, _a;
}
/**
 * process single vcard
 * @param last
 * @param first
 * @param tels
 */
function fritzBoxProcessCard(last, first, tels) {
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
    // process all types and numbers
    var typeOrder = utils_1.settings.fritzbox.order.length < 3 ? ['default'] : utils_1.settings.fritzbox.order;
    var name = utils_1.settings.fritzbox.name.indexOf(first) > 0 ? last + ' ' + first : first + ' ' + last;
    var i = 0;
    var telephony = [];
    try {
        // go by type order
        for (var typeOrder_1 = __values(typeOrder), typeOrder_1_1 = typeOrder_1.next(); !typeOrder_1_1.done; typeOrder_1_1 = typeOrder_1.next()) {
            var type = typeOrder_1_1.value;
            try {
                for (var entries_1 = __values(entries), entries_1_1 = entries_1.next(); !entries_1_1.done; entries_1_1 = entries_1.next()) {
                    var entry = entries_1_1.value;
                    if (type === 'default' || type === entry.type) {
                        telephony.push({
                            number: [
                                {
                                    _attr: {
                                        id: i,
                                        prio: i == 0 ? '1' : '0',
                                        type: entry.type
                                    }
                                },
                                entry.number
                            ]
                        });
                        i++;
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
        contact: [
            {
                person: [{
                        realName: name
                    }]
            },
            {
                telephony: telephony
            }
        ]
    };
    var e_2, _a, e_4, _c, e_3, _b;
}
/**
 * get SID from Fritz!Box
 */
function fritzBoxSid() {
    console.log('Fritz!Box: authenticate');
    return es6_promise_1.Promise.resolve()
        .then(function (res) {
        var opt = {
            uri: 'http://' + utils_1.settings.fritzbox.url + '/login_sid.lua'
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
        var response = challenge + '-' + md5(iconv.encode(challenge + '-' + utils_1.settings.fritzbox.password, 'ucs2'));
        var opt = {
            uri: 'http://' + utils_1.settings.fritzbox.url + '/login_sid.lua',
            qs: {
                username: utils_1.settings.fritzbox.username,
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
 */
function fritzBoxUpdate(data) {
    // get SID from Fritz!Box
    console.log('Fritz!Box: attempting login');
    return fritzBoxSid()
        .then(function (sid) {
        // update phonebook
        console.log('Fritz!Box: trying to update');
        var opt = {
            method: 'POST',
            uri: 'http://' + utils_1.settings.fritzbox.url + '/cgi-bin/firmwarecfg',
            formData: {
                sid: sid,
                PhonebookId: utils_1.settings.fritzbox.telephoneBookId,
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
        if (res.indexOf(utils_1.settings.fritzbox.message) > -1) {
            console.log('Fritz!Box: update successful');
            return es6_promise_1.Promise.resolve(true);
        }
        console.log('Fritz!Box: update failed');
        return es6_promise_1.Promise.reject(res);
    });
}
