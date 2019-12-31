import {utilNameFormat, utilParseVcard} from './utils'
import fs = require('fs-extra')
import {Promise} from 'es6-promise'
import xml = require('xml')

/**
 * handler for Yealink
 * @param addressBooks
 * @param settingsYealink 
 */
export function yealinkHandler (addressBooks: any, settingsYealink: any): Promise<boolean>
{
    console.log('Yealink: start')

    let yealinkPromises: Promise<boolean> = Promise.resolve(true)

    // loop over all telephone books
    for (let i = 0; i < settingsYealink.telephoneBooks.length; i++)
    {
        let telephoneBook = settingsYealink.telephoneBooks[i]
        // convert vCards to  XML
        let data = <string>xml(yealinkProcessCards(telephoneBook, addressBooks), { declaration: true })
        yealinkPromises = yealinkPromises.then(() => yealinkUpdate(data, telephoneBook, settingsYealink))
    }

    return yealinkPromises
        .catch((err) => {
            console.log('Yealink: oops something went wrong')
            console.log(err)
            return Promise.resolve(false)
        })
}
  
/**
 * Yealink : process address books
 * @param telephoneBook
 * @param addressBooks 
 */
function yealinkProcessCards (telephoneBook: any, addressBooks: any): any
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
            let entry = yealinkProcessCard(vcf, telephoneBook.fullname, telephoneBook.order, prefix, telephoneBook.duplicates, uniqueEntries)
            if (entry) entries.push(entry)
        }
    }

    let result: any = {}
    result[telephoneBook.name + 'IPPhoneDirectory'] = [...entries]

    return result
}
  
/**
 * Yealink : process single vcard
 * @param vcf
 * @param fullname
 * @param order
 * @param prefix
 * @param duplicates
 * @param uniqueEntries
 */
function yealinkProcessCard(vcf: any, fullname: string[], order: string[], prefix: string, duplicates: boolean, uniqueEntries: string[]): any
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
                telephony.push({Telephone: entry.number})
                i++
            }
        }
    }
    
    return {
        DirectoryEntry: [
            {
                Name: entryName
            },
            ...telephony
        ]
    }
}

/**
 * Yealink : update
 * @param data
 * @param telephoneBook
 * @param settingsYealink
 */
function yealinkUpdate (data: string, telephoneBook: any, settingsYealink: any): Promise<boolean>
{
    console.log('Yealink : trying to update')

    let updates = []
    // build path
    let path = settingsYealink.webroot.trim()
    if (path.slice(-1) !== '/') path += '/'
    path += settingsYealink.dir.trim().replace(/^\//, '')
    if (path.slice(-1) !== '/') path += '/'
    path += telephoneBook.filename.trim()

    return Promise.resolve(true)
        .then((res) => fs.outputFile(path, data, {encoding: 'utf8'}))
        .then((res) => {
            console.log('Yealink : update successful')
            return Promise.resolve(true)
        })
}