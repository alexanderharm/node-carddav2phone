"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var utils_1 = require("./utils");
var carddav_1 = require("./carddav");
var fritzbox_1 = require("./fritzbox");
var snom_1 = require("./snom");
var es6_promise_1 = require("es6-promise");
var timers_1 = require("timers");
/**
 * handles periodic updates
 */
function updateHandler() {
    return carddav_1.carddavUpdate()
        .then(function (res) {
        if (!res)
            return es6_promise_1.Promise.resolve(false);
        return phoneHandlers();
    });
}
/**
 * handle all destination phone updates
 */
function phoneHandlers() {
    var vcards = carddav_1.carddavVcards();
    var handlers = [];
    if (utils_1.settings.fritzbox)
        handlers.push(fritzbox_1.fritzBoxHandler(vcards));
    if (utils_1.settings.snom)
        handlers.push(snom_1.snomHandler(vcards));
    return es6_promise_1.Promise.all(handlers).then(function (res) { return es6_promise_1.Promise.resolve(true); });
}
/**
 * create clients
 */
carddav_1.carddavClients()
    .then(function (res) { return phoneHandlers(); })
    .then(function (res) { return timers_1.setInterval(function () { return updateHandler(); }, utils_1.settings.updateInterval * 60 * 1000); })
    .catch(function (err) {
    console.log(err);
});
