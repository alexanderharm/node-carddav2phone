"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var utils_1 = require("./utils");
var carddav_1 = require("./carddav");
var fritzbox_1 = require("./fritzbox");
var ldap_1 = require("./ldap");
var snom_1 = require("./snom");
var yealink_1 = require("./yealink");
var es6_promise_1 = require("es6-promise");
/**
 * handle all destination phone updates
 * @param accountsVcards
 * @param settings
 */
function phoneHandlers(accountsVcards, settings) {
    var handlers = [];
    if (settings.fritzbox)
        handlers.push(fritzbox_1.fritzBoxHandler(accountsVcards, settings.fritzbox));
    if (settings.ldap)
        handlers.push(ldap_1.ldapHandler(accountsVcards, settings.ldap));
    if (settings.snom)
        handlers.push(snom_1.snomHandler(accountsVcards, settings.snom));
    if (settings.yealink)
        handlers.push(yealink_1.yealinkHandler(accountsVcards, settings.yealink));
    return es6_promise_1.Promise.all(handlers).then(function (res) { return es6_promise_1.Promise.resolve(true); });
}
/**
 * create clients
 */
carddav_1.carddavRetrieve(utils_1.settings)
    .then(function (res) {
    if (res[0].indexOf(true) > -1) {
        console.log('CardDAV: updates available');
        return phoneHandlers(res[1], utils_1.settings);
    }
    console.log('CardDAV: no updates available');
    return true;
})
    .catch(function (err) {
    console.log(err);
});
