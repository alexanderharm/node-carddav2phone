import json from 'comment-json';
import fs from 'fs-extra';
import { parsePhoneNumber } from 'awesome-phonenumber';
//import {Promise} from 'es6-promise'
import Vcf from 'vcf';
import Xml2js from 'xml2js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const settings = json.parse(fs.readFileSync(__dirname + '/../settings.json', { encoding: 'utf8' }));
/**
 * get company name
 * @param vcf
 */
export function utilOrgName(vcf) {
    if (typeof vcf.get('org') === 'undefined')
        return '';
    else {
        return vcf.get('org').valueOf().replace(/\\/g, '').replace(/\;/g, ' - ').replace(/^ \- /g, '').replace(/ \- $/g, '').trim();
    }
}
/**
 * format display name
 * @param last
 * @param first
 * @param org
 * @param fullname
 */
export function utilNameFormat(last, first, org, fullname) {
    let name = '';
    if (last.length === 0 && first.length === 0) {
        name += org;
    }
    else {
        if (fullname.indexOf('first') > 0) {
            if (last.length > 0)
                name += last;
            if (first.length > 0)
                name += ' ' + first;
        }
        else {
            if (first.length > 0)
                name += first;
            if (last.length > 0)
                name += ' ' + last;
        }
        if (org.length > 0)
            name += ' - ' + org;
    }
    return name.replace(/\\/g, '').replace(/^ \- /g, '').replace(/  /g, '').trim();
}
/**
 * sanitize name
 * @param name
 */
export function utilNameSanitize(name) {
    return name.replace(/\\/g, '').replace(/\;/g, '-').replace(/^ \- /g, '').replace(/ \- $/g, '').replace(/  /g, '').trim();
}
/**
 * convert number to PhoneNumber
 * @param number
 */
export function utilNumberConvert(number) {
    // try to convert number into e164 format
    number = number
        // remove leading and trailing whitespace
        .trim()
        // replace leading '+' with zeros
        .replace(/^\+/, '00')
        // remove everything but numbers
        .replace(/[^0-9]/g, '')
        // replace leading zeros with '+'
        .replace(/^00/, '+');
    // if phone number is shorter than 8 digits and doesn't start with 0 add area code
    if (number.length < 8 && /^[^0]/.test(number))
        number = settings.telephony.areaCode + number;
    // check if region code can be guessed and if not set it with default
    let phoneNumber = parsePhoneNumber(number);
    if (phoneNumber.valid) {
        if (!phoneNumber.regionCode)
            phoneNumber = parsePhoneNumber(number, { regionCode: settings.telephony.countryCode });
    }
    else {
        phoneNumber = parsePhoneNumber(number, { regionCode: settings.telephony.countryCode });
    }
    return phoneNumber;
}
/**
 * determine telephone number type
 * @param type
 * @param number
 */
export function utilNumberGetType(type, number) {
    // normalize
    if (!Array.isArray(type))
        type = [type];
    if (number.typeIsMobile)
        return 'mobile';
    else if (type.length < 2)
        return 'home';
    else if (type.indexOf('voice') > -1) {
        if (type.indexOf('work') > -1)
            return 'work';
        return 'home';
    }
    return;
}
/**
 * determine fax number type
 * @param type
 */
export function utilFaxGetType(type) {
    // normalize
    if (!Array.isArray(type))
        type = [type];
    if (type.indexOf('fax') > -1) {
        if (type.indexOf('work') > -1)
            return 'work';
        return 'home';
    }
    return;
}
/**
* determine email type
* @param type
*/
export function utilEmailGetType(type) {
    // normalize
    if (!Array.isArray(type))
        type = [type];
    if (type.indexOf('work') > -1)
        return 'work';
    return 'home';
}
/**
 * sanitize number
 * @param phoneNumber
 */
