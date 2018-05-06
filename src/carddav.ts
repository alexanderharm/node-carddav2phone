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
 * The clients
 */
var clients: any[] = []

/**
 * CardDAV: create client accounts
 */
export function carddavClients (): Promise<boolean[]>
{
    console.log('CardDAV: creating clients')
    let createAccounts: any[] = []

    for (let account of settings.carddav.accounts)
    {
        let xhr = new dav.transport.Basic(
            new dav.Credentials({
                username: account.username,
                password: account.password
            })
        )
        
        let client = new dav.Client(xhr)

        // get contacts
        let clientPromise = Promise.all([
            client.createAccount({
                accountType: 'carddav',
                server: account.url,
                loadCollections: true,
                loadObjects: true 
            }),
            fs.readJson(__dirname + '/../account_' + account.url.replace(/^http[s]{0,1}:\/\//, '').replace(/[^\w-]/g, '_') + '.json')
        ])
        .then((res: any) => {

            // store
            clients.push(res[0].addressBooks)

            // compare current and previous contacts
            if (shallowEqual(res[0].addressBooks, res[1]))
            {
                return false
            }
            // write output to file
            return fs.writeJson(__dirname + '/../account_' + account.url.replace(/^http[s]{0,1}:\/\//, '').replace(/[^\w-]/g, '_') + '.json', res[0].addressBooks) 
            .then((res) => true)
        })
        createAccounts.push(clientPromise)
    }
    return Promise.all(createAccounts)
}
  
/**
 * CardDAV: get vCards
 */
export function carddavVcards (): any[]
{
    let vcards = []
    for (let client of clients)
    {
        // iterate address books
        for (let addressBook of client)
        {
            vcards.push(...addressBook.objects)
        }

    }
    return vcards
}