const webpush = require('web-push');

function configuracaoPush(env = process.env) {
    if (!env.WEBPUSH_PUBLIC_KEY || !env.WEBPUSH_PRIVATE_KEY || !env.WEBPUSH_SUBJECT) return null;
    return { publicKey: env.WEBPUSH_PUBLIC_KEY, privateKey: env.WEBPUSH_PRIVATE_KEY, subject: env.WEBPUSH_SUBJECT };
}

function endpointPermitido(endpoint) {
    try {
        const url = new URL(endpoint);
        const host = url.hostname;
        return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
            (host === 'fcm.googleapis.com' || host === 'web.push.apple.com' ||
                host === 'updates.push.services.mozilla.com' || host.endsWith('.push.services.mozilla.com') ||
                host.endsWith('.notify.windows.com'));
    } catch (_) { return false; }
}

async function enviarPushPedido(pool, pedidoId, { env = process.env, enviar = webpush.sendNotification } = {}) {
    const config = configuracaoPush(env);
    if (!config) return { enviados: 0, falhas: 0 };
    try {
        const { rows } = await pool.query(`SELECT i.id, i.endpoint, i.p256dh, i.auth FROM push_inscricoes i
            JOIN usuarios u ON u.id = i.usuario_id AND u.is_admin = TRUE
            JOIN sessoes_usuario s ON s.id = i.sessao_id AND s.expira_em > CURRENT_TIMESTAMP`);
        const payload = JSON.stringify({ titulo: 'Novo pedido recebido',
            corpo: 'Abra o painel para consultar os detalhes.', pedidoId,
            url: `/admin.html?pedido=${pedidoId}#pedidos-recebidos` });
        const resultados = await Promise.allSettled(rows.map(async inscricao => {
            if (!endpointPermitido(inscricao.endpoint)) return false;
            try {
                await enviar({ endpoint: inscricao.endpoint, keys: { p256dh: inscricao.p256dh, auth: inscricao.auth } }, payload,
                    { vapidDetails: config, TTL: 300, timeout: 3000, urgency: 'high', topic: `pedido-${pedidoId}` });
                return true;
            } catch (erro) {
                if ([404, 410].includes(erro.statusCode)) {
                    await pool.query('DELETE FROM push_inscricoes WHERE id = $1 AND endpoint = $2', [inscricao.id, inscricao.endpoint]);
                }
                return false;
            }
        }));
        const enviados = resultados.filter(r => r.status === 'fulfilled' && r.value).length;
        if (enviados < rows.length) console.warn('[push] Alguns dispositivos não receberam o aviso');
        return { enviados, falhas: rows.length - enviados };
    } catch (erro) {
        console.error('[push] Falha ao consultar dispositivos:', erro.code || erro.name);
        return { enviados: 0, falhas: 1 };
    }
}

module.exports = { configuracaoPush, endpointPermitido, enviarPushPedido };
