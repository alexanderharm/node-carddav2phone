var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { utilNameFormat, utilNumberConvert, utilNumberSanitize, utilParseVcard, utilParseXml } from './utils.js';
import iconv from 'iconv-lite';
import md5 from 'md5';
//import { Promise } from 'es6-promise'
//var rp = require('request-promise-native')
import got from 'got';
import { FormData, File } from 'formdata-node';
import xml from 'xml';
/**
 * handler for Fritz!Box
 * @param addressBooks
 * @param settingsFB
 */
export function fritzBoxHandler(addressBooks, settingsFB) {
    console.log('Fritz!Box: start');
    let fritzBoxPromises = Promise.resolve(true);
    // loop over all telephone books
    for (let i = 0; i < settingsFB.telephoneBooks.length; i++) {
        let telephoneBook = settingsFB.telephoneBooks[i];
        // convert addressBooks to Fritz!Box XML
        let data = xml(fritzBoxProcessCards(telephoneBook, addressBooks), { declaration: true });
        fritzBoxPromises = fritzBoxPromises.then(() => fritzBoxUpdate(data, telephoneBook.id, settingsFB));
    }
    return fritzBoxPromises
        .catch((err) => {
        console.log('Fritz!Box: oops something went wrong');
        console.log(err);
        return Promise.resolve(false);
    });
}
/**
 * Fritz!Box: process addressBooks
 * @param telephoneBook
 * @param addressBooks
 */
function fritzBoxProcessCards(telephoneBook, addressBooks) {
    // all entries
    let entries = [];
    // prevent duplicate entries
    let uniqueEntries = [];
    // determine which addressBooks from which accounts are needed
    let accounts = [];
    if ("accounts" in telephoneBook) {
        accounts = telephoneBook.accounts;
    }
    else {
        // default to all addressBooks
        for (let i = 0; i < addressBooks.length; i++) {
            accounts.push({ "account": i + 1 });
        }
    }
    // iterate over all accounts
    for (let account of accounts) {
        // iterate all vCards of the address book
        for (let vcard of addressBooks[account.account - 1]) {
            // parse vCard
            let vcf = utilParseVcard(vcard);
            // skip if no name or telephone number
            if (vcf.lastName.length === 0 && vcf.firstName.length === 0 && vcf.orgName.length === 0)
                continue;
            if (vcf.tels.length === 0)
                continue;
            // check for dial prefix
            let prefix = "prefix" in account ? account.prefix : '';
            // process card (pass 'Full Name' and telephone numbers)
            let entry = fritzBoxProcessCard(vcf, telephoneBook.fullname, telephoneBook.order, prefix, telephoneBook.duplicates, uniqueEntries);
            if (entry)
                entries.push(entry);
        }
    }
    return {
        phonebooks: [{
                phonebook: [
                    {
                        _attr: {
                            name: telephoneBook.name
                        }
                    },
                    ...entries
                ]
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
    // entry name
    let entryName = utilNameFormat(vcf.lastName, vcf.firstName, vcf.orgName, fullname);
    // check for duplicates
    if (!duplicates) {
        if (uniqueEntries.indexOf(entryName) > -1)
            return;
        uniqueEntries.push(entryName);
    }
    // object to hold different kinds of phone numbers, limit to home, work, mobile, default to home
    let entries = [];
    // iterate through all numbers
    for (let tel of vcf.tels) {
        if (!tel.number)
            continue;
        entries.push({ type: tel.type, number: prefix === '' ? tel.number : (prefix + tel.number).replace('+', '00') });
    }
    // if empty return nothing
    if (entries.length === 0)
        return;
    // add VIP, QuickDial, Vanity information
    let category = 0;
    if (/fb_vip/i.test(vcf.note))
        category = 1;
    let quickDial = '';
    let quickDialNumber = '';
    let quickDialRe = /fb_quickdial\s*([0-9]{2})\s*\(([+0-9][0-9\ ]+)\)/i.exec(vcf.note);
    if (quickDialRe) {
        quickDial = quickDialRe[1];
        quickDialNumber = utilNumberSanitize(utilNumberConvert(quickDialRe[2]));
    }
    let vanity = '';
    let vanityNumber = '';
    let vanityRe = /fb_vanity\s*([a-z]{2,8})\s*\(([+0-9][0-9\ ]+)\)/i.exec(vcf.note);
    if (vanityRe) {
        vanity = vanityRe[1];
        vanityNumber = utilNumberSanitize(utilNumberConvert(vanityRe[2]));
    }
    // process all types and numbers
    let typeOrder = order.length !== 3 ? ['default'] : order;
    let i = 0;
    let telephony = [];
    for (let type of typeOrder) {
        for (let entry of entries) {
            if (type === 'default' || type === entry.type) {
                let attr = {
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
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Fritz!Box: authenticate');
        let { body } = yield got('http://' + settingsFB.url + '/login_sid.lua');
        let xml = yield utilParseXml(body);
        let sid = xml.SessionInfo.SID[0];
        // return sid if already logged in
        if (sid !== '0000000000000000') {
            console.log('Fritz!Box: login successful');
            return sid;
        }
        // build challenge response
        let challenge = xml.SessionInfo.Challenge[0];
        let response = challenge + '-' + md5(iconv.encode(challenge + '-' + settingsFB.password, 'ucs2'));
        let opt = {
            searchParams: {
                username: settingsFB.username,
                response: response
            }
        };
        ({ body } = yield got('http://' + settingsFB.url + '/login_sid.lua', opt));
        xml = yield utilParseXml(body);
        sid = xml.SessionInfo.SID[0];
        // return sid if successfully logged in
        if (sid !== '0000000000000000') {
            console.log('Fritz!Box: login successful');
            return sid;
        }
        // return failed
        return Promise.reject('Fritz!Box: login failed');
    });
}
/**
 * Fritz!Box: update
 * @param data
 * @param telephoneBookId
 * @param settings
 */
function fritzBoxUpdate(data, telephoneBookId, settingsFB) {
    return __awaiter(this, void 0, void 0, function* () {
        // get SID from Fritz!Box
        console.log('Fritz!Box: attempting login');
        let sid = yield fritzBoxSid(settingsFB);
        console.log('Fritz!Box: trying to update');
        let form = new FormData();
        form.set("sid", sid);
        form.set("PhonebookId", telephoneBookId);
        let file = new File([data], "updatepb.xml", { type: "text/xml" });
        form.set("PhonebookImportFile", file);
        try {
            let { body } = yield got.post('http://' + settingsFB.url + '/cgi-bin/firmwarecfg', { body: form });
            // check for success
            if (body.indexOf(settingsFB.message) > -1) {
                console.log('Fritz!Box: update successful');
                return true;
            }
            console.log('Fritz!Box: update failed');
            console.error(`Fritz!Box: ${body}`);
            return false;
        }
        catch (e) {
            console.error(`Fritz!Box: ${e.message}`);
            return false;
        }
    });
}
