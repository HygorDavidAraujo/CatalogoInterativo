const { Resend } = require('resend');
let nodemailer;
try { nodemailer = require('nodemailer'); } catch { /* SMTP opcional. */ }

function escapeHtml(value = '') {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
}

function getAppUrl(env = process.env) {
    const value = env.APP_URL || (env.VERCEL_PROJECT_PRODUCTION_URL && `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`);
    if (!value && env.NODE_ENV === 'production') throw new Error('APP_URL não configurada');
    const url = new URL(value || `http://localhost:${env.PORT || 3000}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        (env.NODE_ENV === 'production' && (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
        throw new Error('APP_URL deve ser uma URL pública HTTPS em produção');
    }
    return url.origin + url.pathname.replace(/\/$/, '');
}

function createEmailService({ env = process.env, ResendClient = Resend, smtp = nodemailer, logger = console } = {}) {
    let resend;
    async function sendMail(mail) {
        const attempts = [];
        const failure = (provider, error) => {
            attempts.push({ provider, error: error?.message || String(error) });
            // Nunca registrar conteúdo: pode conter links de recuperação e dados pessoais.
            logger.error(`[email] Falha no provedor ${provider}: ${error?.code || error?.name || 'envio recusado'}`);
        };
        if (env.RESEND_API_KEY) {
            try {
                resend ||= new ResendClient(env.RESEND_API_KEY);
                const response = await resend.emails.send({
                    from: env.RESEND_FROM || 'Davini Vinhos <onboarding@resend.dev>',
                    to: Array.isArray(mail.to) ? mail.to : [mail.to],
                    subject: mail.subject, text: mail.text, html: mail.html,
                    ...(mail.replyTo ? { replyTo: mail.replyTo } : {})
                }, { signal: AbortSignal.timeout(5000) });
                if (response.error || !response.data?.id) throw response.error || new Error('Resend não confirmou o envio');
                return { success: true, transporterType: 'resend', info: response.data, attempts };
            } catch (error) { failure('resend', error); }
        }

        const gmail = /@(gmail|googlemail)\.com$/i.test(env.SMTP_USER || '');
        const host = env.SMTP_HOST || (gmail ? 'smtp.gmail.com' : null);
        if (smtp && host && env.SMTP_USER && env.SMTP_PASS) {
            const port = Number(env.SMTP_PORT || (env.SMTP_SECURE === 'true' ? 465 : 587));
            const ports = [port];
            for (let index = 0; index < ports.length; index++) {
                const currentPort = ports[index];
                const provider = `${host === 'smtp.gmail.com' ? 'gmail-smtp' : 'smtp'}:${currentPort}`;
                let transport;
                try {
                    if (!Number.isInteger(currentPort) || currentPort < 1 || currentPort > 65535) throw new Error('SMTP_PORT inválida');
                    transport = smtp.createTransport({
                        host, port: currentPort, secure: currentPort === 465,
                        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
                        requireTLS: currentPort !== 465,
                        connectionTimeout: 3000, greetingTimeout: 3000, socketTimeout: 5000,
                        logger: false, debug: false
                    });
                    let timer;
                    let info;
                    try {
                        info = await Promise.race([
                            transport.sendMail({ ...mail, from: env.SMTP_FROM || env.SMTP_USER }),
                            new Promise((resolve, reject) => {
                                timer = setTimeout(() => reject(Object.assign(new Error('Tempo limite de envio SMTP'),
                                    { code: 'ETIMEDOUT', command: 'SEND' })), 7000);
                            })
                        ]);
                    } finally { clearTimeout(timer); }
                    if (!info.accepted?.length || info.rejected?.length) throw new Error('SMTP recusou destinatários');
                    return { success: true, transporterType: provider, info, attempts };
                } catch (error) {
                    failure(provider, error);
                    // Outra porta somente antes de transmitir a mensagem, evitando duplicatas.
                    if (index === 0 && host === 'smtp.gmail.com' && currentPort === 587 &&
                        error.code === 'ETIMEDOUT' && error.command === 'CONN') ports.push(465);
                } finally { transport?.close?.(); }
            }
        }
        const error = new Error(attempts.length ? 'Todos os provedores de e-mail falharam' : 'Nenhum provedor de e-mail configurado');
        if (!attempts.length) failure('none', error);
        return { success: false, transporterType: attempts.at(-1).provider, error, attempts };
    }
    return { sendMail };
}

module.exports = { ...createEmailService(), createEmailService, escapeHtml, getAppUrl };
