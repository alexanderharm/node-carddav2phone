import {utilNameFormat, utilNameSanitize, utilParseVcard} from './utils'
import jsonexport from "jsonexport/dist"
import fs = require('fs-extra')
import {Promise} from 'es6-promise'

/**
 * handler for pascom
 * @param addressBooks
 * @param settingsPascom 
 */
export function pascomHandler (addressBooks: any, settingsPascom: any): Promise<boolean[]>
{
    console.log('Pascom: start')
    let pascomHandlers: any[] = []
    if (settingsPascom.csv) pascomHandlers.push(pascomCsvHandler(addressBooks, settingsPascom.csv))
    return Promise.all(pascomHandlers)
}

/**
 * handler for snom XML
 * @param addressBooks
 * @param settingsPascomCsv 
 */
 export function pascomCsvHandler (addressBooks: any, settingsPascomCsv: any): Promise<boolean>
 {
     console.log('PascomCsv: start')
 
     let pascomCsvPromises: Promise<boolean> = Promise.resolve(true)
 
     // loop over all telephone books
     for (let i = 0; i < settingsPascomCsv.telephoneBooks.length; i++)
     {
         let telephoneBook = settingsPascomCsv.telephoneBooks[i]
         // convert vCards to  XML
         let data = pascomCsvProcessCards(telephoneBook, addressBooks)
         pascomCsvPromises = pascomCsvPromises.then(() => pascomCsvUpdate(data, telephoneBook, settingsPascomCsv))
     }
 
     return pascomCsvPromises
         .catch((err) => {
             console.log('PascomCsv: oops something went wrong')
             console.log(err)
             return Promise.resolve(false)
         })
 }

/**
 * PascomCsv : process address books
 * @param telephoneBook
 * @param addressBooks 
 */
function pascomCsvProcessCards (telephoneBook: any, addressBooks: any): any
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
            let entry = pascomCsvProcessCard(vcf, telephoneBook.fullname, prefix, telephoneBook.duplicates, uniqueEntries)
            if (entry) entries.push(entry)
        }
    }

    return [...entries]
}

/**
 * PascomCsv : process single vcard
 * @param vcf
 * @param fullname
 * @param prefix
 * @param duplicates
 * @param uniqueEntries
 */
 function pascomCsvProcessCard(vcf: any, fullname: string[], prefix: string, duplicates: boolean, uniqueEntries: string[]): any
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
         entries.push({type: tel.type, number: (prefix === '' ? tel.number : prefix + tel.number).replace('+', '00')})
     }
   
     // if empty return nothing
     if (entries.length === 0) return
 
     // sort by type order
     let telephony: any = {
         home: [],
         mobile: [],
         work: []
     }
     for (let entry of entries) 
     {
         telephony[entry.type].push(entry.number)
     }
 
     // reduce to single number per type
     let numberHome: string = telephony.home.length > 0 ? telephony.home[0] : ""
     let numberMobile: string = telephony.mobile.length > 0 ? telephony.mobile[0] : ""
     let numberWork: string = telephony.work.length > 0 ? telephony.work[0] : ""
 
     // reset entries for fax numbers
     entries = []
 
     // iterate through all numbers
     for (let fax of vcf.faxs)
     {
         entries.push({type: fax.type, number: (prefix === '' ? fax.number : prefix + fax.number).replace('+', '00')})
     }
 
     // sort by type order
     let faxes: any = {
         home: [],
         work: []
     }
     for (let entry of entries) 
     {
         faxes[entry.type].push(entry.number)
     }
 
     // reduce to single number per type
     let faxHome: string = faxes.home.length > 0 ? faxes.home[0] : ""
     let faxWork: string = faxes.work.length > 0 ? faxes.work[0] : ""
 
     // reset entries for emails
     entries = []
 
     // iterate through all numbers
     for (let email of vcf.emails)
     {
         entries.push({type: email.type, email: email.address})
     }
 
     // sort by type order
     let emails: any = {
         home: [],
         work: []
     }
     for (let entry of entries) 
     {
         emails[entry.type].push(entry.email)
     }
 
     // reduce to single number per type
     let emailHome: string = emails.home.length > 0 ? emails.home[0] : ""
     let emailWork: string = emails.work.length > 0 ? emails.work[0] : ""

     return {
         displayName: entryName,
         firstName: firstName,
         lastName: lastName,
         orgName: orgName,
         work: numberWork,
         mobile: numberMobile,
         home: numberHome,
         fax: faxWork ? faxWork : faxHome,
         email: emailWork ? emailWork : emailHome,
         notes: vcf.note.replace(/"/g, '"""')
     }

}

/**
 * PascomCsv : update
 * @param data
 * @param telephoneBook
 * @param settingsPascomCsv
 */
function pascomCsvUpdate (data: any, telephoneBook: any, settingsPascomCsv: any): Promise<boolean>
{
    console.log('PascomCsv : trying to update')

    let updates = []
    // build path
    let path = settingsPascomCsv.outputdir.trim()
    if (path.slice(-1) !== '/') path += '/'
    path += telephoneBook.filename.trim()

    // convert to pascom csv format
    let options = {
        headers: ["displayName", "work", "firstName", "lastName", "orgName", "email", "mobile", "home", "fax", "notes"],
        rename: ["displayname", "phone", "givenname", "surname", "organisation", "email", "mobile", "homephone", "fax", "notes"],
        forceTextDelimiter: true
    }

    return Promise.resolve(true)
        .then((res) => jsonexport(data, options))
        .then((res) => fs.outputFile(path, res, {encoding: 'utf8'}))
        .then((res) => {
            console.log('PascomCsv : update successful')
            return Promise.resolve(true)
        })
}