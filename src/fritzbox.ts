import {settings, utilNumberConvert, utilNumberGetType, utilNumberSanitize, utilParseXml} from './utils'
const Iconv = require('iconv').Iconv
import md5 = require('md5')
import {Promise} from 'es6-promise'
var rp = require('request-promise-native')
const Vcf = require('vcf')
import xml = require('xml')

/**
 * handler for Fritz!Box
 * @param vcards 
 */
export function fritzBoxHandler (vcards: any[]): Promise<boolean>
{
    console.log('Fritz!Box: start')

    // convert vCards to Fritz!Box XML
    let data = <string>xml(fritzBoxProcessCards(vcards), { declaration: true })
    return fritzBoxUpdate(data)
        .catch((err) => {
            console.log('Fritz!Box: oops something went wrong')
            console.log(err)
            return Promise.resolve(false)
        })
}

/**
 * Fritz!Box: process vCards
 * @param vcards 
 */
function fritzBoxProcessCards (vcards: any[]): any
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
        let entry = fritzBoxProcessCard(names[0].trim(), names[1].trim(), tel)
        if (entry) entries.push(entry)
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
 */
function fritzBoxProcessCard(last: string, first: string, tels: string|any[]): any
{
  
    // object to hold different kinds of phone numbers, limit to home, work, mobile, default to home
    let entries = []
  
    // test if tel is an array
    if (!Array.isArray(tels)) tels = [ tels ]

    // iterate through all numbers
    for (let tel of tels)
    {
        // convert to PhoneNumber
        let phoneNumber = utilNumberConvert(tel.valueOf())
        // determine type
        let type = utilNumberGetType(tel.type, phoneNumber)
        // store number if of type voice
        if (type) entries.push({type: type, number: utilNumberSanitize(phoneNumber)})
    }
  
    // if empty return nothing
    if (entries.length === 0) return
  
    // process all types and numbers
    let typeOrder = settings.fritzbox.order.length < 3 ? [ 'default' ] : settings.fritzbox.order
    let name = settings.fritzbox.name.indexOf(first) > 0 ? last + ' ' + first : first + ' ' + last
    let i = 0
    let telephony = []

    // go by type order
    for (let type of typeOrder)
    {
        for (let entry of entries) 
        {
            if (type === 'default' || type === entry.type)
            {
                telephony.push({
                    number: [
                        {
                            _attr:
                            {
                                id: i,
                                prio: i == 0 ? '1' : '0',
                                type: entry.type
                            }
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
                person: [{
                    realName: name
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
            let iconv = new Iconv('UTF-8', 'UCS-2LE')
            let response = challenge + '-' + md5(iconv.convert(challenge + '-' + settings.fritzbox.password))
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