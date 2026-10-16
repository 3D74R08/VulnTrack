const nodemailer = require('nodemailer');

// Create a transporter using SMTP
// Using a generic transport or Mailtrap for MVP/Development
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
    port: process.env.SMTP_PORT || 2525,
    auth: {
        user: process.env.SMTP_USER || 'usuario_smtp',
        pass: process.env.SMTP_PASS || 'password_smtp'
    }
});

const enviarCorreo = async (destinatario, asunto, cuerpoHtml) => {
    try {
        const mailOptions = {
            from: process.env.SMTP_FROM || '"VulnTrack No-Reply" <noreply@vulntrack.local>',
            to: destinatario,
            subject: asunto,
            html: cuerpoHtml,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[EMAIL ENVIADO] ${info.messageId} a ${destinatario}`);
        return { ok: true, messageId: info.messageId };
    } catch (error) {
        console.error('[ERROR EMAIL]:', error.message);
        return { ok: false, error: error.message };
    }
};

module.exports = { enviarCorreo };
