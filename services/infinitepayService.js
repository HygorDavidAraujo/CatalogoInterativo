const { randomUUID } = require('node:crypto');
const Precos = require('../js/precos');
const { ErroPedido } = require('./pedidoService');
const { itensCheckout } = require('./vendaService');

function configuracao() {
    const handle = (process.env.INFINITEPAY_HANDLE || '').trim().replace(/^\$/, '');
    const apiKey = (process.env.INFINITEPAY_API_KEY || '').trim();
    if (apiKey && (!apiKey.startsWith('inchk_') || /[\s"']/.test(apiKey))) {
        throw new ErroPedido('A chave InfinitePay configurada na Vercel está inválida. Use somente a chave inchk_, sem aspas ou nome do cabeçalho.', 503);
    }
    let base;
    try {
        base = new URL(process.env.APP_URL);
        if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw new Error();
    } catch { throw new ErroPedido('Configure APP_URL com o endereço HTTPS público da loja.', 503); }
    if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(handle)) throw new ErroPedido('Configure a InfiniteTag da loja no servidor.', 503);
    return { handle, apiKey, base: base.origin };
}

async function api(caminho, payload, fetchImpl = fetch) {
    const { apiKey } = configuracao();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
        const response = await fetchImpl(`https://api.checkout.infinitepay.io/${caminho}`, {
            method: 'POST', signal: controller.signal,
            headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'X-Api-Key': apiKey } : {}) },
            body: JSON.stringify(payload)
        });
        const resultado = await response.json().catch(() => null);
        if (!response.ok || resultado?.success === false && caminho === 'links') {
            const descricao = JSON.stringify(resultado || {}).toLowerCase();
            let codigo = 'INFINITEPAY_INDISPONIVEL';
            let mensagem = 'A InfinitePay está indisponível. Tente novamente; a mesma cobrança será reutilizada.';
            let status = 502;
            if (descricao.includes('external_checkout_not_enabled')) {
                codigo = 'INFINITEPAY_CHECKOUT_DESATIVADO'; status = 503;
                mensagem = 'Ative Checkout Integrado na conta InfinitePay da loja e confira se a InfiniteTag e a chave pertencem à mesma conta.';
            } else if ([401,403].includes(response.status)) {
                codigo = 'INFINITEPAY_CREDENCIAL_RECUSADA'; status = 503;
                mensagem = 'A InfinitePay recusou a autenticação. Confira a chave da API, a InfiniteTag e a habilitação do Checkout Integrado na mesma conta.';
            } else if ([400,422].includes(response.status)) {
                codigo = 'INFINITEPAY_DADOS_RECUSADOS'; status = 422;
                mensagem = 'A InfinitePay recusou os dados da cobrança. Confira o e-mail e telefone do cliente e as configurações do checkout da conta.';
            } else if (response.status === 429) {
                codigo = 'INFINITEPAY_LIMITE'; status = 503;
                mensagem = 'A InfinitePay limitou temporariamente as consultas. Aguarde e tente recuperar a mesma cobrança.';
            }
            console.error('[infinitepay]', { operacao: caminho, http_status: response.status, codigo });
            const erro = new ErroPedido(mensagem, status); erro.code = codigo; throw erro;
        }
        if (!resultado || typeof resultado !== 'object') throw new Error('Resposta inválida');
        return resultado;
    } catch (error) {
        if (error instanceof ErroPedido) throw error;
        const codigo = controller.signal.aborted ? 'INFINITEPAY_TIMEOUT' : 'INFINITEPAY_COMUNICACAO';
        const causa = error.cause?.code;
        console.error('[infinitepay]', { operacao: caminho, codigo,
            ...(typeof causa === 'string' && /^[A-Z0-9_]{1,60}$/.test(causa) ? { causa } : {}) });
        // Não incluir respostas do provedor, dados do cliente ou segredos nos logs/erros.
        const erro = new ErroPedido('Não foi possível consultar a InfinitePay. Tente novamente; a cobrança será reutilizada.', 502);
        erro.code = codigo; throw erro;
    } finally { clearTimeout(timer); }
}