export function utilNumberSanitize(phoneNumber) {
    if (settings.telephony.stripCountryCode && phoneNumber.regionCode === settings.telephony.countryCode) {
        if (settings.telephony.stripAreaCode) {
            let reAreaCode = new RegExp('^' + settings.telephony.areaCode);
            if (phoneNumber.number)
                return phoneNumber.number.national.replace(/[^0-9]/g, '').replace(reAreaCode, '');
        }
        if (phoneNumber.number)
            return phoneNumber.number.national.replace(/[^0-9]/g, '');
    }
    if (phoneNumber.number)
        return phoneNumber.number.e164;
    return '';
}
/**
 * validate number
 * @param phoneNumber
 */
export function utilNumberValid(phoneNumber) {
    return /[0-9]{4}$/.test(phoneNumber.replace(/[^0-9]/g, ''));
}
/**
 * get vCard content
 * @param vcf
 *
 * @returns uid, names, org, tel, note
 */
export function utilParseVcard(vcard) {
    // parse vCard
    let vcf = new Vcf().parse(vcard);
    // get uid
    let uid = vcf.get('uid').valueOf().toString();
    // get array of names
    let names = [];
    let lastName = '';
    let firstName = '';
    if (vcf.get('n'))
        names = vcf.get('n').valueOf().toString().split(';').map((name) => name.trim());
    if (names[0] && names[0].length > 0)
        lastName = utilNameSanitize(names[0]);
    if (names[1] && names[1].length > 0)
        firstName = utilNameSanitize(names[1]);
    // get org name
    let orgs = [];
    let orgName = '';
    if (vcf.get('org'))
        orgs = vcf.get('org').valueOf().toString().split(';').map((org) => org.trim());
    if (orgs[0] && orgs[0].length > 0 && orgs[1] && orgs[1].length > 0)
        orgName = utilNameSanitize(orgs[1]) + ' - ' + utilNameSanitize(orgs[0]);
    else if (orgs[0] && orgs[0].length > 0)
        orgName = utilNameSanitize(orgs[0]);
    // get array of telephone numbers
    let tels = [];
    let telstmp = vcf.get('tel') ? vcf.get('tel') : [];
    if (!Array.isArray(telstmp))
        telstmp = [telstmp];
    for (let tel of telstmp) {
        // test if number
        if (!utilNumberValid(tel.valueOf()))
            continue;
        // convert to number
        let number = utilNumberConvert(tel.valueOf());
        // determine type
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        let type = utilNumberGetType(tel.type, number);
        // store number if of type voice
        if (type)
            tels.push({ type: type, number: utilNumberSanitize(number) });
    }
    // get array of fax numbers
    let faxs = [];
    let faxstmp = vcf.get('tel') ? vcf.get('tel') : [];
    if (!Array.isArray(faxstmp))
        faxstmp = [faxstmp];
    for (let fax of faxstmp) {
        // test if number
        if (!utilNumberValid(fax.valueOf()))
            continue;
        // convert to number
        let number = utilNumberConvert(fax.valueOf());
        // determine type
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        let type = utilFaxGetType(fax.type);
        // store number if of type fax
        if (type)
            faxs.push({ type: type, number: utilNumberSanitize(number) });
    }
    // get array of email addresses
    let emails = [];
    let emailstmp = vcf.get('email') ? vcf.get('email') : [];
    if (!Array.isArray(emailstmp))
        emailstmp = [emailstmp];
    for (let email of emailstmp) {
        // verify if email is valid
        if (!email.valueOf())
            continue;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.valueOf()))
            continue;
        // determine type
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        let type = utilEmailGetType(email.type);
        // store email
        emails.push({ type: type, address: email.valueOf() });
    }
    // get note
    let note = vcf.get('note') && vcf.get('note').valueOf() ? vcf.get('note').valueOf().toString().replace(/\\,/g, ',') : '';
    return { uid, lastName, firstName, orgName, tels, faxs, emails, note };
}
/**
 * promisify parse xml
 * @param xml
 */
export function utilParseXml(xml) {
    return new Promise((resolve, reject) => {
        Xml2js.parseString(xml, (err, res) => {
            if (err)
                reject(err);
            resolve(res);
        });
    });
}
