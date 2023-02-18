import { settings } from './utils.js';
//import {Promise} from 'es6-promise'
import nodemailer from 'nodemailer';
export function sendMail(subject, msg) {
    // check if mail is configured
    if (!settings.mail)
        return;
    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
        host: settings.mail.server,
        port: settings.mail.port,
        secure: settings.mail.port === 465 ? true : false,
        auth: {
            user: settings.mail.username,
            pass: settings.mail.password
        }
    });
    // setup email data with unicode symbols
    let mailOptions = {
        from: settings.mail.from,
        to: settings.mail.to,
        subject: subject,
        text: msg // plain text body
    };
    // send mail with defined transport object
    transporter.sendMail(mailOptions, (error, info) => {
        if (error)
            return console.log(error);
    });
}
