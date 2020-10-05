"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMail = void 0;
var utils_1 = require("./utils");
var nodemailer = require('nodemailer');
function sendMail(subject, msg) {
    // check if mail is configured
    if (!utils_1.settings.mail)
        return;
    // create reusable transporter object using the default SMTP transport
    var transporter = nodemailer.createTransport({
        host: utils_1.settings.mail.server,
        port: utils_1.settings.mail.port,
        secure: utils_1.settings.mail.port === 465 ? true : false,
        auth: {
            user: utils_1.settings.mail.username,
            pass: utils_1.settings.mail.password
        }
    });
    // setup email data with unicode symbols
    var mailOptions = {
        from: utils_1.settings.mail.from,
        to: utils_1.settings.mail.to,
        subject: subject,
        text: msg // plain text body
    };
    // send mail with defined transport object
    transporter.sendMail(mailOptions, function (error, info) {
        if (error)
            return console.log(error);
    });
}
exports.sendMail = sendMail;
