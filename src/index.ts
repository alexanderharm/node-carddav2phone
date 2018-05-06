import {settings} from './utils'
import {carddavVcards, vcards} from './carddav'
import {fritzBoxHandler} from './fritzbox'
import {ldapHandler} from './ldap'
import {snomHandler} from './snom'
import {Promise} from 'es6-promise'
import { setTimeout, setInterval } from 'timers';

/**
 * handle all destination phone updates
 */
function phoneHandlers (): Promise<boolean>
{
    let handlers: Promise<any>[] = []
    if (settings.fritzbox) handlers.push(fritzBoxHandler(vcards))
    if (settings.ldap) handlers.push(ldapHandler(vcards))
    if (settings.snom) handlers.push(snomHandler(vcards))

    return Promise.all(handlers).then((res) => Promise.resolve(true))
}

/**
 * create clients
 */
carddavVcards()
.then((res) => {
    if (res.indexOf(true) > -1)
    {
        console.log('CardDAV: updates available')
        return phoneHandlers()
    }
    console.log('CardDAV: no updates available')
    return true
})
.catch((err) => {
    console.log(err)
})