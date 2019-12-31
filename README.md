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

## Known issues

There is a serious performance decrease with Snom phones rendering them more or less unusable with XCAP files having duplicate numbers.
The script now ignores duplicate phone numbers and it will mail you a warning about the concerned entries if you configure the mail section.
