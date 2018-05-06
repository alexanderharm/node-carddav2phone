import {settings} from './utils'
import fs = require('fs-extra')
/**
 * fix dav lib
 */
var davBefore = fs.readFileSync(__dirname + '/../node_modules/dav/dav.js', {encoding: 'utf8'})
var davAfter = davBefore
  .replace(/\{ name: 'displayname', namespace: ns\.DAV \}, /g, '')
  .replace(/res\.props\.displayname/g, '\'card\'')
fs.writeFileSync(__dirname + '/../node_modules/dav/dav.js', davAfter, 'utf8')
var dav = require('dav')
import {Promise} from 'es6-promise'
import {shallowEqual} from 'shallow-equal-object'

//dav.debug.enabled = true

/**
 * vCards
 */
export var vcards: any[] = []

/**
 * CardDAV: create clients and retrieve vCards
 */
export function carddavVcards (): Promise<any[]>
{
    console.log('CardDAV: creating clients')
    let vcardPromises: any[] = []

    for (let account of settings.carddav.accounts)
    {
        let fname = __dirname + '/../account_' + account.url.replace(/^http[s]{0,1}:\/\//, '').replace(/[^\w-]/g, '_') + '_' + account.username + '.json'
        let xhr = new dav.transport.Basic(
            new dav.Credentials({
                username: account.username,
                password: account.password
            })
        )
        
        let client = new dav.Client(xhr)

        // get contacts
        let vcardPromise = Promise.all([
            getVcards(account, client),
            getPrevVcards(fname)
        ])
        .then((res: any) => {

            if (res[0].length === 0) vcards.push(...res[1])
            vcards.push(...res[0])

            // compare current and previous contacts
            if (shallowEqual(res[0], res[1])) return false
            // write output to file
            return fs.writeJson(fname, res[0]) 
            .then(() => true)
        })
        vcardPromises.push(vcardPromise)
    }
    return Promise.all(vcardPromises)
}

function getPrevVcards (accountname: string)
{
    return fs.readJson(accountname)
    .catch((err) => {
        console.log(err)
        return []
    })
}

function getVcards (account: any, client: any)
{
    let vcards: any[] = []
    return client.createAccount({
        accountType: 'carddav',
        server: account.url,
        loadCollections: true,
        loadObjects: true 
    })
    .then((res: any) => {
        // iterate address books
        for (let addressBook of res.addressBooks)
        {
            vcards.push(...addressBook.objects)
        }
        return vcards
    })
    .catch((err: any) => {
        console.log(err)
        return []
    })
}