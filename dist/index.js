"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var utils_1 = require("./utils");
var carddav_1 = require("./carddav");
var fritzbox_1 = require("./fritzbox");
var ldap_1 = require("./ldap");
var snom_1 = require("./snom");
var es6_promise_1 = require("es6-promise");
/**
 * handle all destination phone updates
 */
function phoneHandlers() {
    var vcards = carddav_1.carddavVcards();
    var handlers = [];
    if (utils_1.settings.fritzbox)
        handlers.push(fritzbox_1.fritzBoxHandler(vcards));
    if (utils_1.settings.ldap)
        handlers.push(ldap_1.ldapHandler(vcards));
    if (utils_1.settings.snom)
        handlers.push(snom_1.snomHandler(vcards));
    return es6_promise_1.Promise.all(handlers).then(function (res) { return es6_promise_1.Promise.resolve(true); });
}
/**
 * create clients
 */
carddav_1.carddavClients()
    .then(function (res) {
    if (res.indexOf(true) > -1) {
        console.log('CardDAV: updates available');
        return phoneHandlers();
    }
    console.log('CardDAV: no updates available');
    return true;
})
    .catch(function (err) {
    console.log(err);
});
