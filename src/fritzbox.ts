import {settings, utilOrgName, utilNameFormat, utilNumberConvert, utilNumberGetType, utilNumberSanitize, utilNumberValid, utilParseXml} from './utils'
import iconv = require('iconv-lite')
import md5 = require('md5')
import {Promise} from 'es6-promise'
var rp = require('request-promise-native')
const Vcf = require('vcf')
import xml = require('xml')

/**
 * handler for Fritz!Box
 * @param accountsVcards 
 */
export function fritzBoxHandler (accountsVcards: any): Promise<boolean>
{
    console.log('Fritz!Box: start')

    let fritzBoxPromises = Promise.resolve(true)

    // loop over all telephone books
    for (let i = 0; i < settings.fritzbox.telephoneBooks.length; i++)
    {
        // convert vCards to Fritz!Box XML
        let data = <string>xml(fritzBoxProcessCards(settings.fritzbox.telephoneBooks[i], accountsVcards), { declaration: true })
        fritzBoxPromises = fritzBoxPromises.then(() => fritzBoxUpdate(data))
    }

    return fritzBoxPromises
        .catch((err) => {
            console.log('Fritz!Box: oops something went wrong')
            console.log(err)
            return Promise.resolve(false)
        })
}

/**
 * Fritz!Box: process vCards
 * @param telephoneBook
 * @param accountsVcards 
 */
function fritzBoxProcessCards (telephoneBook: any, accountsVcards: any): any
{
    // all entries
    let entries: any[] = []

    // determine which vCards from which accounts are needed
    let accounts: any[] = []
    if ("accounts" in telephoneBook)
    {
        accounts = telephoneBook.accounts 
    }
    else
    {
        // default to all accounts
        for (let account of Object.keys(accountsVcards))
        {
            accounts.push({"account": account})
        }
        
    }

    // iterate over all accounts
    for (let account of accounts)
    {
        // iterate all vCards of the collection
        for (let vcard of accountsVcards[account.account])
        {
            // parse vCard
            let vcf = new Vcf().parse(vcard)

            // skip if no telephone number
            let tel = vcf.get('tel')
            if (typeof tel === 'undefined') continue

            // process card (pass 'Full Name' and telephone numbers)
            let names = vcf.get('n').valueOf().split(';')
            let prefix = ("prefix" in account) ? account.prefix : ""
            let entry = fritzBoxProcessCard(names[0].trim(), names[1].trim(), utilOrgName(vcf), tel, vcf.get('note'), prefix)
            if (entry) entries.push(entry)
        }
    }

    return {
        phonebooks: [{
            phonebook: [
                {
                    _attr: {
                        name: settings.fritzbox.telephoneBookName
                    }
                },
                ...entries
            ]
        }]
    }
}
  
/**
 * process single vcard
 * @param last
 * @param first
 * @param tels
 * @param prefix
 */
function fritzBoxProcessCard(last: string, first: string, org: string, tels: string|any[], note: string, prefix: string): any
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
        if (type) entries.push({type: type, number: prefix + utilNumberSanitize(phoneNumber)})
    }
  
    // if empty return nothing
    if (entries.length === 0) return
  
    // process all types and numbers
    let typeOrder = settings.fritzbox.order.length < 3 ? [ 'default' ] : settings.fritzbox.order
    let i = 0
    let telephony = []

    // add VIP, QuickDial, Vanity information
    note = note ? note.valueOf() : ''
    let category = 0
    if (/fb_vip/i.test(note)) category = 1
    let quickDial = ''
    let quickDialNumber = ''
    let quickDialRe = /fb_quickdial\s*([0-9]{2})\s*\(([+0-9][0-9\ ]+)\)/i.exec(note)
    if (quickDialRe)
    {
        quickDial = quickDialRe[1]
        quickDialNumber = utilNumberSanitize(utilNumberConvert(quickDialRe[2]))
    }
    let vanity = ''
    let vanityNumber = ''
    let vanityRe = /fb_vanity\s*([a-z]{2,8})\s*\(([+0-9][0-9\ ]+)\)/i.exec(note)
    if (vanityRe)
    {
        vanity = vanityRe[1]
        vanityNumber = utilNumberSanitize(utilNumberConvert(vanityRe[2]))
    }

    // go by type order
    for (let type of typeOrder)
    {
        for (let entry of entries) 
        {
            if (type === 'default' || type === entry.type)
            {
                let attr: any = {
                    id: i,
                    prio: i == 0 ? '1' : '0',
                    type: entry.type
                }

                if (entry.number === quickDialNumber) attr.quickdial = quickDial
                if (entry.number === vanityNumber) attr.vanity = vanity

                telephony.push({
                    number: [
                        {
                            _attr: attr
                        },
                        entry.number
                    ]
                })
                i++
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
                    realName: utilNameFormat(last, first, org)
                }]
            },
            {
                telephony: telephony
            }
        ]
    }
}

/**
 * get SID from Fritz!Box
 */
function fritzBoxSid (): Promise<string>
{
    console.log('Fritz!Box: authenticate')
    return Promise.resolve()
        .then((res) => {
            let opt = {
                uri: 'http://' + settings.fritzbox.url + '/login_sid.lua'
            }
            return rp(opt)
        })
        .then((res: string) => {
            return utilParseXml(res)
        })
        .then((res) => {
            let sid = res.SessionInfo.SID[0]
            // return res if applicable
            if (sid !== '0000000000000000') return res
            
            // build challenge response
            let challenge = res.SessionInfo.Challenge[0]
            let response = challenge + '-' + md5(iconv.encode(challenge + '-' + settings.fritzbox.password, 'ucs2'))
            let opt = {
                uri: 'http://' + settings.fritzbox.url + '/login_sid.lua',
                qs: {
                    username: settings.fritzbox.username,
                    response: response
                }
            }
            return rp(opt)
        })
        .then((res: string) => {
            return utilParseXml(res)
        })
        .then((res) => {
            let sid = res.SessionInfo.SID[0]
            if (sid !== '0000000000000000')
            {
                console.log('Fritz!Box: login successful')
                return sid
            }
            return Promise.reject('Fritz!Box: login failed')
        })
}

/**
 * Fritz!Box: update
 * @param data 
 */
function fritzBoxUpdate (data: string): Promise<boolean> {

    // get SID from Fritz!Box
    console.log('Fritz!Box: attempting login')
    return fritzBoxSid()
    .then((sid) => {
        // update phonebook
        console.log('Fritz!Box: trying to update')
        let opt = {
            method: 'POST',
            uri: 'http://' + settings.fritzbox.url + '/cgi-bin/firmwarecfg',
            formData: {
                sid: sid,
                PhonebookId: settings.fritzbox.telephoneBookId,
                PhonebookImportFile: {
                    value: data,
                    options: {
                        filename: 'updatepb.xml',
                        contentType: 'text/xml'
                    }
                }
            }
        }
        return rp(opt)
    })
    .then((res: string) => {
        // check for success
        if (res.indexOf(settings.fritzbox.message) > -1)
        {
            console.log('Fritz!Box: update successful')
            return Promise.resolve(true)
        }
        console.log('Fritz!Box: update failed')
        return Promise.reject(res)
    })
  }