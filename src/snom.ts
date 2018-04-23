import {settings, utilOrgName, utilNameFormat, utilNumberConvert, utilNumberGetType, utilNumberSanitize, utilNumberValid, utilParseXml} from './utils'
import fs = require('fs-extra')
import {Promise} from 'es6-promise'
const Vcf = require('vcf')
import xml = require('xml')

// XCAP does not like duplicate numbers!
let xcapUniqueNumbers: string[]

/**
 * handler for Snom
 * @param vcards 
 */
export function snomHandler (vcards: any[]): Promise<boolean[]>
{
    console.log('Snom: start')
    // reset unique numbers
    xcapUniqueNumbers = []
    let snomHandlers: any[] = []
    if (settings.snom.xcap) snomHandlers.push(snomXcapHandler(vcards))
    return Promise.all(snomHandlers)
}

/**
 * Snom XCAP: handler function
 * @param vcards 
 */
function snomXcapHandler (vcards: any[]): Promise<boolean>
{
    console.log('Snom XCAP: start')

    // convert vCards to XCAP XML
    let data = <string>xml(snomXcapProcessCards(vcards), { declaration: true })

    return snomXcapUpdate(data)
        .catch((err) => {
            console.log('Snom XCAP: oops something went wrong')
            console.log(err)
            return Promise.resolve(false)
        })
}
  
/**
 * Snom XCAP: process vcards
 * @param vcards 
 */
function snomXcapProcessCards (vcards: any[]): any
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
        let entry = snomXcapProcessCard(vcf.get('uid').valueOf(), names[0].trim(), names[1].trim(), utilOrgName(vcf), tel)
        if (entry) entries.push(entry)
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
 * @param uid 
 * @param last 
 * @param first 
 * @param tel 
 */
function snomXcapProcessCard(uid: string, last: string, first: string, org: string, tels: string|any[]): any
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
        // check for duplicate phone number
        let number = utilNumberSanitize(phoneNumber)
        if (xcapUniqueNumbers.indexOf(number) > -1) {
            console.log('WARNING: Duplicate number (' + number + ') on ' + utilNameFormat(last, first, org))
            continue
        }
        xcapUniqueNumbers.push(number)
        // store number if of type voice
        if (type) entries.push({type: type, number: number})
    }
  
    // if empty return nothing
    if (entries.length === 0) return
  
    // process all types and numbers
    let typeOrder = settings.snom.xcap.order.length < 3 ? [ 'default' ] : settings.snom.xcap.order
    let i = 0
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
                'display-name': utilNameFormat(last, first, org)
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
            {
                'cp:prop': [
                    {
                        _attr: {
                            name: 'company',
                            value: org
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
 * @param vcards 
 */
function snomXcapUpdate (data: string): Promise<boolean>
{
    console.log('Snom XCAP: trying to update')

    let updates = []
    for (let account of settings.snom.xcap.sipAccounts)
    {
        // build path
        let path = settings.snom.xcap.webroot.trim()
        if (path.slice(-1) !== '/') path += '/'
        path += settings.snom.xcap.dir.trim().replace(/^\//, '')
        if (path.slice(-1) !== '/') path += '/'
        path += 'users/sip:' + account.trim() + '/'
        path += settings.snom.xcap.filename.trim()
        updates.push(fs.outputFile(path, data, {encoding: 'utf8'}))
    }
    return Promise.all(updates)
        .then((res) => {
            console.log('Snom XCAP: update successful')
            return Promise.resolve(true)
        })
}