function checkoutUrl(valor) {
    try {
        if (typeof valor !== 'string' || !valor.trim()) throw new Error('URL ausente');
        const url = new URL(valor);
        if (url.protocol === 'https:' && ['buy.infinitepay.io', 'checkout.infinitepay.io'].includes(url.hostname) &&
            !url.username && !url.password && (!url.port || url.port === '443')) return url.href;
    } catch {}
    throw new ErroPedido('A InfinitePay não retornou um link de pagamento válido.', 502);
}

function extrairCheckoutUrl(resposta) {
    // O nome da propriedade do link varia entre os formatos de retorno.
    // Validar o endereço independentemente do campo que o transporta.
    const campos = ['checkout_url', 'link', 'url'];
    const candidatos = campos.filter(campo => typeof resposta?.[campo] === 'string' && resposta[campo].trim());
    const validos = [];
    for (const campo of candidatos) {
        try { validos.push(checkoutUrl(resposta[campo])); } catch { /* Outro campo pode conter o link válido. */ }
    }
    const links = [...new Set(validos)];
    if (links.length === 1) return links[0];
    // Diagnóstico estrutural, sem valores de URLs, dados pessoais ou resposta bruta.
    const estrutura = Object.fromEntries(campos.map(campo => [campo, typeof resposta?.[campo]]));
    console.error('[infinitepay]', { operacao: 'links', codigo: 'INFINITEPAY_LINK_INVALIDO', campos: estrutura,
        links_conflitantes: links.length > 1 });
    const erro = new ErroPedido('A InfinitePay não retornou um link de pagamento válido.', 502);
    erro.code = 'INFINITEPAY_LINK_INVALIDO';
    throw erro;
}

async function transacao(pool, executar) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const resultado = await executar(client);
        await client.query('COMMIT');
        return resultado;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
}

async function pedidoBloqueado(client, id) {
    const { rows } = await client.query('SELECT * FROM pedidos WHERE id = $1 FOR UPDATE', [id]);
    if (!rows[0]) throw new ErroPedido('Pedido não encontrado.', 404);
    return rows[0];
}

function valorPedido(pedido) {
    if (pedido.status === 'cancelado' || pedido.status === 'finalizado') throw new ErroPedido('Este pedido não pode receber uma nova cobrança.');
    if (pedido.frete === null || !pedido.entrega_tipo) throw new ErroPedido('Salve a entrega e o frete antes de gerar a cobrança.');
    const total = Precos.paraCentavos(pedido.total);
    if (total < 100) throw new ErroPedido('O valor mínimo para cobrança é R$ 1,00.', 400);
    return total;
}

async function salvarEntrega(pool, id, dados) {
    return transacao(pool, async client => {
        const p = await pedidoBloqueado(client, id);
        const existente = await client.query('SELECT id FROM pagamentos WHERE pedido_id = $1', [id]);
        if (existente.rows.length) throw new ErroPedido('A cobrança já foi iniciada. A entrega e o valor estão bloqueados para evitar divergências.');
        if (['cancelado', 'finalizado'].includes(p.status)) throw new ErroPedido('Este pedido não permite alterações de entrega.');
        const produtos = await client.query('SELECT subtotal FROM pedidos_itens WHERE pedido_id = $1', [id]);
        const subtotal = produtos.rows.reduce((s, i) => s + Precos.paraCentavos(i.subtotal), 0);
        const frete = Precos.paraCentavos(dados.frete);
        if (dados.entrega_tipo === 'retirada' && frete !== 0) throw new ErroPedido('Retirada deve ter frete zero.', 400);
        const desconto = Precos.paraCentavos(p.desconto_manual || 0);
        if (desconto > subtotal) throw new ErroPedido('O desconto está divergente dos itens. Revise o pedido.');
        if (subtotal - desconto + frete > Precos.MAX_CENTAVOS) throw new ErroPedido('Total acima do limite permitido.', 400);
        const { rows } = await client.query(`UPDATE pedidos SET frete = $2, entrega_tipo = $3,
            entrega_detalhes = $4, total = $5 WHERE id = $1 RETURNING *`,
        [id, frete / 100, dados.entrega_tipo, dados.entrega_detalhes, (subtotal - desconto + frete) / 100]);
        return rows[0];
    });
}

