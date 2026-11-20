(function () {
    'use strict';
    const params = new URLSearchParams(window.location.search);
    const mensagem = document.getElementById('pagamento-mensagem');
    const detalhes = document.getElementById('pagamento-detalhes');
    const botao = document.getElementById('pagamento-verificar');
    // Identificadores ficam só na memória desta página e não são enviados a terceiros.
    window.history.replaceState(null, '', window.location.pathname);
    if (params.has('tap')) {
        mensagem.textContent = 'Retorno do InfiniteTap recebido. Confira o resultado no aplicativo InfinitePay.';
        detalhes.textContent = params.has('warning') ? 'O aplicativo retornou um aviso. A venda permanece sem confirmação no catálogo.' : 'A cobrança presencial deve ser conferida pelo administrador no pedido.';
        const nsu = params.get('nsu');
        if (nsu && /^[0-9a-f-]{36}$/i.test(nsu)) detalhes.textContent += ` Identificador para conferência: ${nsu}`;
        const voltar = document.getElementById('pagamento-voltar'); voltar.href = 'admin.html#pedidos-recebidos'; voltar.textContent = 'Voltar ao painel';
        return;
    }
    async function verificar() {
        botao.disabled = true;
        try {
            const dados = Object.fromEntries(['order_nsu', 'transaction_nsu', 'slug'].map(k => [k, params.get(k)]));
            dados.pagamento_id = params.get('pagamento');
            if (!dados.pagamento_id || !dados.transaction_nsu || !dados.slug || !dados.order_nsu) {
                mensagem.textContent = 'Não recebemos todas as referências para consultar este pagamento.';
                detalhes.textContent = 'Confira a situação no histórico de pedidos ou entre em contato com a loja antes de pagar novamente.';
                return;
            }
            const response = await fetch('/api/pagamentos/confirmar', { method: 'POST', cache: 'no-store',
                headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
            if (!response.ok) throw new Error();
            const resultado = await response.json();
            mensagem.textContent = resultado.pago ? 'Pagamento confirmado pela InfinitePay.' : 'O pagamento ainda não foi confirmado.';
            detalhes.textContent = resultado.revisao ? 'O pedido estava cancelado. Entre em contato com a loja para tratar o pagamento.' : 'Acompanhe os próximos passos no histórico de pedidos.';
            botao.hidden = resultado.pago;
        } catch {
            mensagem.textContent = 'Não foi possível confirmar o pagamento agora.';
            detalhes.textContent = 'Você pode consultar novamente ou acompanhar o histórico. Confira antes de realizar outro pagamento.';
            botao.hidden = false;
        } finally { botao.disabled = false; }
    }
    botao.addEventListener('click', verificar);
    verificar();
})();
