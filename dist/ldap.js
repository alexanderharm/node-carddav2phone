import { utilNameFormat, utilParseVcard } from './utils.js';
import ldap from 'ldapjs';
//import {Promise} from 'es6-promise'
/**
 * handler for LDAP
 * @param addressBooks
 * @param settingsLdap
 */
export function ldapHandler(addressBooks, settingsLdap) {
    console.log('LDAP: start');
    let ldapPromises = Promise.resolve(true);
    // loop over all telephone books
    for (let i = 0; i < settingsLdap.telephoneBooks.length; i++) {
        let telephoneBook = settingsLdap.telephoneBooks[i];
        // process address books
        let contacts = ldapProcessCards(telephoneBook, addressBooks);
        ldapPromises = ldapPromises.then(() => ldapUpdate(contacts, telephoneBook));
    }
    return ldapPromises
        .catch((err) => {
        console.log('LDAP: oops something went wrong');
        console.log(err);
        return Promise.resolve(false);
    });
}
/**
 * LDAP: process address books
 * @param telephoneBook
 * @param addressBooks
 */
function ldapProcessCards(telephoneBook, addressBooks) {
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
            // process card
            let entry = ldapProcessCard(vcf, prefix, telephoneBook.fullname, telephoneBook.duplicates, uniqueEntries);
            if (entry)
                entries.push(entry);
        }
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
        entries.push({ type: tel.type, number: prefix === '' ? tel.number : (prefix + tel.number).replace('+', '00') });
    }
    // if empty return nothing
    if (entries.length === 0)
        return;
    // go by type order
    let telephony = {
        home: [],
        mobile: [],
        work: []
    };
    for (let entry of entries) {
        telephony[entry.type].push(entry.number);
    }
    let contact = {};
    contact.surname = vcf.lastName;
    contact.givenName = vcf.firstName;
    if (telephony.home.length > 0)
        contact.homePhone = telephony.home[0];
    if (telephony.mobile.length > 0)
        contact.mobile = telephony.mobile[0];
    if (telephony.work.length > 0)
        contact.telephoneNumber = telephony.work[0];
    return Object.assign({ objectClass: ['top', 'person', 'inetOrgPerson', 'organizationalPerson'], uid: vcf.uid, commonName: entryName, displayName: entryName }, contact);
}
/**
 * LDAP: bind
 * @param client
 * @param user
 * @param password
 */
function ldapBind(client, user, password) {
    console.log('LDAP: attempting bind');
    return new Promise((resolve, reject) => {
        client.bind(user, password, (err) => {
            if (err)
                reject(err);
            resolve(true);
        });
    });
}
function ldapSearch(client, searchBase) {
    console.log('LDAP: attempting search');
    let opts = {
        filter: '(objectClass=inetOrgPerson)',
        scope: 'sub',
        attributes: 'dn'
    };
    let entries = [];
    return new Promise((resolve, reject) => {
        client.search(searchBase, opts, (err, res) => {
            if (err)
                reject(err);
            res.on('searchEntry', (entry) => {
                entries.push(entry.objectName);
            });
            res.on('error', (err) => {
                reject(err);
            });
            res.on('end', (res) => {
                console.log('LDAP: search complete');
                resolve(entries);
            });
        });
    });
}
function ldapDelete(client, entries) {
    console.log('LDAP: attempting delete');
    let delOps = [];
    for (let entry of entries) {
        let p = new Promise((resolve, reject) => {
            client.del(entry, (err) => {
                if (err)
                    reject(err);
                resolve(true);
            });
        });
        delOps.push(p);
    }
    return Promise.all(delOps).then((res) => {
        console.log('LDAP: delete complete');
        return res;
    });
}
function ldapAdd(client, contacts, searchBase) {
    console.log('LDAP: attempting add');
    let addOps = [];
    for (let contact of contacts) {
        if (contact) {
            let p = new Promise((resolve, reject) => {
                client.add('uid=' + contact.uid + ',' + searchBase, contact, (err) => {
                    if (err)
                        reject(err);
                    resolve(true);
                });
            });
            addOps.push(p);
        }
    }
    return Promise.all(addOps).then((res) => {
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
    let client = ldap.createClient({ url: telephoneBook.url });
    // bind
    return ldapBind(client, telephoneBook.user, telephoneBook.password)
        // search
        .then((res) => ldapSearch(client, telephoneBook.searchBase))
        .then((entries) => ldapDelete(client, entries))
        .then((res) => ldapAdd(client, contacts, telephoneBook.searchBase))
        .then((res) => {
        // check for success
        console.log('LDAP: update successful');
        return Promise.resolve(true);
    });
}
