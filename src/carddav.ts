import {settings} from './utils'
var dav = require('dav')
var davIcloud = require('../lib/dav_icloud')
import {Promise} from 'es6-promise'

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
        
        let client = account.url.indexOf('.icloud.com') > -1 ? new davIcloud.Client(xhr) : new dav.Client(xhr)
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
    let ctags: string[] = []

    for (let client of clients)
    {
        // iterate address books
        for (let addressBook of client.addressBooks)
        {
            ctags.push(addressBook.ctag)
            updates.push(
                client.client
                .syncAddressBook(addressBook)
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
                if (ctags.indexOf(addressBook.ctag) < 0)
                {
                    console.log('CardDAV: updates available')
                    return Promise.resolve(true)
                }
            }

        }
        console.log('CardDAV: no updates')
        return Promise.resolve(false)
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