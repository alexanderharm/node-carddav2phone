"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
 */
function utilNameFormat(last, first, org) {
    var name = '';
    if (exports.settings.fritzbox.name.indexOf(first) > 0) {
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
