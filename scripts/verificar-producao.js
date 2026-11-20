// Verificação pública, sem login, gravações no banco ou envio de mensagens.
// Uso: npm run verificar:producao
// Opcional: VALIDACAO_URL=https://seu-dominio.example
const origem = new URL(process.env.VALIDACAO_URL || 'https://catalogointerativo.vercel.app').origin;
const resultados = [];

async function verificar(caminho, esperado, validar) {
    try {
        const resposta = await fetch(origem + caminho, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
        if (resposta.status !== esperado) throw new Error(`HTTP ${resposta.status}; esperado ${esperado}`);
        const corpo = await resposta.text();
        if (validar) validar(corpo, resposta);
        resultados.push({ caminho, ok: true, status: resposta.status });
        console.log(`OK ${caminho} — HTTP ${resposta.status}`);
    } catch (erro) {
        resultados.push({ caminho, ok: false, erro: erro.message });
        console.error(`FALHOU ${caminho} — ${erro.message}`);
    }
}

function exigir(condicao, mensagem) {
    if (!condicao) throw new Error(mensagem);
}

async function main() {
    await verificar('/', 200, (html, resposta) => {
        exigir(html.includes('id="vinhos-container"'), 'Catálogo ausente no HTML');
        exigir(resposta.headers.get('content-security-policy')?.includes("script-src 'self'"), 'Política de scripts ausente');
    });
    await verificar('/admin.html', 200, html => {
        for (const secao of ['pedidos-recebidos', 'catalogo', 'clientes', 'configuracoes']) {
            exigir(html.includes(`data-painel-link="${secao}"`), `Navegação integrada ausente: ${secao}`);
            exigir(html.includes(`id="${secao}"`), `Seção ausente: ${secao}`);
        }
        exigir(html.includes('id="btn-logout"'), 'Botão Sair ausente');
    });
    await verificar('/api/vinhos', 200, corpo => {
        const resposta = JSON.parse(corpo);
        const vinhos = Array.isArray(resposta) ? resposta : resposta.data;
        exigir(Array.isArray(vinhos), 'Formato inesperado na lista de vinhos');
        exigir(vinhos.every(vinho => vinho.ativo !== false && vinho.ativo !== 0), 'Produto oculto exposto no catálogo público');
        exigir(vinhos.every(vinho => Number(vinho.preco) > 0), 'Produto público sem preço válido');
    });
    await verificar('/api/configuracoes', 200, corpo => {
        exigir(JSON.parse(corpo) && !Array.isArray(JSON.parse(corpo)), 'Configurações inválidas');
    });
    await verificar('/api/beneficios', 200, corpo => {
        exigir(Array.isArray(JSON.parse(corpo)), 'Formato inesperado de benefícios');
    });
    for (const caminho of ['/api/auth/me', '/api/auth/usuarios', '/api/pedidos/resumo', '/api/pedidos/recebidos', '/api/vinhos?admin=true']) {
        await verificar(caminho, 401);
    }
    const falhas = resultados.filter(resultado => !resultado.ok);
    console.log(`\n${resultados.length - falhas.length}/${resultados.length} verificações públicas passaram.`);
    console.log('Gravações e fluxos administrativos autenticados exigem verificação separada.');
    if (falhas.length) process.exitCode = 1;
}

main().catch(erro => { console.error(erro.message); process.exitCode = 1; });
