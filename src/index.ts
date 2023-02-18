import {settings} from './utils.js'
import {carddavRetrieve} from './carddav.js'
import {fritzBoxHandler} from './fritzbox.js'
import {ldapHandler} from './ldap.js'
import {pascomHandler} from './pascom.js'
import {snomHandler} from './snom.js'
import {yealinkHandler} from './yealink.js'
//import {Promise} from 'es6-promise'
import minimist from 'minimist'
export const argv = minimist(process.argv.slice(2))

/**
 * handle all destination phone updates
 * @param accountsVcards
 * @param settings
 */
function phoneHandlers (accountsVcards: any, settings: any): Promise<boolean>
{
    let handlers: any = []
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