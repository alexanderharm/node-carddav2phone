"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
}
Object.defineProperty(exports, "__esModule", { value: true });
const json = require("comment-json");
const fs = require("fs-extra");
const awesome_phonenumber_1 = __importDefault(require("awesome-phonenumber"));
const es6_promise_1 = require("es6-promise");
const Xml2js = require("xml2js");
exports.settings = json.parse(fs.readFileSync(__dirname + '/../settings.json', { encoding: 'utf8' }));
/**
 * convert number to PhoneNumber
 * @param number
 */
function utilNumberConvert(number) {
    // try to convert number into e164 format
    number = number
        .trim()
        .replace(/^\+/, '00')
        .replace(/[^0-9]/g, '')
        .replace(/^00/, '+');
    // check if region code can be guessed and if not set it with default
    let phoneNumber = new awesome_phonenumber_1.default(number);
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
    else if (type.indexOf('voice') > 0) {
        if (type.indexOf('work') > 0)
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
    if (phoneNumber.getRegionCode() === exports.settings.telephony.countryCode) {
        let reAreaCode = new RegExp('^' + exports.settings.telephony.areaCode);
        return phoneNumber.getNumber('national').replace(/[^0-9]/g, '').replace(reAreaCode, '');
    }
    return phoneNumber.getNumber('e164');
}
exports.utilNumberSanitize = utilNumberSanitize;
/**
 * promisify parse xml
 * @param xml
 */
function utilParseXml(xml) {
    return new es6_promise_1.Promise((resolve, reject) => {
        Xml2js.parseString(xml, (err, res) => {
            if (err)
                reject(err);
            resolve(res);
        });
    });
}
exports.utilParseXml = utilParseXml;
