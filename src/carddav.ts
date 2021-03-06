import fs = require('fs-extra')
/**
 * fix dav lib for iCloud
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
        let accountname = account.url.replace(/^http[s]{0,1}:\/\//, '').replace(/[^\w-]/g, '_') 
        let username = account.username.replace(/[^\w-]/g, '_')
        let fname = __dirname + '/../account_' + accountname + '_' + username + '.json'
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
            if (shallowEqual(res[0], res[1])) 
            {
                console.log(accountname + ': no updates')
                carddavResults.push(false)
                return false
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
            for (let object of addressBook.objects)
            {
                vcards.push(object.data.props.addressData)
            }
        }
        return vcards
    })
    .catch((err: any) => {
        console.log(err)
        return []
    })
}