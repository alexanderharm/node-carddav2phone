import json = require('comment-json')
import fs = require('fs-extra')
import PhoneNumber from 'awesome-phonenumber'
import {Promise} from 'es6-promise'
import Xml2js = require('xml2js')

export const settings = json.parse(fs.readFileSync(__dirname + '/settings.json', {encoding: 'utf8'}))

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
    else if (type.indexOf('voice') > 0)
    {
        if (type.indexOf('work') > 0) return 'work'
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
    if (phoneNumber.getRegionCode() === settings.telephony.countryCode)
    {
        let reAreaCode = new RegExp('^' + settings.telephony.areaCode)
        return phoneNumber.getNumber('national').replace(/[^0-9]/g, '').replace(reAreaCode, '')
    }
    return phoneNumber.getNumber('e164')
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