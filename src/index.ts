import {settings} from './utils'
import {carddavClients, carddavUpdate, carddavVcards} from './carddav'
import {fritzBoxHandler} from './fritzbox'
import {snomHandler} from './snom'
import {Promise} from 'es6-promise'
import { setTimeout, setInterval } from 'timers';

/**
 * handles periodic updates
 */
function updateHandler (): Promise<boolean>
{
    return carddavUpdate()
        .then((res) => {
            if (!res) return Promise.resolve(false)
            
            return phoneHandlers()
        })
}

/**
 * handle all destination phone updates
 */
function phoneHandlers (): Promise<boolean>
{
    let vcards = carddavVcards()
    let handlers: Promise<any>[] = []
    if (settings.fritzbox) handlers.push(fritzBoxHandler(vcards))
    if (settings.snom) handlers.push(snomHandler(vcards))

    return Promise.all(handlers).then((res) => Promise.resolve(true))
}

/**
 * create clients
 */

carddavClients()
.then((res) => phoneHandlers())
.then((res) => setInterval(() => updateHandler(), settings.updateInterval * 60 * 1000))
.catch((err) => {
    console.log(err)
})