import json = require('comment-json')
import fs = require('fs-extra')
import PhoneNumber from 'awesome-phonenumber'
import {Promise} from 'es6-promise'
const Vcf = require('vcf')
import Xml2js = require('xml2js')

export const settings = json.parse(fs.readFileSync(__dirname + '/../settings.json', {encoding: 'utf8'}))

/**
 * get company name
 * @param vcf 
 */
export function utilOrgName (vcf: any): string
{
    if (typeof vcf.get('org') === 'undefined') return ''
    else {
        return vcf.get('org').valueOf().replace(/\\/g, '').replace(/\;/g, ' - ').replace(/^ \- /g, '').replace(/ \- $/g, '').trim()
    }
}

/**
 * format display name
 * @param last 
 * @param first 
 * @param org
 * @param fullname
 */
export function utilNameFormat (last: string, first: string, org: string, fullname: string[]): string
{
    let name = ''
    if (fullname.indexOf(first) > 0)
    {
        if (last.length > 0) name += last
        if (first.length > 0) name += ' ' + first
    }
    else
    {
        if (first.length > 0) name += first
        if (last.length > 0) name += ' ' + last
    }

    if (org.length > 0) name += ' - ' + org
    return name.replace(/\\/g, '').replace(/^ \- /g, '').replace(/  /g, '').trim()
}

/**
 * convert number to PhoneNumber
 * @param number 
 */
export function utilNumberConvert (number: string): PhoneNumber
{

    // try to convert number into e164 format
    number = number
    // remove leading and trailing whitespace
    .trim()
    // replace leading '+' with zeros
    .replace(/^\+/, '00')
    // remove everything but numbers
    .replace(/[^0-9]/g, '')
    // replace leading zeros with '+'
    .replace(/^00/, '+')

    // if phone number is shorter than 8 digits and doesn't start with 0 add area code
    if (number.length < 8 && /^[^0]/.test(number)) number = settings.telephony.areaCode + number

    // check if region code can be guessed and if not set it with default
    let phoneNumber = new PhoneNumber(number)
    if (!phoneNumber.getRegionCode()) phoneNumber = new PhoneNumber(number, settings.telephony.countryCode)
    
    return phoneNumber
}

/**
 * determine telephone number type
 * @param type 
 * @param number 
 */
export function utilNumberGetType (type: string|string[], number: PhoneNumber): string|undefined
{
    // normalize
    if (!Array.isArray(type)) type = [ type ]
  
    if (number.isMobile()) return 'mobile'
    else if (type.length < 2) return 'home'
    else if (type.indexOf('voice') > -1)
    {
        if (type.indexOf('work') > -1) return 'work'
        return 'home'
    }
    return
}

/**
 * sanitize number
 * @param phoneNumber 
 */
export function utilNumberSanitize (phoneNumber: PhoneNumber): string
{
    if (settings.telephony.stripCountryCode && phoneNumber.getRegionCode() === settings.telephony.countryCode)
    {
        if (settings.telephony.stripAreaCode) {
            let reAreaCode = new RegExp('^' + settings.telephony.areaCode)
            return phoneNumber.getNumber('national').replace(/[^0-9]/g, '').replace(reAreaCode, '')
        }
        return phoneNumber.getNumber('national').replace(/[^0-9]/g, '')
    }
    return phoneNumber.getNumber('e164')
}

/**
 * validate number
 * @param phoneNumber 
 */
export function utilNumberValid (phoneNumber: string): boolean
{
    return /[0-9]{4}$/.test(phoneNumber.replace(/[^0-9]/g, ''))
}

/**
 * get vCard content
 * @param vcf
 * 
 * @returns uid, names, org, tel, note
 */
export function utilParseVcard (vcard: any): any
{
    // parse vCard
    let vcf = new Vcf().parse(vcard)

    // get uid
    let uid: string = vcf.get('uid').valueOf()

    // get array of names
    let names: string[] = vcf.get('n').valueOf().split(';').map((name: string) => name.trim())

    // get org name
    let org: string = vcf.get('org') ? vcf.get('org').valueOf().replace(/\\/g, '').replace(/\;/g, ' - ').replace(/^ \- /g, '').replace(/ \- $/g, '').trim() : ''

    // get array of telephone numbers
    let tels: any[] = []
    let telstmp: any[] = vcf.get('tel') ? vcf.get('tel') : []
    if (!Array.isArray(telstmp)) telstmp = [ telstmp ]
    for (let tel of telstmp) {
        // test if number
        if (!utilNumberValid(tel.valueOf())) continue
        // convert to number
        let number = utilNumberConvert(tel.valueOf())
        // determine type
        let type = utilNumberGetType(tel.type, number)
        // store number if of type voice
        if (type) tels.push({type: type, number: utilNumberSanitize(number)})
    }

    // get note
    let note: string = vcf.get('note') ? vcf.get('note').valueOf() : ''

    return {uid, names, org, tels, note}
}

/**
 * promisify parse xml
 * @param xml 
 */
export function utilParseXml (xml: string): any
{
    return new Promise((resolve, reject) => {
        Xml2js.parseString(xml, (err, res) => {
            if (err) reject(err)
            resolve(res)
        })
    })
}