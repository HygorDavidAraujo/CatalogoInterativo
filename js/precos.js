// Mesma regra no navegador e no servidor. Valores monetários são calculados em centavos.
(function (root, factory) {
    const precos = factory();
    if (typeof module === 'object' && module.exports) module.exports = precos;
    else root.Precos = precos;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';
    const MAX_CENTAVOS = 9999999999; // NUMERIC(10, 2) do PostgreSQL.

    function invalido(code) {
        const error = new RangeError(code);
        error.code = code;
        return error;
    }

    function paraCentavos(value, code = 'PRECO_INVALIDO') {
        if (!['number', 'string'].includes(typeof value)) throw invalido(code);
        const match = String(value).trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
        if (!match) throw invalido(code);
        const centavos = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
        if (!Number.isSafeInteger(centavos) || centavos > MAX_CENTAVOS) throw invalido(code);
        return centavos;
    }

    function validarBeneficio(beneficio) {
        if (!beneficio || !['percentual', 'valor_fixo'].includes(beneficio.tipo_desconto)) {
            throw invalido('BENEFICIO_INVALIDO');
        }
        const valor = paraCentavos(beneficio.valor_desconto, 'BENEFICIO_INVALIDO');
        if (beneficio.tipo_desconto === 'percentual' && valor > 10000) throw invalido('BENEFICIO_INVALIDO');
        return valor;
    }

    function calcularCentavos(preco, beneficio = null) {
        const original = paraCentavos(preco);
        if (!beneficio) return original;
        const desconto = validarBeneficio(beneficio);
        if (beneficio.tipo_desconto === 'valor_fixo') return Math.max(0, original - desconto);
        // Arredonda o preço unitário final ao centavo mais próximo; meio centavo sobe.
        return Math.floor((original * (10000 - desconto) + 5000) / 10000);
    }

    return Object.freeze({ MAX_CENTAVOS, paraCentavos, validarBeneficio, calcularCentavos });
});
