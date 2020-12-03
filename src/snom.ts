import {utilNameFormat, utilNameSanitize, utilParseVcard} from './utils'
import {sendMail} from './mailer'
import fs = require('fs-extra')
import {Promise} from 'es6-promise'
import xml = require('xml')

/**
 * handler for Snom
 * @param addressBooks
 * @param settingsSnom 
 */
export function snomHandler (addressBooks: any, settingsSnom: any): Promise<boolean[]>
{
    console.log('Snom: start')
    let snomHandlers: any[] = []
    if (settingsSnom.xcap) snomHandlers.push(snomXcapHandler(addressBooks, settingsSnom.xcap))
    if (settingsSnom.xml) snomHandlers.push(snomTbookHandler(addressBooks, settingsSnom.tbook))
    return Promise.all(snomHandlers)
}

/**
 * Snom XCAP: handler function
 * @param addressBooks
 * @param settingsSnomXcap 
 */
function snomXcapHandler (addressBooks: any, settingsSnomXcap: any): Promise<boolean>
{
    console.log('Snom XCAP: start')

    let snomXcapPromises = Promise.resolve(true)

    // loop over all telephone books
    for (let i = 0; i < settingsSnomXcap.telephoneBooks.length; i++)
    {
        let telephoneBook = settingsSnomXcap.telephoneBooks[i]
        // convert vCards to XCAP XML
        let data = <string>xml(snomXcapProcessCards(telephoneBook, addressBooks), { declaration: true })
        snomXcapPromises = snomXcapPromises.then(() => snomXcapUpdate(data, telephoneBook, settingsSnomXcap))
    }

    return snomXcapPromises
        .catch((err) => {
            console.log('Snom XCAP: oops something went wrong')
            console.log(err)
            return Promise.resolve(false)
        })
}
  
/**
 * Snom XCAP: process address books
 * @param telephoneBook
 * @param addressBooks 
 */
function snomXcapProcessCards (telephoneBook: any, addressBooks: any): any
{
    // all entries
    let entries: any[] = []

    // prevent duplicate entries
    let uniqueEntries: string[] = []

    // XCAP does not like duplicate numbers!
    let xcapUniqueNumbers: string[] = []

    // determine which vCards from which accounts are needed
    let accounts: any[] = []
    if ("accounts" in telephoneBook)
    {
        accounts = telephoneBook.accounts 
    }
    else
    {
        // default to all address books
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

            // process card
            let entry = snomXcapProcessCard(vcf, telephoneBook.fullname, telephoneBook.order, prefix, telephoneBook.duplicates, uniqueEntries, xcapUniqueNumbers)
            if (entry) entries.push(entry)
        }
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
    }
}
  
/**
 * Snom XCAP: process single vcard
 * @param vcf
 * @param fullname
 * @param order
 * @param prefix
 * @param duplicates
 * @param uniqueEntries
 * @param xcapUniqueNumbers
 */
