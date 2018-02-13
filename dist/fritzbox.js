"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
const iconv = require("iconv-lite");
const md5 = require("md5");
const es6_promise_1 = require("es6-promise");
var rp = require('request-promise-native');
const Vcf = require('vcf');
const xml = require("xml");
/**
 * handler for Fritz!Box
 * @param vcards
 */
function fritzBoxHandler(vcards) {
    console.log('Fritz!Box: start');
    // convert vCards to Fritz!Box XML
    let data = xml(fritzBoxProcessCards(vcards), { declaration: true });
    return fritzBoxUpdate(data)
        .catch((err) => {
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
    let entries = [];
    // iterate all vCards of the collection
    for (let vcard of vcards) {
        // parse vCard
        let vcf = new Vcf().parse(vcard.data.props.addressData);
        // skip if no telephone number
        let tel = vcf.get('tel');
        if (typeof tel === 'undefined')
            continue;
        // process card (pass 'Full Name' and telephone numbers)
        let names = vcf.get('n').valueOf().split(';');
        let entry = fritzBoxProcessCard(names[0].trim(), names[1].trim(), tel);
        if (entry)
            entries.push(entry);
    }
    return {
        phonebooks: [{
                phonebook: [
                    {
                        _attr: {
                            name: utils_1.settings.fritzbox.telephoneBookName
                        }
                    },
                    ...entries
                ]
            }]
    };
}
/**
 * process single vcard
 * @param last
 * @param first
 * @param tels
 */
function fritzBoxProcessCard(last, first, tels) {
    // object to hold different kinds of phone numbers, limit to home, work, mobile, default to home
    let entries = [];
    // test if tel is an array
    if (!Array.isArray(tels))
        tels = [tels];
    // iterate through all numbers
    for (let tel of tels) {
        // convert to PhoneNumber
        let phoneNumber = utils_1.utilNumberConvert(tel.valueOf());
        // determine type
        let type = utils_1.utilNumberGetType(tel.type, phoneNumber);
        // store number if of type voice
        if (type)
            entries.push({ type: type, number: utils_1.utilNumberSanitize(phoneNumber) });
    }
    // if empty return nothing
    if (entries.length === 0)
        return;
    // process all types and numbers
    let typeOrder = utils_1.settings.fritzbox.order.length < 3 ? ['default'] : utils_1.settings.fritzbox.order;
    let name = utils_1.settings.fritzbox.name.indexOf(first) > 0 ? last + ' ' + first : first + ' ' + last;
    let i = 0;
    let telephony = [];
    // go by type order
    for (let type of typeOrder) {
        for (let entry of entries) {
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
}
/**
 * get SID from Fritz!Box
 */
function fritzBoxSid() {
    console.log('Fritz!Box: authenticate');
    return es6_promise_1.Promise.resolve()
        .then((res) => {
        let opt = {
            uri: 'http://' + utils_1.settings.fritzbox.url + '/login_sid.lua'
        };
        return rp(opt);
    })
        .then((res) => {
        return utils_1.utilParseXml(res);
    })
        .then((res) => {
        let sid = res.SessionInfo.SID[0];
        // return res if applicable
        if (sid !== '0000000000000000')
            return res;
        // build challenge response
        let challenge = res.SessionInfo.Challenge[0];
        let response = challenge + '-' + md5(iconv.encode(challenge + '-' + utils_1.settings.fritzbox.password, 'ucs2'));
        let opt = {
            uri: 'http://' + utils_1.settings.fritzbox.url + '/login_sid.lua',
            qs: {
                username: utils_1.settings.fritzbox.username,
                response: response
            }
        };
        return rp(opt);
    })
        .then((res) => {
        return utils_1.utilParseXml(res);
    })
        .then((res) => {
        let sid = res.SessionInfo.SID[0];
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
        .then((sid) => {
        // update phonebook
        console.log('Fritz!Box: trying to update');
        let opt = {
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
        .then((res) => {
        // check for success
        if (res.indexOf(utils_1.settings.fritzbox.message) > -1) {
            console.log('Fritz!Box: update successful');
            return es6_promise_1.Promise.resolve(true);
        }
        console.log('Fritz!Box: update failed');
        return es6_promise_1.Promise.reject(res);
    });
}
