// Definições compartilhadas pela API, pelo painel de clientes e pelo perfil.
(function(root, factory) {
    const status = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = status;
    } else {
        root.PedidoStatus = status;
    }
})(typeof window !== 'undefined' ? window : globalThis, function() {
    const opcoes = Object.freeze([
        { valor: 'pendente', label: 'Pendente', classe: 'status-pendente' },
        { valor: 'aguardando_pagamento', label: 'Aguardando Pagamento', classe: 'status-pagamento' },
        { valor: 'confirmado', label: 'Confirmado', classe: 'status-confirmado' },
        { valor: 'em_preparacao', label: 'Em Preparação', classe: 'status-preparacao' },
        { valor: 'em_rota_entrega', label: 'Em Rota de Entrega', classe: 'status-rota' },
        { valor: 'finalizado', label: 'Finalizado', classe: 'status-finalizado' },
        { valor: 'cancelado', label: 'Cancelado', classe: 'status-cancelado' }
    ].map(Object.freeze));
    const valores = Object.freeze(opcoes.map(opcao => opcao.valor));
    const aliases = Object.freeze({
        processando: 'em_preparacao',
        enviado: 'em_rota_entrega',
        entregue: 'finalizado'
    });
    const desconhecido = Object.freeze({ valor: '', label: 'Status não reconhecido', classe: 'status-desconhecido' });

    function normalizar(status) {
        if (typeof status !== 'string') return status;
        const valor = status.trim().toLowerCase();
        return Object.prototype.hasOwnProperty.call(aliases, valor) ? aliases[valor] : valor;
    }

    function obter(status) {
        const valor = normalizar(status);
        return opcoes.find(opcao => opcao.valor === valor) || desconhecido;
    }

    return Object.freeze({ opcoes, valores, aliases, normalizar, obter });
});
