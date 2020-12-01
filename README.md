# node-carddav2phone

A CardDAV to IP phones converter primarily intended for AVM Fritz!Box & Snom IP phones (via XCAP). It currently supports

* Source:

    * Any CardDAV server (tested with iCloud and Nextcloud)

* Destinations:

    * Snom phones via XCAP (limits apply)
    * Yealink phones via IPPhoneDirectory
    * AVM Fritz!Box (tested with 7360, 7490)
    * LDAP (tested with OpenDirectory)
    * in principle it can easily be extended to serve other vendors.

Refer to `settings.example.json` for all configuration options.

***Breaking Changes in v2.x: CardDAV settings are now configured per Destination to allow for different CardDAV accounts per device/phonebook***

## AVM Fritz!Box

You can setup the Fritz!Box specific settings for VIP, quickdial and vanity in the notes of a vcard:

* for VIP (important) mode add the string: `FB_VIP`
* for quickdial add: `FB_QUICKDIAL NN (<telephone number>)` whereby `NN` are two digits (quickdial `**7NN`), the telephone number can only contain digits (`[0-9]`), the plus-symbol (`[+]`) and whitespace, it must be enclosed in parenthesis
* for vanity add: `FB_VANITY ABCDEFG (<telephone number>)` wherby `ABCDEFG` can consist of 2 to 8 letters (`[A-Za-z]{2,8}`)

## snom

### XCAP

Setting up XCAP is more difficult than needed. So here are some guidelines:

- you need a webserver and this script installed on the same machine
- make sure you can access the webserver via http/https from you phone's network
- adapt the `settings.json` to your needs, pay attention to

    - `webroot`: on Linux this typically is `/var/www/` (but can differ in your setup)
    - `dir`: just a subdir/folder in which snom expects the XCAP-files
    - `filename`: some arbitrary name for the XCAP-files
    - `sipAccounts`: these are the accounts (user names) of the SIP-accounts configured in your snom phone, I guess setting one per device is sufficient

- once you finished setting up this script run the script once, you should now find the following folder structure in your webroot: `/<webroot>/<dir>/<sipAccount>/filename`
- now go to the WebGUI of your snom phone:

    - open the `identity`-setup of the `sipAccount` earlier
    - open the `SIP`-tab and set the `Supported server type` to `bria`
    - save
    - now go to `Status > Settings` and download the `settings.cfg` (first option)
    - edit the file and adjust/add the following entries (refer to the settings you made earlier) then save and upload the file back into your snom phone via `Setup > Advanced > Update`

```
xcap_tbook_sync_interval!: 3600
xcap_server_name!: <fqdn or IP address of your webserver>
xcap_server_port!: <port of your server, e. g. 80 or 443>
xcap_directory_auid!: <dir (as set in settings.json)>
xcap_dir_doc_name!: <filename (as set in settings.json)>
xcap_via_tls!: <on|off depending on whether you HTTPS or not>
```


- the snom phone should now synchronise the contacts
- setup a cron job to run the script on a regular basis in order to keep your contacts updated
    
## Known issues

There is a serious performance decrease with Snom phones rendering them more or less unusable with XCAP files having duplicate numbers.
The script now ignores duplicate phone numbers and it will mail you a warning about the concerned entries if you configure the mail section.