async function preparar(pool, pedidoId, metodo, opcoes = {}) {
    const config = configuracao();
    if (metodo === 'checkout' && !config.apiKey) throw new ErroPedido('Configure a chave da API InfinitePay no servidor para emitir links de uso único.', 503);
    return transacao(pool, async client => {
        const p = await pedidoBloqueado(client, pedidoId);
        const valor = valorPedido(p);
        const { rows } = await client.query('SELECT * FROM pagamentos WHERE pedido_id = $1 FOR UPDATE', [pedidoId]);
        if (rows.length) {
            const existente = rows[0];
            if (existente.metodo !== metodo) throw new ErroPedido('Já existe uma cobrança para este pedido. Confira antes de trocar o meio de pagamento.');
            if (existente.status === 'pago') throw new ErroPedido('Este pedido já está pago.');
            if (metodo === 'tap') {
                if (!opcoes.reabrir_sem_pagamento) throw new ErroPedido('Já existe uma tentativa no InfiniteTap. Confira o resultado antes de iniciar outra cobrança.');
                return existente;
            }
            if (new Date(existente.expira_em) <= new Date()) throw new ErroPedido('A cobrança expirou. Confira a situação na InfinitePay antes de emitir outro pedido.');
            if (existente.checkout_url) return existente;
            if (Date.now() - new Date(existente.tentativa_em).getTime() < 30000) throw new ErroPedido('A cobrança está sendo gerada. Aguarde 30 segundos antes de tentar novamente.');
            await client.query('UPDATE pagamentos SET tentativa_em = CURRENT_TIMESTAMP WHERE id = $1', [existente.id]);
            return existente;
        }
        const id = randomUUID();
        const expira = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        let payload;
        if (metodo === 'checkout') {
            const { rows: itens } = await client.query('SELECT * FROM pedidos_itens WHERE pedido_id = $1 ORDER BY id', [pedidoId]);
            const { rows: usuarios } = await client.query('SELECT nome_completo, email, telefone FROM usuarios WHERE id = $1', [p.usuario_id]);
            const u = usuarios[0];
            const telefone = String(u.telefone || '').replace(/\D/g, '');
            const lista = itensCheckout(itens, p.desconto_manual || 0);
            if (Precos.paraCentavos(p.frete)) lista.push({ description: 'Frete / entrega', quantity: 1, price: Precos.paraCentavos(p.frete) });
            if (lista.reduce((s, i) => s + i.quantity * i.price, 0) !== valor) throw new ErroPedido('Os itens e o total estão divergentes. Revise o pedido.');
            payload = { handle: config.handle, order_nsu: id, items: lista,
                customer: { name: u.nome_completo, email: u.email,
                    ...(/^\d{10,11}$/.test(telefone) ? { phone_number: `+55${telefone}` } : {}) },
                redirect_url: `${config.base}/pagamento-retorno.html?pagamento=${id}`,
                webhook_url: `${config.base}/api/pagamentos/webhook/${id}`,
                // Não sobrescrever regras de repasse/parcelamento e descontos por método da conta.
                options: { single_payment: true, valid_until: expira, payment_methods_enabled: ['credit_card', 'pix'] } };
        } else {
            if (p.origem !== 'presencial') throw new ErroPedido('Use o InfiniteTap em uma venda rápida presencial.');
            const parcelas = opcoes.payment_method === 'debit' ? 1 : opcoes.installments;
            if (Math.floor(valor / parcelas) < 100) throw new ErroPedido('Cada parcela deve ter pelo menos R$ 1,00.', 400);
            payload = { handle: config.handle, amount: String(valor), payment_method: opcoes.payment_method,
                installments: String(parcelas), order_id: id,
                result_url: `${config.base}/pagamento-retorno.html?tap=${id}`,
                app_client_referrer: 'DaviniCatalogo' };
        }
        const inserido = await client.query(`INSERT INTO pagamentos
            (id, pedido_id, metodo, status, valor_centavos, payload, expira_em)
            VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [id, pedidoId, metodo, metodo === 'checkout' ? 'gerando' : 'pendente', valor, JSON.stringify(payload), expira]);
        return inserido.rows[0];
    });
}

async function gerarCheckout(pool, pedidoId, fetchImpl) {
    const pagamento = await preparar(pool, pedidoId, 'checkout');
    if (pagamento.checkout_url) return pagamento;
    const resposta = await api('links', pagamento.payload, fetchImpl);
    const url = extrairCheckoutUrl(resposta);
    // Webhook pode ter confirmado enquanto a resposta da emissão estava em trânsito.
    const { rows } = await pool.query(`UPDATE pagamentos SET checkout_url = $2,
        status = CASE WHEN status = 'pago' THEN status ELSE 'pendente' END WHERE id = $1 RETURNING *`, [pagamento.id, url]);
    await pool.query("UPDATE pedidos SET status = 'aguardando_pagamento' WHERE id = $1 AND status = 'pendente'", [pedidoId]);
    return rows[0];
}

async function iniciarTap(pool, pedidoId, dados) {
    const p = await preparar(pool, pedidoId, 'tap', dados);
    await pool.query("UPDATE pedidos SET status = 'aguardando_pagamento' WHERE id = $1 AND status = 'pendente'", [pedidoId]);
    return { pagamento_id: p.id, url: `infinitepaydash://infinitetap-app?${new URLSearchParams(p.payload)}` };
}

async function confirmar(pool, id, dados, fetchImpl) {
    const { rows } = await pool.query('SELECT * FROM pagamentos WHERE id = $1', [id]);
    const p = rows[0];
    if (!p || p.metodo !== 'checkout') throw new ErroPedido('Cobrança não encontrada.', 404);
    if (dados.order_nsu !== p.id || (p.slug && p.slug !== dados.slug) ||
        (p.transaction_nsu && p.transaction_nsu !== dados.transaction_nsu)) throw new ErroPedido('Referência de pagamento inválida.', 400);
    // Não confiar em parâmetros de retorno nem no webhook sem assinatura.
    const resultado = await api('payment_check', { handle: p.payload.handle, order_nsu: p.id,
        transaction_nsu: dados.transaction_nsu, slug: dados.slug }, fetchImpl);
    if (resultado.success !== true || resultado.paid !== true) return { pago: false };
    if (!Number.isSafeInteger(resultado.amount) || resultado.amount !== Number(p.valor_centavos)) throw new ErroPedido('O valor confirmado diverge do pedido. Confira na InfinitePay.');
    return registrarPago(pool, p, dados.transaction_nsu, dados.slug, 'api');
}

async function registrarPago(pool, pagamento, nsu, slug, tipo, adminId = null) {
    return transacao(pool, async client => {
        const pedido = await pedidoBloqueado(client, pagamento.pedido_id);
        if (tipo === 'manual_admin' && pedido.status === 'cancelado') throw new ErroPedido('Pedido cancelado: não é permitido confirmar recebimento manualmente.');
        const { rows } = await client.query('SELECT * FROM pagamentos WHERE id = $1 FOR UPDATE', [pagamento.id]);
        const atual = rows[0];
        if (atual.status === 'pago') {
            if (atual.transaction_nsu !== nsu) throw new ErroPedido('Esta cobrança já possui outra transação registrada.');
            return { pago: true, novo: false, pedidoId: pedido.id, cancelado: pedido.status === 'cancelado' };
        }
        await client.query(`UPDATE pagamentos SET status = 'pago', transaction_nsu = $2, slug = $3,
            confirmacao = $4, confirmado_por = $5, pago_em = CURRENT_TIMESTAMP WHERE id = $1`, [pagamento.id, nsu, slug, tipo, adminId]);
        await client.query("UPDATE pedidos SET status = 'confirmado' WHERE id = $1 AND status IN ('pendente','aguardando_pagamento')", [pedido.id]);
        return { pago: true, novo: true, pedidoId: pedido.id, cancelado: pedido.status === 'cancelado' };
    });
}

async function conferirTap(pool, pedidoId, nsu, adminId) {
    const { rows } = await pool.query("SELECT * FROM pagamentos WHERE pedido_id = $1 AND metodo = 'tap'", [pedidoId]);
    if (!rows[0]) throw new ErroPedido('Tentativa InfiniteTap não encontrada.', 404);
    return registrarPago(pool, rows[0], nsu, null, 'manual_admin', adminId);
}

module.exports = { configuracao, checkoutUrl, extrairCheckoutUrl, transacao, pedidoBloqueado, salvarEntrega, gerarCheckout, iniciarTap, confirmar, conferirTap };
