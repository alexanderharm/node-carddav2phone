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
export function carddavClients (): Promise<boolean>
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
        
        let client = new dav.Client(xhr) // account.url.indexOf('.icloud.com') > -1 ? new davIcloud.Client(xhr) : new dav.Client(xhr)
        let clientPromise = client.createAccount({
            accountType: 'carddav',
            server: account.url,
            loadCollections: true,
            loadObjects: true 
        })
        .then((account: any) => {
            clients.push({
                client: client,
                addressBooks: account.addressBooks
            })
            return Promise.resolve(true)
        })
        createAccounts.push(clientPromise)
    }
    return Promise.all(createAccounts).then((res) => {
            console.log('CardDAV: clients created')
            return Promise.resolve(true)
        })
}
  
// update function
export function carddavUpdate (): Promise<boolean> {

    console.log('CardDAV: updating')
    let updates: Promise<any>[] = []
    let addressDataBefore: any[] = []
    let addressDataAfter: any[] = []

    for (let client of clients)
    {
        // iterate address books
        for (let addressBook of client.addressBooks)
        {
            for (let object of addressBook.objects)
            {
                addressDataBefore.push(object.addressData)
            }

            updates.push(
                client.client
                .syncAddressBook(addressBook)
                .then((res: any) => {
                    return Promise.resolve(true)
                })
                .catch((err: any) => {
                    console.log('CardDAV: updating address book failed')
                    return Promise.resolve(false)
                })
            )
        }

    }

    return Promise
    .all(updates)
    .then((res) => {

        for (let client of clients)
        {
            // iterate address books
            for (let addressBook of client.addressBooks)
            {
                for (let object of addressBook.objects)
                {
                    addressDataAfter.push(object.addressData)
                }
            }

        }
        
        if (shallowEqual(addressDataBefore, addressDataAfter))
        {
            console.log('CardDAV: no updates')
            return Promise.resolve(false)
        }
        console.log('CardDAV: updates available')
        return Promise.resolve(true)
    })
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
        for (let addressBook of client.addressBooks)
        {
            vcards.push(...addressBook.objects)
        }

    }
    return vcards
}