// Vocabulário compartilhado pela API, pelo formulário e pela apresentação.
(function (root, factory) {
    const ficha = factory();
    if (typeof module === 'object' && module.exports) module.exports = ficha;
    else root.FichaVinho = ficha;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    const opcoes = {
        docura: { seco: 'Seco', meio_seco: 'Meio seco', suave: 'Suave', doce: 'Doce', brut_nature: 'Brut nature', extra_brut: 'Extra brut', brut: 'Brut', extra_seco: 'Extra seco', demi_sec: 'Demi-sec' },
        corpo: { leve: 'Leve', medio: 'Corpo médio', encorpado: 'Encorpado' },
        acidez: { baixa: 'Baixa', media: 'Média', alta: 'Alta' },
        taninos: { baixos: 'Baixos', medios: 'Médios', altos: 'Altos' }
    };
    const textos = { produtor: 150, regiao: 150, resumo: 280, aromas: 500, vinificacao: 1500, amadurecimento: 1000, premiacoes: 1000, fonte_url: 500 };
    const numeros = { volume_ml: { min: 1, max: 30000, inteiro: true }, teor_alcoolico: { min: 0, max: 30 }, temperatura_min: { min: 0, max: 30 }, temperatura_max: { min: 0, max: 30 } };
    const campos = [...Object.keys(textos), ...Object.keys(numeros), ...Object.keys(opcoes)];
    return { opcoes, textos, numeros, campos };
});
