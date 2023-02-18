var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { argv } from './index.js';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { DAVClient } from 'tsdav';
import { shallowEqual } from 'shallow-equal-object';
//dav.debug.enabled = true
/**
 * CardDAV: create clients and retrieve vCards
 * @param settings
 */
export function carddavRetrieve(settings) {
    console.log('CardDAV: creating clients');
    // Results
    let carddavResults = [];
    // vCards
    let carddavVcards = [];
    let vcardPromises = Promise.resolve();
    for (let i = 0; i < settings.carddav.accounts.length; i++) {
        let account = settings.carddav.accounts[i];
        const client = new DAVClient({
            serverUrl: account.url,
            credentials: {
                username: account.username,
                password: account.password,
            },
            authMethod: 'Basic',
            defaultAccountType: 'carddav',
        });
        let accountname = account.url.replace(/^http[s]{0,1}:\/\//, '').replace(/[^\w-]/g, '_');
        let username = account.username.replace(/[^\w-]/g, '_');
        let fname = __dirname + '/../account_' + accountname + '_' + username + '.json';
        // get contacts
        let vcardPromise = Promise.all([
            getVcards(account, client),
            getPrevVcards(fname)
        ])
            .then((res) => {
            carddavVcards[i] = [];
            if (res[0].length === 0 && res[1].length === 0) {
                console.log(accountname + ': no vcards');
                carddavResults.push(false);
                return false;
            }
            if (res[0].length === 0) {
                console.log(accountname + ': no vcards downloaded, using stored ones');
                carddavVcards[i].push(...res[1]);
                carddavResults.push(false);
                return false;
            }
            carddavVcards[i].push(...res[0]);
            // compare current and previous contacts
            if (!(argv.f || argv.force)) {
                if (shallowEqual(res[0], res[1])) {
                    console.log(accountname + ': no updates');
                    carddavResults.push(false);
                    return false;
                }
            }
            // write output to file
            console.log(accountname + ': updates available');
            carddavResults.push(true);
            return fs.writeJson(fname, res[0])
                .then(() => true);
        });
        vcardPromises = vcardPromises.then((res) => vcardPromise);
    }
    return vcardPromises.then((res) => [carddavResults, carddavVcards]);
}
function getPrevVcards(accountname) {
    return fs.readJson(accountname)
        .catch((err) => {
        if (err.code !== 'ENOENT')
            console.log(err);
        return [];
    });
}
function getVcards(account, client) {
    return __awaiter(this, void 0, void 0, function* () {
        let vcards = [];
        try {
            yield client.login();
            const addressBooks = yield client.fetchAddressBooks();
            // iterate address books
            for (let addressBook of addressBooks) {
                const objects = yield client.fetchVCards({ addressBook: addressBook });
                for (let object of objects) {
                    vcards.push(object.data);
                }
            }
            return vcards;
        }
        catch (e) {
            console.error(`CardDAV: ${e.message}`);
            return [];
        }
    });
}
