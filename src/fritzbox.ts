import {utilNameFormat, utilNumberConvert, utilNumberSanitize, utilParseVcard, utilParseXml} from './utils'
import iconv = require('iconv-lite')
import md5 = require('md5')
import {Promise} from 'es6-promise'
var rp = require('request-promise-native')
import xml = require('xml')

/**
 * handler for Fritz!Box
 * @param addressBooks
 * @param settingsFB
 */
export function fritzBoxHandler (addressBooks: any, settingsFB: any): Promise<boolean>
{
    console.log('Fritz!Box: start')

    let fritzBoxPromises = Promise.resolve(true)

    // loop over all telephone books
    for (let i = 0; i < settingsFB.telephoneBooks.length; i++)
    {
        let telephoneBook = settingsFB.telephoneBooks[i]
        // convert addressBooks to Fritz!Box XML
        let data = <string>xml(fritzBoxProcessCards(telephoneBook, addressBooks), { declaration: true })
        fritzBoxPromises = fritzBoxPromises.then(() => fritzBoxUpdate(data, telephoneBook.id, settingsFB))
    }

    return fritzBoxPromises
        .catch((err) => {
            console.log('Fritz!Box: oops something went wrong')
            console.log(err)
            return Promise.resolve(false)
        })
}

/**
 * Fritz!Box: process addressBooks
 * @param telephoneBook
 * @param addressBooks
 */
function fritzBoxProcessCards (telephoneBook: any, addressBooks: any): any
{
    // all entries
    let entries: any[] = []

    // prevent duplicate entries
    let uniqueEntries: string[] = []

    // determine which addressBooks from which accounts are needed
    let accounts: any[] = []
    if ("accounts" in telephoneBook)
    {
        accounts = telephoneBook.accounts 
    }
    else
    {
        // default to all addressBooks
        for (let i = 0; i < addressBooks.length; i++)
        {
            accounts.push({"account": i + 1})
        }
        
    }

    // iterate over all accounts
    for (let account of accounts)
    {
        // iterate all vCards of the address book
        for (let vcard of addressBooks[account.account - 1])
        {
            // parse vCard
            let vcf = utilParseVcard(vcard)

            // skip if no telephone number
            if (vcf.tels.length === 0) continue

            // check for dial prefix
            let prefix = "prefix" in account ? account.prefix : ''

            // process card (pass 'Full Name' and telephone numbers)
            let entry = fritzBoxProcessCard(vcf, telephoneBook.fullname, telephoneBook.order, prefix, telephoneBook.duplicates, uniqueEntries)
            if (entry) entries.push(entry)
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
    }
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
function fritzBoxProcessCard(vcf: any, fullname: string[], order: string[], prefix: string, duplicates: boolean, uniqueEntries: string[]): any
{
    // entry name
    let entryName = utilNameFormat(vcf.names[0], vcf.names[1], vcf.org, fullname)

    // check for duplicates
    if (!duplicates) {
        if (uniqueEntries.indexOf(entryName) > -1) return
        uniqueEntries.push(entryName)
    }

    // object to hold different kinds of phone numbers, limit to home, work, mobile, default to home
    let entries = []

    // iterate through all numbers
    for (let tel of vcf.tels)
    {
        entries.push({type: tel.type, number: prefix === '' ? tel.number : (prefix + tel.number).replace('+', '00')})
    }
  
    // if empty return nothing
    if (entries.length === 0) return

    // add VIP, QuickDial, Vanity information
    let category = 0
    if (/fb_vip/i.test(vcf.note)) category = 1
    let quickDial = ''
    let quickDialNumber = ''
    let quickDialRe = /fb_quickdial\s*([0-9]{2})\s*\(([+0-9][0-9\ ]+)\)/i.exec(vcf.note)
    if (quickDialRe)
    {
        quickDial = quickDialRe[1]
        quickDialNumber = utilNumberSanitize(utilNumberConvert(quickDialRe[2]))
    }
    let vanity = ''
    let vanityNumber = ''
    let vanityRe = /fb_vanity\s*([a-z]{2,8})\s*\(([+0-9][0-9\ ]+)\)/i.exec(vcf.note)
    if (vanityRe)
    {
        vanity = vanityRe[1]
        vanityNumber = utilNumberSanitize(utilNumberConvert(vanityRe[2]))
    }

    // process all types and numbers
    let typeOrder = order.length !== 3 ? [ 'default' ] : order
    let i = 0
    let telephony = []
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
                    realName: entryName
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
 * @param settings
 */
function fritzBoxSid (settingsFB: any): Promise<string>
{
    console.log('Fritz!Box: authenticate')
    return Promise.resolve()
        .then((res) => {
            let opt = {
                uri: 'http://' + settingsFB.url + '/login_sid.lua'
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
            let response = challenge + '-' + md5(iconv.encode(challenge + '-' + settingsFB.password, 'ucs2'))
            let opt = {
                uri: 'http://' + settingsFB.url + '/login_sid.lua',
                qs: {
                    username: settingsFB.username,
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
 * @param telephoneBookId
 * @param settings
 */
function fritzBoxUpdate (data: string, telephoneBookId: number, settingsFB: any): Promise<boolean> {

    // get SID from Fritz!Box
    console.log('Fritz!Box: attempting login')
    return fritzBoxSid(settingsFB)
    .then((sid) => {
        // update phonebook
        console.log('Fritz!Box: trying to update')
        let opt = {
            method: 'POST',
            uri: 'http://' + settingsFB.url + '/cgi-bin/firmwarecfg',
            formData: {
                sid: sid,
                PhonebookId: telephoneBookId,
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
        if (res.indexOf(settingsFB.message) > -1)
        {
            console.log('Fritz!Box: update successful')
            return Promise.resolve(true)
        }
        console.log('Fritz!Box: update failed')
        return Promise.reject(res)
    })
  }