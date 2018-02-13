"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
const fs = require("fs-extra");
const es6_promise_1 = require("es6-promise");
const Vcf = require('vcf');
const xml = require("xml");
/**
 * handler for Snom
 * @param vcards
 */
function snomHandler(vcards) {
    console.log('Snom: start');
    let snomHandlers = [
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
    let data = xml(snomXcapProcessCards(vcards), { declaration: true });
    return snomXcapUpdate(data)
        .catch((err) => {
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
        let entry = snomXcapProcessCard(vcf.get('uid').valueOf(), names[0].trim(), names[1].trim(), tel);
        if (entry)
            entries.push(entry);
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
                list: [
                    {
                        _attr: {
                            name: 'Contact List'
                        }
                    },
                    ...entries
                ]
            }
        ]
    };
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
    let count = {
        business: 0,
        home: 0,
        mobile: 0
    };
    // go by type order
    for (let type of typeOrder) {
        for (let entry of entries) {
            if (type === 'default' || type === entry.type) {
                let n = entry.type + '_number';
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
    return {
        entry: [
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
            },
            ...telephony
        ]
    };
}
/**
 * Snom XCAP: update
 * @param vcards
 */
function snomXcapUpdate(data) {
    console.log('Snom XCAP: trying to update');
    let updates = [];
    for (let account of utils_1.settings.snom.xcap.sipAccounts) {
        // build path
        let path = utils_1.settings.snom.xcap.webroot.trim();
        if (path.slice(-1) !== '/')
            path += '/';
        path += utils_1.settings.snom.xcap.dir.trim().replace(/^\//, '');
        if (path.slice(-1) !== '/')
            path += '/';
        path += 'users/sip:' + account.trim() + '/';
        path += utils_1.settings.snom.xcap.filename.trim();
        updates.push(fs.outputFile(path, data, { encoding: 'utf8' }));
    }
    return es6_promise_1.Promise.all(updates)
        .then((res) => {
        console.log('Snom XCAP: update successful');
        return es6_promise_1.Promise.resolve(true);
    });
}