function snomXcapProcessCard(vcf: any, fullname: string[], order: string[], prefix: string, duplicates: boolean, uniqueEntries: string[], xcapUniqueNumbers: string[]): any
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
        // check for duplicate phone number
        if (xcapUniqueNumbers.indexOf(tel.number) > -1) {
            let errorMsg: string = 'Duplicate number (' + tel.number + ') on ' + entryName
            console.log('WARNING: ' + errorMsg)
            sendMail('Sync: Duplicate phone number detected', errorMsg)
            continue
        }
        xcapUniqueNumbers.push(tel.number)
        // store entry
        entries.push({type: tel.type, number: prefix === '' ? tel.number : (prefix + tel.number).replace('+', '00')})
    }
  
    // if empty return nothing
    if (entries.length === 0) return
  
    // process all types and numbers
    let typeOrder = order.length !== 3 ? [ 'default' ] : order
    let telephony = []
    let count: any = {
        work: 0,
        home: 0,
        mobile: 0
    }

    // go by type order
    for (let type of typeOrder)
    {
        for (let entry of entries) 
        {
            if (type === 'default' || type === entry.type)
            {
                let n = entry.type.replace('work', 'business') + '_number'
                if (count[entry.type] > 0) n += '#' + count[entry.type]
                telephony.push({
                    'cp:prop': [
                        {
                            _attr: {
                                name: n,
                                value: entry.number
                            }
                        }
                    ]
                })
                count[entry.type]++
            }
        }
    }
    
    return {
        entry: [
            {
                'display-name': entryName
            },
            {
                'cp:prop': [
                    {
                        _attr: {
                            name: 'entry_id',
                            value: vcf.uid
                        }
                    }
                ]
            },
            {
                'cp:prop': [
                    {
                        _attr: {
                            name: 'surname',
                            value: vcf.names[0]
                        }
                    }
                ]
            },
            {
                'cp:prop': [
                    {
                        _attr: {
                            name: 'given_name',
                            value: vcf.names[1]
                        }
                    }
                ]
            },
            {
                'cp:prop': [
                    {
                        _attr: {
                            name: 'company',
                            value: vcf.org
                        }
                    }
                ]
            },
            ...telephony
        ]
    }
}

/**
 * Snom XCAP: update
 * @param data
 * @param telephoneBook
 * @param settingsSnomXcap
 */
function snomXcapUpdate (data: string, telephoneBook: any, settingsSnomXcap: any): Promise<boolean>
{
    console.log('Snom XCAP: trying to update')

    let updates = []
    for (let username of telephoneBook.usernames)
    {
        // build path
        let path = settingsSnomXcap.webroot.trim()
        if (path.slice(-1) !== '/') path += '/'
        path += settingsSnomXcap.dir.trim().replace(/^\//, '')
        if (path.slice(-1) !== '/') path += '/'
        path += 'users/sip:' + username.trim() + '/'
        path += telephoneBook.filename.trim()
        updates.push(fs.outputFile(path, data, {encoding: 'utf8'}))
    }
    return Promise.all(updates)
        .then((res) => {
            console.log('Snom XCAP: update successful')
            return Promise.resolve(true)
        })
}

/**
 * handler for snom XML
 * @param addressBooks
 * @param settingsSnomTbook 
 */
export function snomTbookHandler (addressBooks: any, settingsSnomTbook: any): Promise<boolean>
{
    console.log('SnomTbook: start')

    let snomTbookPromises: Promise<boolean> = Promise.resolve(true)

    // loop over all telephone books
    for (let i = 0; i < settingsSnomTbook.telephoneBooks.length; i++)
    {
        let telephoneBook = settingsSnomTbook.telephoneBooks[i]
        // convert vCards to  XML
        let data = <string>xml(snomTbookProcessCards(telephoneBook, addressBooks), { declaration: true })
        snomTbookPromises = snomTbookPromises.then(() => snomTbookUpdate(data, telephoneBook, settingsSnomTbook))
    }

    return snomTbookPromises
        .catch((err) => {
            console.log('SnomTbook: oops something went wrong')
            console.log(err)
            return Promise.resolve(false)
        })
}

/**
 * SnomTbook : process address books
 * @param telephoneBook
 * @param addressBooks 
 */
function snomTbookProcessCards (telephoneBook: any, addressBooks: any): any
{
    // all entries
    let entries: any[] = []

    // prevent duplicate entries
    let uniqueEntries: string[] = []

    // determine which vCards from which accounts are needed
    let accounts: any[] = []
    if ("accounts" in telephoneBook)
    {
        accounts = telephoneBook.accounts 
    }
    else
    {
        // default to all address books
        for (let i = 0; i < addressBooks.length; i++)
        {
            accounts.push({"account": i + 1})
        }
        
    }

    // replace work with business
    let telephoneBookOrder = telephoneBook.order
    if (telephoneBookOrder.indexOf('work') > -1) telephoneBookOrder[telephoneBookOrder.indexOf('work')] = 'business'

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

            // process card
            let entry = snomTbookProcessCard(vcf, telephoneBook.fullname, telephoneBookOrder, prefix, telephoneBook.duplicates, uniqueEntries)

            if (entry) entries.push(...entry)
        }
    }

    return {
        tbook: [
            {_attr: {complete: 'true'}},
            ...entries
        ]
    }
}
  
