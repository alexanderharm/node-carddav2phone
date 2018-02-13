"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
const carddav_1 = require("./carddav");
const fritzbox_1 = require("./fritzbox");
const snom_1 = require("./snom");
const es6_promise_1 = require("es6-promise");
const timers_1 = require("timers");
/**
 * handles periodic updates
 */
function updateHandler() {
    return carddav_1.carddavUpdate()
        .then((res) => {
        if (!res)
            return es6_promise_1.Promise.resolve(false);
        return phoneHandlers();
    });
}
/**
 * handle all destination phone updates
 */
function phoneHandlers() {
    let vcards = carddav_1.carddavVcards();
    let handlers = [];
    if (utils_1.settings.fritzbox)
        handlers.push(fritzbox_1.fritzBoxHandler(vcards));
    if (utils_1.settings.snom)
        handlers.push(snom_1.snomHandler(vcards));
    return es6_promise_1.Promise.all(handlers).then((res) => es6_promise_1.Promise.resolve(true));
}
/**
 * create clients
 */
carddav_1.carddavClients()
    .then((res) => phoneHandlers())
    .then((res) => timers_1.setInterval(() => updateHandler(), utils_1.settings.updateInterval * 60 * 1000))
    .catch((err) => {
    console.log(err);
});
