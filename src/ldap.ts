import {settings, utilOrgName, utilNameFormat, utilNumberConvert, utilNumberGetType, utilNumberSanitize, utilNumberValid, utilParseXml} from './utils'
const ldap = require('ldapjs')
import {Promise} from 'es6-promise'
const Vcf = require('vcf')

/**
 * handler for LDAP
 * @param vcards 
 */
export function ldapHandler (vcards: any[]): Promise<boolean>
{
    console.log('LDAP: start')

    // process cards
    let contacts = ldapProcessCards(vcards)

    // update LDAP
    return ldapUpdate(contacts)
        .catch((err) => {
            console.log('LDAP: oops something went wrong')
            console.log(err)
            return Promise.resolve(false)
        })
}

/**
 * LDAP: process vCards
 * @param vcards 
 */
function ldapProcessCards (vcards: any[]): any
{
    // all entries
    let entries: any[] = []

    // iterate all vCards of the collection
    for (let vcard of vcards)
    {
        // parse vCard
        let vcf = new Vcf().parse(vcard.data.props.addressData)

        // skip if no telephone number
        let tel = vcf.get('tel')
        if (typeof tel === 'undefined') continue

        // process card (pass 'Full Name' and telephone numbers)
        let names = vcf.get('n').valueOf().split(';')
        let entry = ldapProcessCard(vcf.get('uid').valueOf(), names[0].trim(), names[1].trim(), utilOrgName(vcf), tel)
        if (entry) entries.push(entry)
    }

    return entries
}
  
/**
 * process single vcard
 * @param uid
 * @param last 
 * @param first 
 * @param tels 
 */
function ldapProcessCard(uid: string, last: string, first: string, org: string, tels: string|any[]): any
{
  
    // object to hold different kinds of phone numbers, limit to home, work, mobile, default to home
    let entries = []
  
    // test if tel is an array
    if (!Array.isArray(tels)) tels = [ tels ]

    // iterate through all numbers
    for (let tel of tels)
    {
        // test if number
        if (!utilNumberValid(tel.valueOf())) continue
        // convert to PhoneNumber
        let phoneNumber = utilNumberConvert(tel.valueOf())
        // determine type
        let type = utilNumberGetType(tel.type, phoneNumber)
        // store number if of type voice
        if (type) entries.push({type: type, number: utilNumberSanitize(phoneNumber)})
    }
  
    // if empty return nothing
    if (entries.length === 0) return

    // go by type order
    let telephony: any = {
        home: [],
        mobile: [],
        work: []
    }
    for (let entry of entries) 
    {
        telephony[entry.type].push(entry.number)
    }

    return {
        uid: uid,
        commonName: utilNameFormat(last, first, org),
        displayName: utilNameFormat(last, first, org),
        surname: last,
        givenName: first,
        homePhone: telephony.home,
        mobile: telephony.mobile,
        telephoneNumber: telephony.work
    }
}

/**
 * LDAP: bind
 * @param client 
 */
function ldapBind (client: any): Promise<boolean> 
{
    console.log('LDAP: attempting bind')
    return new Promise((resolve, reject) => {
        client.bind(settings.ldap.user, settings.ldap.password, (err: any) => {
            if (err) reject(err)
            resolve(true)
        })
    })
}

function ldapSearch (client: any): Promise<string[]> 
{
    console.log('LDAP: attempting search')
    let opts = {
        filter: '(objectClass=inetOrgPerson)',
        scope: 'sub',
        attributes: 'dn'
    }
    let entries: string[] = []
    return new Promise((resolve, reject) => {
        client.search(settings.ldap.searchBase, opts, (err: any, res: any) => {
            if (err) reject(err)
            res.on('searchEntry', (entry: string) => {
                entries.push(entry)
            })
            res.on('error', (err: any) => {
                reject(err)
            })
            res.on('end', (res: any) => {
                console.log('LDAP: search complete')
                resolve(entries)
            })
        })
    })
}

function ldapDelete (client: any, entries: String[]): Promise<any> 
{
    console.log('LDAP: attempting delete')
    let delOps: Promise<any>[] = []
    for (let entry of entries) 
    {
        let p = new Promise((resolve, reject) => {
            client.del(entry, (err: any) => {
                if (err) reject(err)
                resolve(true)
            })
        })
        delOps.push(p)
    }
    return Promise.all(delOps).then((res) => {
        console.log('LDAP: delete complete')
        return res
    })
}

function ldapAdd (client: any, contacts: any[]): Promise<any> 
{
    console.log('LDAP: attempting add')
    let addOps: Promise<any>[] = []
    for (let contact of contacts) 
    {
        let p = new Promise((resolve, reject) => {
            client.add('uid=' + contact.uid + ',' + settings.ldap.searchBase, contact, (err: any) => {
                if (err) reject(err)
                resolve(true)
            })
        })
        addOps.push(p)
    }
    return Promise.all(addOps).then((res) => {
        console.log('LDAP: add complete')
        return res
    })
}

/**
 * LDAP: update
 * @param contacts 
 */
function ldapUpdate (contacts: any[]): Promise<boolean> {

    /**
     * since we don't know what exactly changed
     * all entries are deleted and recreated
     */

    // create client
    let client = ldap.createClient({
        url: settings.ldap.url
    })
    
    // bind
    return ldapBind(client)
    // search
    .then((res: any) => ldapSearch(client))
    .then((entries: string[]) => {
        return ldapDelete(client, entries)
    })
    .then((res: any) => {
        // add entries
        return ldapAdd(client, contacts)
    })
    .then((res: any) => {
        // check for success
        console.log('LDAP: update successful')
        return Promise.resolve(true)
    })
}