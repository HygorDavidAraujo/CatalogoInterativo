(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.DestaqueVinho = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
    const SEMANA_MS = 7 * 86400000;
    function selecionar(vinhos, config = {}, agora = Date.now()) {
        const ativos = vinhos.filter(v => v.ativo == null || [true, 1, '1', 'true'].includes(v.ativo))
            .slice().sort((a, b) => Number(a.id) - Number(b.id));
        if (!ativos.length) return null;
        const fixado = new Date(config.destaque_fixado_em || '').getTime();
        const idade = Number(agora) - fixado;
        if (Number.isFinite(fixado) && idade >= 0 && idade < SEMANA_MS) {
            const escolhido = ativos.find(v => Number(v.id) === Number(config.destaque_vinho_id));
            if (escolhido) return escolhido;
        }
        const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(agora));
        const data = Object.fromEntries(partes.map(p => [p.type, p.value]));
        const semana = Math.floor((Date.UTC(Number(data.year), Number(data.month) - 1, Number(data.day)) - Date.UTC(1970, 0, 5)) / SEMANA_MS);
        return ativos[((semana % ativos.length) + ativos.length) % ativos.length];
    }
    return Object.freeze({ selecionar });
});
