import {settings} from './utils'
import {carddavRetrieve} from './carddav'
import {fritzBoxHandler} from './fritzbox'
import {ldapHandler} from './ldap'
import {pascomHandler} from './pascom'
import {snomHandler} from './snom'
import {yealinkHandler} from './yealink'
import {Promise} from 'es6-promise'
export const argv = require('minimist')(process.argv.slice(2))

/**
 * handle all destination phone updates
 * @param accountsVcards
 * @param settings
 */
function phoneHandlers (accountsVcards: any, settings: any): Promise<boolean>
{
    let handlers: Promise<any>[] = []
    if (settings.fritzbox) handlers.push(fritzBoxHandler(accountsVcards, settings.fritzbox))
    if (settings.ldap) handlers.push(ldapHandler(accountsVcards, settings.ldap))
    if (settings.pascom) handlers.push(pascomHandler(accountsVcards, settings.pascom))
    if (settings.snom) handlers.push(snomHandler(accountsVcards, settings.snom))
    if (settings.yealink) handlers.push(yealinkHandler(accountsVcards, settings.yealink))

    return Promise.all(handlers).then((res) => Promise.resolve(true))
}

/**
 * create clients
 */
carddavRetrieve(settings)
.then((res) => {
    if (res[0].indexOf(true) > -1)
    {
        console.log('CardDAV: updates available')
        return phoneHandlers(res[1], settings)
    }
    console.log('CardDAV: no updates available')
    return true
})
.catch((err) => {
    console.log(err)
})