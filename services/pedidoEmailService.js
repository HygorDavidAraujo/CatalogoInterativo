const { sendMail, escapeHtml, getAppUrl } = require('./emailService');
const PedidoStatus = require('../js/pedido-status');

const moeda = valor => Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function notificarPedido(pool, pedidoId, { novo = false, status } = {}) {
    try {
        const { rows } = await pool.query(`
            SELECT p.*, u.nome_completo, u.email, u.telefone
            FROM pedidos p JOIN usuarios u ON u.id = p.usuario_id WHERE p.id = $1`, [pedidoId]);
        const pedido = rows[0];
        if (!pedido) throw new Error('Pedido não encontrado para notificação');
        const { rows: itens } = await pool.query('SELECT * FROM pedidos_itens WHERE pedido_id = $1 ORDER BY id', [pedidoId]);
        // Usa o status deste evento, mesmo se outra atualização já ocorreu.
        const label = PedidoStatus.obter(status || pedido.status).label;
        const link = `${getAppUrl()}/meu-perfil.html`;
        const resumo = itens.map(item => `${item.quantidade} x ${item.vinho_nome}: ${moeda(item.subtotal)}`).join('\n');
        const corpo = `Pedido #${pedido.id}\nStatus: ${label}\n\n${resumo}\n\nTotal: ${moeda(pedido.total)}${pedido.observacoes ? `\nObservações: ${pedido.observacoes}` : ''}`;
        const mensagem = {
            to: pedido.email,
            subject: novo ? `Recebemos seu pedido #${pedido.id} - Davini Vinhos` : `Pedido #${pedido.id}: ${label} - Davini Vinhos`,
            text: `Olá ${pedido.nome_completo || ''},\n\n${corpo}\n\nAcompanhe seu pedido: ${link}`,
            html: `<p>Olá ${escapeHtml(pedido.nome_completo)},</p><pre style="white-space:pre-wrap;font-family:Arial,sans-serif">${escapeHtml(corpo)}</pre><p><a href="${escapeHtml(link)}">Acompanhar meu pedido</a></p>`
        };
        const mensagens = [mensagem];
        if (novo) {
            // Cada destinatário recebe mensagem separada, sem expor outros endereços.
            let destinatarios = (process.env.ORDER_NOTIFICATION_EMAIL || '').split(',').map(email => email.trim()).filter(Boolean);
            try {
                if (!destinatarios.length) {
                    const { rows: configs } = await pool.query('SELECT email FROM configuracoes LIMIT 1');
                    if (configs[0]?.email?.trim()) destinatarios = [configs[0].email.trim()];
                }
                if (!destinatarios.length) {
                    const { rows: admins } = await pool.query('SELECT email FROM usuarios WHERE is_admin = TRUE');
                    destinatarios = admins.map(admin => admin.email).filter(Boolean);
                }
            } catch {
                console.error(`[email] Pedido #${pedidoId}: falha ao consultar destinatários da loja`);
            }
            if (!destinatarios.length) console.error(`[email] Pedido #${pedidoId}: destinatário da loja não configurado`);
            for (const to of new Set(destinatarios)) {
                mensagens.push({
                    to, replyTo: pedido.email,
                    subject: `Novo pedido #${pedido.id} - Davini Vinhos`,
                    text: `Novo pedido de ${pedido.nome_completo}\nE-mail: ${pedido.email}\nTelefone: ${pedido.telefone || ''}\n\n${corpo}`,
                    html: `<p>Novo pedido de ${escapeHtml(pedido.nome_completo)}</p><p>E-mail: ${escapeHtml(pedido.email)}<br>Telefone: ${escapeHtml(pedido.telefone)}</p><pre style="white-space:pre-wrap;font-family:Arial,sans-serif">${escapeHtml(corpo)}</pre>`
                });
            }
        }
        const resultados = await Promise.all(mensagens.map(mensagem => sendMail(mensagem)));
        if (resultados.some(result => !result.success)) console.error(`[email] Pedido #${pedidoId}: notificação não aceita pelo provedor`);
        return resultados;
    } catch (error) {
        // O pedido já foi confirmado no banco. Erro de e-mail não deve incentivar uma compra duplicada.
        console.error(`[email] Pedido #${pedidoId}: falha ao preparar notificações (${error.code || error.name})`);
        return [];
    }
}

module.exports = { notificarPedido };
