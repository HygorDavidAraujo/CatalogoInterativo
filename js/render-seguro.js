// Dados da API e do armazenamento local nunca devem virar HTML ou código executável.
(function (root, factory) {
    const helpers = factory();
    if (typeof module === 'object' && module.exports) module.exports = helpers;
    else root.RenderSeguro = helpers;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    function texto(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
    }

    function url(value, fallback = '') {
        if (typeof value !== 'string' || !value.trim()) return fallback;
        try {
            const base = typeof window !== 'undefined' ? window.location.origin : 'https://catalogo.invalid';
            const parsed = new URL(value, base);
            if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return fallback;
            return parsed.href;
        } catch (_) {
            return fallback;
        }
    }

    function cor(value) {
        return typeof value === 'string' && /^#[a-f\d]{6}$/i.test(value) ? value : '#6B1C40';
    }

    // Cópia para interpolação em texto/atributos HTML entre aspas, sem alterar o modelo.
    // Não usar em JavaScript, CSS livre, URLs não validadas ou em atributos de evento.
    function dados(value) {
        if (Array.isArray(value)) return value.map(dados);
        if (value && typeof value === 'object') {
            return Object.fromEntries(Object.entries(value).map(([key, item]) => {
                if (['imagem', 'imagemOriginal', 'imagemUrl', 'bandeira_url', 'logo_url', 'fonte_url'].includes(key)) {
                    return [key, texto(url(item))];
                }
                if (key === 'cor') return [key, cor(item)];
                return [key, dados(item)];
            }));
        }
        return typeof value === 'string' ? texto(value) : value;
    }

    function id(value) {
        const number = Number(value);
        return Number.isInteger(number) && number > 0 && number <= 2147483647 ? number : null;
    }

    function imagens(root) {
        root.querySelectorAll('img').forEach(img => {
            img.addEventListener('error', () => {
                const fallback = new URL('/images/placeholder-80x80.svg', window.location.origin).href;
                if (img.src !== fallback) img.src = fallback;
            }, { once: true });
        });
    }

    return Object.freeze({ texto, url, cor, dados, id, imagens });
});
