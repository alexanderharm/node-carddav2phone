"use strict";
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.utilParseXml = exports.utilParseVcard = exports.utilNumberValid = exports.utilNumberSanitize = exports.utilEmailGetType = exports.utilFaxGetType = exports.utilNumberGetType = exports.utilNumberConvert = exports.utilNameSanitize = exports.utilNameFormat = exports.utilOrgName = exports.settings = void 0;
var json = require("comment-json");
var fs = require("fs-extra");
var awesome_phonenumber_1 = __importDefault(require("awesome-phonenumber"));
var es6_promise_1 = require("es6-promise");
var Vcf = require('vcf');
var Xml2js = require("xml2js");
exports.settings = json.parse(fs.readFileSync(__dirname + '/../settings.json', { encoding: 'utf8' }));
/**
 * get company name
 * @param vcf
 */
function utilOrgName(vcf) {
    if (typeof vcf.get('org') === 'undefined')
        return '';
    else {
        return vcf.get('org').valueOf().replace(/\\/g, '').replace(/\;/g, ' - ').replace(/^ \- /g, '').replace(/ \- $/g, '').trim();
    }
}
exports.utilOrgName = utilOrgName;
/**
 * format display name
 * @param last
 * @param first
 * @param org
 * @param fullname
 */
function utilNameFormat(last, first, org, fullname) {
    var name = '';
    if (fullname.indexOf(first) > 0) {
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
    return name.replace(/\\/g, '').replace(/^ \- /g, '').replace(/  /g, '').trim();
}
exports.utilNameFormat = utilNameFormat;
/**
 * sanitize name
 * @param name
 */
function utilNameSanitize(name) {
    return name.replace(/\\/g, '').replace(/\;/g, '-').replace(/^ \- /g, '').replace(/ \- $/g, '').replace(/  /g, '').trim();
}
exports.utilNameSanitize = utilNameSanitize;
/**
 * convert number to PhoneNumber
 * @param number
 */
function utilNumberConvert(number) {
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
        number = exports.settings.telephony.areaCode + number;
    // check if region code can be guessed and if not set it with default
    var phoneNumber = new awesome_phonenumber_1.default(number);
    if (!phoneNumber.getRegionCode())
        phoneNumber = new awesome_phonenumber_1.default(number, exports.settings.telephony.countryCode);
    return phoneNumber;
}
exports.utilNumberConvert = utilNumberConvert;
/**
 * determine telephone number type
 * @param type
 * @param number
 */
function utilNumberGetType(type, number) {
    // normalize
    if (!Array.isArray(type))
        type = [type];
    if (number.isMobile())
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
exports.utilNumberGetType = utilNumberGetType;
/**
 * determine fax number type
 * @param type
 */
function utilFaxGetType(type) {
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
exports.utilFaxGetType = utilFaxGetType;
/**
* determine email type
* @param type
*/
function utilEmailGetType(type) {
    // normalize
    if (!Array.isArray(type))
        type = [type];
    if (type.indexOf('work') > -1)
        return 'work';
    return 'home';
}
exports.utilEmailGetType = utilEmailGetType;
/**
 * sanitize number
 * @param phoneNumber
 */
function utilNumberSanitize(phoneNumber) {
    if (exports.settings.telephony.stripCountryCode && phoneNumber.getRegionCode() === exports.settings.telephony.countryCode) {
        if (exports.settings.telephony.stripAreaCode) {
            var reAreaCode = new RegExp('^' + exports.settings.telephony.areaCode);
            return phoneNumber.getNumber('national').replace(/[^0-9]/g, '').replace(reAreaCode, '');
        }
        return phoneNumber.getNumber('national').replace(/[^0-9]/g, '');
    }
    return phoneNumber.getNumber('e164');
}
exports.utilNumberSanitize = utilNumberSanitize;
/**
 * validate number
 * @param phoneNumber
 */
function utilNumberValid(phoneNumber) {
    return /[0-9]{4}$/.test(phoneNumber.replace(/[^0-9]/g, ''));
}
exports.utilNumberValid = utilNumberValid;
/**
 * get vCard content
 * @param vcf
 *
 * @returns uid, names, org, tel, note
 */
function utilParseVcard(vcard) {
    var e_1, _a, e_2, _b, e_3, _c;
    // parse vCard
    var vcf = new Vcf().parse(vcard);
    // get uid
    var uid = vcf.get('uid').valueOf();
    // get array of names
    var names = vcf.get('n').valueOf().split(';').map(function (name) { return name.trim(); });
    // get org name
    var org = vcf.get('org') ? vcf.get('org').valueOf().replace(/\\/g, '').replace(/\;/g, ' - ').replace(/^ \- /g, '').replace(/ \- $/g, '').trim() : '';
    // get array of telephone numbers
    var tels = [];
    var telstmp = vcf.get('tel') ? vcf.get('tel') : [];
    if (!Array.isArray(telstmp))
        telstmp = [telstmp];
    try {
        for (var telstmp_1 = __values(telstmp), telstmp_1_1 = telstmp_1.next(); !telstmp_1_1.done; telstmp_1_1 = telstmp_1.next()) {
            var tel = telstmp_1_1.value;
            // test if number
            if (!utilNumberValid(tel.valueOf()))
                continue;
            // convert to number
            var number = utilNumberConvert(tel.valueOf());
            // determine type
            var type = utilNumberGetType(tel.type, number);
            // store number if of type voice
            if (type)
                tels.push({ type: type, number: utilNumberSanitize(number) });
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (telstmp_1_1 && !telstmp_1_1.done && (_a = telstmp_1.return)) _a.call(telstmp_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    // get array of fax numbers
    var faxs = [];
    var faxstmp = vcf.get('tel') ? vcf.get('tel') : [];
    if (!Array.isArray(faxstmp))
        faxstmp = [faxstmp];
    try {
        for (var faxstmp_1 = __values(faxstmp), faxstmp_1_1 = faxstmp_1.next(); !faxstmp_1_1.done; faxstmp_1_1 = faxstmp_1.next()) {
            var fax = faxstmp_1_1.value;
            // test if number
            if (!utilNumberValid(fax.valueOf()))
                continue;
            // convert to number
            var number = utilNumberConvert(fax.valueOf());
            // determine type
            var type = utilFaxGetType(fax.type);
            // store number if of type fax
            if (type)
                faxs.push({ type: type, number: utilNumberSanitize(number) });
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (faxstmp_1_1 && !faxstmp_1_1.done && (_b = faxstmp_1.return)) _b.call(faxstmp_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    // get array of email addresses
    var emails = [];
    var emailstmp = vcf.get('email') ? vcf.get('email') : [];
    if (!Array.isArray(emailstmp))
        emailstmp = [emailstmp];
    try {
        for (var emailstmp_1 = __values(emailstmp), emailstmp_1_1 = emailstmp_1.next(); !emailstmp_1_1.done; emailstmp_1_1 = emailstmp_1.next()) {
            var email = emailstmp_1_1.value;
            // verify if email is valid
            if (!email.valueOf())
                continue;
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.valueOf()))
                continue;
            // determine type
            var type = utilEmailGetType(email.type);
            // store email
            emails.push({ type: type, address: email.valueOf() });
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (emailstmp_1_1 && !emailstmp_1_1.done && (_c = emailstmp_1.return)) _c.call(emailstmp_1);
        }
        finally { if (e_3) throw e_3.error; }
    }
    // get note
    var note = vcf.get('note') && vcf.get('note').valueOf() ? vcf.get('note').valueOf() : '';
    return { uid: uid, names: names, org: org, tels: tels, faxs: faxs, emails: emails, note: note };
}
exports.utilParseVcard = utilParseVcard;
/**
 * promisify parse xml
 * @param xml
 */
function utilParseXml(xml) {
    return new es6_promise_1.Promise(function (resolve, reject) {
        Xml2js.parseString(xml, function (err, res) {
            if (err)
                reject(err);
            resolve(res);
        });
    });
}
exports.utilParseXml = utilParseXml;