/**
 * SnomTbook : process single vcard
 * @param vcf
 * @param fullname
 * @param order
 * @param prefix
 * @param duplicates
 * @param uniqueEntries
 */
function snomTbookProcessCard(vcf: any, fullname: string[], order: string[], prefix: string, duplicates: boolean, uniqueEntries: string[]): any
{   
    // entry name
    let lastName = utilNameSanitize(vcf.names[0]) 
    let firstName = utilNameSanitize(vcf.names[1])
    let orgName = utilNameSanitize(vcf.org)
    lastName = lastName === '' && firstName === '' ? orgName : lastName
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
        let type = tel.type === 'work' ? 'business' : tel.type
        entries.push({type: type, number: (prefix === '' ? tel.number : prefix + tel.number).replace('+', '00')})
    }
  
    // if empty return nothing
    if (entries.length === 0) return

    // process all types and numbers
    let typeOrder = order.length !== 3 ? [ 'default' ] : order
    let i = 0
    let telephony = []

    // depends on quantity of phone numbers
    let referenceNumber = '0'
    if (entries.length === 1)
    {
        for (let type of typeOrder)
        {
            for (let entry of entries) 
            {
                if (type === 'default' || type === entry.type)
                {
                    telephony.push({item: [
                            {
                                _attr: {context: 'active'}
                            },
                            {
                                first_name: firstName
                            },
                            {
                                last_name: lastName
                            },
                            {
                                organization: orgName
                            },
                            {
                                number: entry.number
                            },
                            {
                                number_type: entry.type
                            }
                        ]
                    })
                    i++
                }
            }
        }
    }
    else
    {
        for (let type of typeOrder)
        {
            for (let entry of entries) 
            {
                if (type === 'default' || type === entry.type)
                {
                    if (i === 0)
                    {
                        telephony.push({item: [
                                {
                                    _attr: {context: 'active'}
                                },
                                {
                                    first_name: firstName
                                },
                                {
                                    last_name: lastName
                                },
                                {
                                    organization: orgName
                                },
                                {
                                    number: entry.number
                                }
                            ]
                        })
                        referenceNumber = entry.number
                        telephony.push({item: [
                                {
                                    _attr: {context: 'active'}
                                },
                                {
                                    first_name: 'Member_Alias'
                                },
                                {
                                    last_name: referenceNumber
                                },
                                {
                                    number: entry.number
                                },
                                {
                                    number_type: entry.type
                                }
                            ]
                        })
                    }
                    else
                    {
                        telephony.push({item: [
                                {
                                    _attr: {context: 'active'}
                                },
                                {
                                    first_name: 'Member_Alias'
                                },
                                {
                                    last_name: referenceNumber
                                },
                                {
                                    number: entry.number
                                },
                                {
                                    number_type: entry.type
                                }
                            ]
                        })
                    }
                    i++
                }
            }
        }
    }
    return telephony
}

/**
 * SnomTbook : update
 * @param data
 * @param telephoneBook
 * @param settingsSnomTbook
 */
function snomTbookUpdate (data: string, telephoneBook: any, settingsSnomTbook: any): Promise<boolean>
{
    console.log('SnomTbook : trying to update')

    let updates = []
    // build path
    let path = settingsSnomTbook.webroot.trim()
    if (path.slice(-1) !== '/') path += '/'
    path += settingsSnomTbook.dir.trim().replace(/^\//, '')
    if (path.slice(-1) !== '/') path += '/'
    path += telephoneBook.filename.trim()

    return Promise.resolve(true)
        .then((res) => fs.outputFile(path, data, {encoding: 'utf8'}))
        .then((res) => {
            console.log('SnomTbook : update successful')
            return Promise.resolve(true)
        })
}