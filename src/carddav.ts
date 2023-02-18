import { argv } from './index.js'
import fs from 'fs-extra'
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { DAVClient } from 'tsdav'
import {shallowEqual} from 'shallow-equal-object'

//dav.debug.enabled = true

/**
 * CardDAV: create clients and retrieve vCards
 * @param settings
 */
export function carddavRetrieve (settings:any): Promise<any[]>
{
    console.log('CardDAV: creating clients')

    // Results
    let carddavResults: boolean[] = []

    // vCards
    let carddavVcards: any[] = []

    let vcardPromises: Promise<any> = Promise.resolve()

    for (let i = 0; i < settings.carddav.accounts.length; i++)
    {
        let account = settings.carddav.accounts[i]
        const client = new DAVClient({
            serverUrl: account.url,
            credentials: {
                username: account.username,
                password: account.password,
              },
              authMethod: 'Basic',
              defaultAccountType: 'carddav',
        })
        let accountname = account.url.replace(/^http[s]{0,1}:\/\//, '').replace(/[^\w-]/g, '_') 
        let username = account.username.replace(/[^\w-]/g, '_')
        let fname = __dirname + '/../account_' + accountname + '_' + username + '.json'

        // get contacts
        let vcardPromise = Promise.all([
            getVcards(account, client),
            getPrevVcards(fname)
        ])
        .then((res: any) => {

            carddavVcards[i] = []

            if (res[0].length === 0 && res[1].length === 0)
            {
                console.log(accountname + ': no vcards')
                carddavResults.push(false)
                return false
            }
            if (res[0].length === 0) {
                console.log(accountname + ': no vcards downloaded, using stored ones')
                carddavVcards[i].push(...res[1])
                carddavResults.push(false)
                return false
            }
            
            carddavVcards[i].push(...res[0])

            // compare current and previous contacts
            if (!(argv.f || argv.force))
            {
                if (shallowEqual(res[0], res[1])) 
                {
                    console.log(accountname + ': no updates')
                    carddavResults.push(false)
                    return false
                }
            }
            
            // write output to file
            console.log(accountname + ': updates available')
            carddavResults.push(true)
            return fs.writeJson(fname, res[0]) 
            .then(() => true)
        })
        vcardPromises = vcardPromises.then((res) => vcardPromise)
    }
    return vcardPromises.then((res) => [carddavResults, carddavVcards])
}

function getPrevVcards (accountname: string)
{
    return fs.readJson(accountname)
    .catch((err) => {
        if (err.code !== 'ENOENT') console.log(err)
        return []
    })
}

async function getVcards (account: any, client: any)
{
    let vcards: any[] = []

    try
    {
        await client.login()
        const addressBooks = await client.fetchAddressBooks()
    
        // iterate address books
        for (let addressBook of addressBooks)
        {
            const objects = await client.fetchVCards({addressBook: addressBook})
            for (let object of objects)
            {
                vcards.push(object.data)
            }
        }
        return vcards
    }
    catch (e: any)
    {
        console.error(`CardDAV: ${e.message}`)
        return []
    }

}