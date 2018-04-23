import {settings} from './utils'
import {Promise} from 'es6-promise'
const nodemailer = require('nodemailer')

export function sendMail (subject: string, msg: string): any
{
    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
        host: settings.mail.server,
        port: settings.mail.port,
        secure: settings.mail.port === 465 ? true : false, // true for 465, false for other ports
        auth: {
            user: settings.mail.username,
            pass: settings.mail.password
        }
    })

    // setup email data with unicode symbols
    let mailOptions = {
        from: settings.mail.from, // sender address
        to: settings.mail.to, // list of receivers
        subject: subject, // Subject line
        text: msg // plain text body
    }

    // send mail with defined transport object
    transporter.sendMail(mailOptions, (error: any, info: any) => {
        if (error) return console.log(error)
    })
}