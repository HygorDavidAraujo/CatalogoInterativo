// ===== CONFIGURAÇÃO DA API =====
// Usar configuração centralizada se disponível, senão fallback
const API_URL = window.APP_CONFIG 
    ? `${window.APP_CONFIG.API_URL}/api`
    : (window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api'
        : window.location.origin + '/api');

function resolverUrlImagem(imagem) {
    return window.RenderSeguro.url(imagem);
}

window.resolverUrlImagem = resolverUrlImagem;

// Helper para obter headers com autenticação JWT
function obterHeadersComAutenticacao(headers = {}) {
    const token = window.authManager ? window.authManager.obterToken() : 
                  (sessionStorage.getItem('jwt_token') || localStorage.getItem('jwt_token'));
    
    const headersCompletos = {
        'Content-Type': 'application/json',
        ...headers
    };
    
    if (token) {
        headersCompletos['Authorization'] = `Bearer ${token}`;
    }
    
    return headersCompletos;
}

function isVinhoAtivo(value) {
    return value === null ||
           value === undefined ||
           value === 1 ||
           value === '1' ||
           value === true ||
           value === 'true';
}

function normalizarVinho(vinho) {
    return {
        ...vinho,
        ativo: isVinhoAtivo(vinho.ativo)
    };
}

// ===== GERENCIAMENTO DE DADOS COM API =====
class VinhoManager {
    constructor() {
        this.vinhos = [];
        this.configuracoes = {};
        this.catalogoCarregado = false;
        this.catalogoCarregadoEm = 0;
    }

    async carregarVinhos(admin = false) {
        try {
            const vinhos = [];
            let page = 1;
            let totalPages = 1;

            while (page <= totalPages) {
                const url = new URL(`${API_URL}/vinhos`);
                url.searchParams.set('page', page);
                url.searchParams.set('limit', 100);
                if (admin) url.searchParams.set('admin', 'true');

                const fetchOptions = { cache: 'no-store', ...(admin ? { headers: obterHeadersComAutenticacao() } : {}) };
                const response = await (window.fetchWithTimeout
                    ? window.fetchWithTimeout(url, fetchOptions)
                    : fetch(url, fetchOptions));

                if (!response.ok) throw new Error(`Erro ao carregar vinhos: ${response.status}`);

                const responseData = await response.json();
                const pageVinhos = Array.isArray(responseData)
                    ? responseData
                    : (responseData.data || responseData);

                vinhos.push(...pageVinhos);
                totalPages = responseData.pagination?.totalPages || 1;
                page += 1;
            }
            
            const vinhosNormalizados = vinhos.map(vinho => {
                const normalized = normalizarVinho(vinho);
                if (window.optimizeCloudinaryUrl) {
                    return {
                        ...normalized,
                        imagem: window.optimizeCloudinaryUrl(vinho.imagem, 'card'),
                        imagemOriginal: vinho.imagem
                    };
                }
                return normalized;
            });
            
            this.vinhos = vinhosNormalizados;
            if (!admin) {
                this.catalogoCarregado = true;
                this.catalogoCarregadoEm = Date.now();
            }
            if (!admin) window.carrinhoManager?.atualizarProdutos(this.vinhos);
            return this.vinhos;
        } catch (error) {
            console.error('Erro ao carregar vinhos:', error);
            this.vinhos = [];
            this.catalogoCarregado = false;
            throw error;
        }
    }

    async carregarConfiguracoes() {
        try {
            console.log('Buscando configurações da API...');
            const response = await fetch(`${API_URL}/configuracoes`);
            console.log('Resposta da API:', response.status);
            if (!response.ok) throw new Error('Erro ao carregar configurações');
            this.configuracoes = await response.json();
            console.log('Configurações recebidas da API:', this.configuracoes);
            return this.configuracoes;
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
            return {};
        }
    }

    async salvarConfiguracoes(configuracoes) {
        try {
            const response = await fetch(`${API_URL}/configuracoes`, {
                method: 'POST',
                headers: obterHeadersComAutenticacao(),
                body: JSON.stringify(configuracoes)
            });
            if (!response.ok) throw new Error('Erro ao salvar configurações');
            this.configuracoes = await response.json();
            return this.configuracoes;
        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
            throw error;
        }
    }

    getVinhos(filtro = 'todos') {
        if (filtro === 'todos') {
            return this.vinhos;
        }
        // Se filtro é 'suco_integral', retorna ambos tinto e branco de suco integral
        if (filtro === 'suco_integral') {
            return this.vinhos.filter(vinho => 
                vinho.tipo === 'suco_integral_tinto' || vinho.tipo === 'suco_integral_branco'
            );
        }
        return this.vinhos.filter(vinho => vinho.tipo === filtro);
    }

    getVinhoPorId(id) {
        return this.vinhos.find(vinho => vinho.id == id);
    }
}

// Instância global do gerenciador
const vinhoManager = new VinhoManager();
let versaoRenderCatalogo = 0;
let focoAnteriorFicha = null;
let elementosInertes = [];

function rotuloPerfil(ficha, campo) {
    const opcoes = window.FichaVinho.opcoes[campo];
    return opcoes && Object.hasOwn(opcoes, ficha?.[campo]) ? opcoes[ficha[campo]] : '';
}

function etiquetasPerfil(ficha = {}) {
    const etiquetas = ['docura', 'corpo'].map(campo => rotuloPerfil(ficha, campo)).filter(Boolean);
    return etiquetas.length ? `<ul class="perfil-etiquetas" aria-label="Perfil do vinho">${etiquetas.map(label => `<li>${label}</li>`).join('')}</ul>` : '';
}

function volumeVinho(ficha = {}) {
    return ficha.volume_ml ? `${Number(ficha.volume_ml).toLocaleString('pt-BR')} ml` : '';
}

function normalizarBusca(value) {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function temperaturaVinho(ficha = {}) {
    const min = ficha.temperatura_min;
    const max = ficha.temperatura_max;
    const numero = value => String(Number(value)).replace('.', ',');
    if (min != null && max != null) return min === max ? `${numero(min)} °C` : `${numero(min)}–${numero(max)} °C`;
    if (min != null) return `A partir de ${numero(min)} °C`;
    if (max != null) return `Até ${numero(max)} °C`;
    return '';
}

// ===== RENDERIZAÇÃO DOS VINHOS =====
async function renderizarVinhos(filtro = 'todos', busca = '', ordenacao = 'padrao') {
    const container = document.getElementById('vinhos-container');
    if (!container) return;

    const versao = ++versaoRenderCatalogo;
    if (!vinhoManager.catalogoCarregado) container.innerHTML = `
        <div class="loading-container" role="status" aria-live="polite">
            <div class="loading-spinner"></div>
            <p>Carregando vinhos...</p>
        </div>
    `;

    let vinhos = [];
    try {
        if (!vinhoManager.catalogoCarregado || Date.now() - vinhoManager.catalogoCarregadoEm > 60000) {
            await vinhoManager.carregarVinhos();
        }
        if (versao !== versaoRenderCatalogo) return;
        vinhos = vinhoManager.getVinhos(filtro).filter(v => isVinhoAtivo(v.ativo));

        // Aplicar busca se fornecida
        if (busca) {
            const buscaNormalizada = normalizarBusca(busca);
            vinhos = vinhos.filter(v => [v.nome, v.uva, v.pais_origem, v.ficha_tecnica?.produtor,
                v.ficha_tecnica?.regiao].some(value => normalizarBusca(value).includes(buscaNormalizada)));
        }

        const usuario = window.authManager?.usuarioLogado;
        const vipTipo = usuario?.is_vip ? usuario?.vip_tipo : null;

        if (ordenacao === 'preco_asc' || ordenacao === 'preco_desc') {
            vinhos = vinhos.slice().sort((a, b) => {
                const precoA = calcularPrecoComDesconto(parseFloat(a.preco), vipTipo);
                const precoB = calcularPrecoComDesconto(parseFloat(b.preco), vipTipo);
                return ordenacao === 'preco_asc' ? precoA - precoB : precoB - precoA;
            });
        }

        const resultado = document.getElementById('resultado-catalogo');
        if (resultado) resultado.textContent = `${vinhos.length} ${vinhos.length === 1 ? 'rótulo encontrado' : 'rótulos encontrados'}`;
        const limpar = document.getElementById('limpar-filtros');
        if (limpar) limpar.hidden = filtro === 'todos' && !busca && ordenacao === 'padrao';
        if (vinhos.length === 0) {
            container.innerHTML = `
                <div class="mensagem-vazio" role="status">
                    <i class="fas fa-wine-bottle" aria-hidden="true"></i>
                    <p>Nenhum vinho encontrado nesta categoria.</p>
                </div>
            `;
            return;
        }
    } catch (error) {
        if (versao !== versaoRenderCatalogo) return;
        container.innerHTML = `
            <div class="mensagem-erro" role="alert">
                <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
                <p>Erro ao carregar vinhos. Tente novamente.</p>
                <button class="btn btn-primary" data-repetir-catalogo>
                    <i class="fas fa-redo"></i> Tentar Novamente
                </button>
            </div>
        `;
        container.querySelector('[data-repetir-catalogo]').addEventListener('click', () => {
            renderizarVinhos(filtro, busca, ordenacao);
        });
        return;
    }

    container.innerHTML = vinhos.map(vinhoOriginal => {
        const vinho = window.RenderSeguro.dados(vinhoOriginal);
        const imagemSrc = vinho.imagem || '/images/placeholder-80x80.svg';
        const bandeira = vinho.bandeira_url || (vinho.pais_codigo ? `https://flagcdn.com/w40/${vinho.pais_codigo.toLowerCase()}.png` : '');
        const pais = vinho.pais_origem || '';
        const ficha = vinho.ficha_tecnica || {};
        const complemento = [ficha.produtor, volumeVinho(ficha)].filter(Boolean).join(' · ');
        
        return `
            <div class="vinho-card" data-id="${vinho.id}">
                <div class="vinho-media"><img src="${imagemSrc}"
                     alt="${vinho.nome}" 
                     class="vinho-imagem" 
                     loading="lazy"></div>
                <div class="vinho-info">
                    <span class="vinho-tipo tipo-${vinho.tipo}">${capitalizar(vinho.tipo)}</span>
                    <h3 class="vinho-nome">${vinho.nome}</h3>
                    ${complemento ? `<p class="vinho-complemento">${complemento}</p>` : ''}
                    ${etiquetasPerfil(ficha)}
                    <div class="vinho-metadados"><p class="vinho-uva">${vinho.uva}</p>
                    <p class="vinho-ano">${vinho.ano == null ? 'Sem safra' : `Safra ${vinho.ano}`}</p></div>
                    ${pais ? `<p class="vinho-pais">${bandeira ? `<img src="${bandeira}" alt="Bandeira" width="22" height="14" loading="lazy">` : ''}<span>${pais}</span></p>` : ''}
                    <p class="vinho-preco" data-preco-vinho="${vinho.id}">${renderizarPrecoVinho(vinhoOriginal)}</p>
                    <button type="button" class="btn-detalhes" data-detalhes-vinho="${vinho.id}">Ver detalhes<span class="sr-only"> de ${vinho.nome}</span></button>
                    <button class="btn btn-adicionar-carrinho" data-adicionar-vinho="${vinho.id}">
                        <i class="fas fa-shopping-cart"></i> Adicionar
                    </button>
                </div>
            </div>
        `;
    }).join('');
    window.RenderSeguro.imagens(container);
    container.querySelectorAll('[data-detalhes-vinho]').forEach(button => {
        button.addEventListener('click', event => {
            event.stopPropagation();
            abrirModal(window.RenderSeguro.id(button.dataset.detalhesVinho));
        });
    });
    container.querySelectorAll('[data-adicionar-vinho]').forEach(button => {
        button.addEventListener('click', event => {
            event.stopPropagation();
            const id = window.RenderSeguro.id(button.dataset.adicionarVinho);
            const vinho = id && vinhoManager.getVinhoPorId(id);
            if (vinho) window.carrinhoManager.adicionarItem(vinho);
        });
    });

    // Adicionar event listeners aos cards
    document.querySelectorAll('.vinho-card').forEach(card => {
        card.addEventListener('click', event => {
            if (event.target.closest('button, a')) return;
            const id = parseInt(card.dataset.id);
            abrirModal(id);
        });
    });
}

async function renderizarDestaqueSemana() {
    const container = document.getElementById('destaque-semana');
    if (!container) return;

    try {
        if (!vinhoManager.vinhos.length) {
            await vinhoManager.carregarVinhos();
        }

        await vinhoManager.carregarConfiguracoes();

        const vinhosAtivos = vinhoManager.vinhos.filter(vinho => isVinhoAtivo(vinho.ativo));
        if (!vinhosAtivos.length) {
            container.innerHTML = '';
            return;
        }

        const config = vinhoManager.configuracoes || {};
        let vinho = window.DestaqueVinho
            ? window.DestaqueVinho.selecionar(vinhosAtivos, config)
            : vinhosAtivos[calcularIndiceAleatorioDoDia(vinhosAtivos.length)];
        vinho = window.RenderSeguro.dados(vinho);

        const imagemSrc = vinho.imagem || '/images/placeholder-80x80.svg';
        const ficha = vinho.ficha_tecnica || {};


        container.innerHTML = `
            <div class="destaque-card" data-id="${vinho.id}">
                <div class="destaque-selo">
                    <span>Destaque da Semana</span>
                </div>
                <div class="destaque-media">
                    <img src="${imagemSrc}" alt="${vinho.nome}" loading="lazy">
                </div>
                <div class="destaque-conteudo">
                    <div class="destaque-topo">
                        <span class="destaque-tipo tipo-${vinho.tipo}">${capitalizar(vinho.tipo)}</span>
                    </div>
                    <h3 class="destaque-titulo">${vinho.nome}</h3>
                    ${ficha.produtor || volumeVinho(ficha) ? `<p class="destaque-origem">${[ficha.produtor, volumeVinho(ficha)].filter(Boolean).join(' · ')}</p>` : ''}
                    ${etiquetasPerfil(ficha)}
                    <p class="destaque-descricao">${ficha.resumo || 'Conheça as uvas, a origem e as sugestões de harmonização deste rótulo.'}</p>
                    <div class="destaque-preco" data-preco-vinho="${vinho.id}">${renderizarPrecoVinho(vinho)}</div>
                    <div class="destaque-acoes">
                        <button class="btn btn-adicionar-carrinho" data-destaque-adicionar>
                            <i class="fas fa-shopping-cart"></i> Adicionar
                        </button>
                        <button class="btn btn-outline" data-destaque-detalhes>
                            Ver detalhes
                        </button>
                    </div>
                </div>
            </div>
        `;
        window.RenderSeguro.imagens(container);
        container.querySelector('[data-destaque-adicionar]').addEventListener('click', event => {
            event.stopPropagation();
            const original = vinhoManager.getVinhoPorId(window.RenderSeguro.id(vinho.id));
            if (original) window.carrinhoManager.adicionarItem(original);
        });
        container.querySelector('[data-destaque-detalhes]').addEventListener('click', event => {
            event.stopPropagation();
            abrirModal(window.RenderSeguro.id(vinho.id));
        });

        container.querySelector('.destaque-card')?.addEventListener('click', () => {
            abrirModal(vinho.id);
        });
    } catch (error) {
        console.error('Erro ao renderizar destaque da semana:', error);
        container.innerHTML = '';
    }
}

// ===== MODAL DE DETALHES =====
function abrirModal(id) {
    const original = vinhoManager.getVinhoPorId(id);
    if (!original) return;
    const vinho = window.RenderSeguro.dados(original);
    const ficha = vinho.ficha_tecnica || {};
    const modal = document.getElementById('modal-vinho');
    const modalBody = document.getElementById('modal-body');
    const compra = document.getElementById('ficha-compra');
    const imagem = window.optimizeCloudinaryUrl
        ? window.optimizeCloudinaryUrl(original.imagemOriginal || original.imagem, 'detail')
        : original.imagemOriginal || original.imagem;
    const imagemSrc = window.RenderSeguro.texto(window.RenderSeguro.url(imagem, '/images/placeholder-80x80.svg'));
    const temperatura = temperaturaVinho(ficha);
    const dados = [
        ['Uvas', vinho.uva], ['Produtor', ficha.produtor], ['Origem', [ficha.regiao, vinho.pais_origem].filter(Boolean).join(' · ')],
        ['Safra', vinho.ano == null ? 'Sem safra' : vinho.ano], ['Volume', volumeVinho(ficha)],
        ['Teor alcoólico', ficha.teor_alcoolico != null ? `${String(ficha.teor_alcoolico).replace('.', ',')}% vol.` : ''],
        ['Estilo / doçura', rotuloPerfil(ficha, 'docura')], ['Corpo', rotuloPerfil(ficha, 'corpo')],
        ['Acidez', rotuloPerfil(ficha, 'acidez')], ['Taninos', rotuloPerfil(ficha, 'taninos')],
        ['Serviço', temperatura], ['Potencial de guarda', vinho.guarda]
    ].filter(([, value]) => value !== '' && value != null);
    modalBody.innerHTML = `
        <div class="modal-vinho-detalhes">
            <div class="modal-imagem"><img src="${imagemSrc}" alt="${vinho.nome}"></div>
            <div class="modal-info">
                <span class="vinho-tipo tipo-${vinho.tipo}">${capitalizar(vinho.tipo)}</span>
                <h2 id="titulo-ficha-vinho">${vinho.nome}</h2>
                ${ficha.produtor || volumeVinho(ficha) ? `<p class="vinho-complemento">${[ficha.produtor, volumeVinho(ficha)].filter(Boolean).join(' · ')}</p>` : ''}
                ${etiquetasPerfil(ficha)}
                ${ficha.resumo ? `<p class="ficha-resumo">${ficha.resumo}</p>` : ''}
                ${ficha.aromas ? `<section class="ficha-bloco"><h3>Aromas e sabores</h3><p>${ficha.aromas}</p></section>` : ''}
                ${temperatura ? `<p class="ficha-servico"><i class="fas fa-thermometer-half" aria-hidden="true"></i> Serviço: ${temperatura}</p>` : ''}
                <a class="ficha-atendimento" data-consultar-vinho target="_blank" rel="noopener noreferrer">Tirar uma dúvida sobre este vinho <i class="fab fa-whatsapp" aria-hidden="true"></i></a>
            </div>
        </div>
        ${vinho.harmonizacao ? `<section class="ficha-bloco"><h3>Com o que harmonizar</h3><p>${vinho.harmonizacao}</p></section>` : ''}
        <details class="ficha-detalhe" open><summary>Ficha técnica</summary><dl class="ficha-dados">${dados.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>
            ${ficha.vinificacao ? `<section class="ficha-bloco"><h3>Vinificação</h3><p>${ficha.vinificacao}</p></section>` : ''}
            ${ficha.amadurecimento ? `<section class="ficha-bloco"><h3>Amadurecimento</h3><p>${ficha.amadurecimento}</p></section>` : ''}
            ${ficha.premiacoes ? `<section class="ficha-bloco"><h3>Premiações</h3><p>${ficha.premiacoes}</p></section>` : ''}
            ${ficha.fonte_url ? `<a class="ficha-fonte" href="${ficha.fonte_url}" target="_blank" rel="noopener noreferrer">Consultar a fonte da ficha técnica <i class="fas fa-external-link-alt" aria-hidden="true"></i></a>` : ''}
        </details>
        ${vinho.descricao ? `<details class="ficha-detalhe"><summary>Sobre este vinho</summary><p class="ficha-descricao">${vinho.descricao}</p></details>` : ''}
    `;
    compra.innerHTML = `
        <div class="modal-preco" data-preco-vinho="${vinho.id}" aria-live="polite">${renderizarPrecoVinho(original)}</div>
        <label class="ficha-quantidade" for="quantidade-ficha">Quantidade<input type="number" id="quantidade-ficha" min="1" max="999" step="1" value="1" inputmode="numeric" required></label>
        <button type="button" class="btn-adicionar-carrinho" data-ficha-adicionar><i class="fas fa-shopping-cart" aria-hidden="true"></i> Adicionar ao carrinho</button>
    `;
    compra.hidden = false;
    compra.querySelector('[data-ficha-adicionar]').addEventListener('click', () => {
        const input = document.getElementById('quantidade-ficha');
        if (!input.reportValidity()) return;
        const adicionado = window.carrinhoManager.adicionarItem(original, Number(input.value));
        if (adicionado) { fecharModal(); window.carrinhoManager.abrirCarrinho(); }
    });
    const whatsapp = String(vinhoManager.configuracoes.whatsapp || '5562981831483').replace(/\D/g, '');
    const atendimento = modalBody.querySelector('[data-consultar-vinho]');
    atendimento.href = `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Olá! Gostaria de saber mais sobre ${original.nome}.`)}`;
    window.RenderSeguro.imagens(modalBody);
    if (modal.style.display !== 'block') {
        focoAnteriorFicha = document.activeElement;
        elementosInertes = [...document.querySelectorAll('body > header, body > main, body > footer, #btn-abrir-carrinho')].map(element => [element, element.inert]);
        elementosInertes.forEach(([element]) => { element.inert = true; });
    }
    modal.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-vinho-aberto');
    modal.querySelector('.close')?.focus();
}

function fecharModal() {
    const modal = document.getElementById('modal-vinho');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-vinho-aberto');
    elementosInertes.forEach(([element, inert]) => { element.inert = inert; });
    elementosInertes = [];
    focoAnteriorFicha?.focus?.();
}

// ===== FILTROS =====
function configurarFiltros() {
    const filtros = document.querySelectorAll('[data-filtro]');
    const ordenacoes = document.querySelectorAll('[data-ordenacao]');
    const buscaInput = document.getElementById('busca-catalogo');
    
    let filtroAtual = 'todos';
    let buscaAtual = '';
    let ordenacaoAtual = 'padrao';

    filtros.forEach(btn => {
        btn.addEventListener('click', () => {
            filtros.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
            filtroAtual = btn.dataset.filtro;
            renderizarVinhos(filtroAtual, buscaAtual, ordenacaoAtual);
        });
    });

    const ordenacaoSelect = document.getElementById('ordenacao-catalogo');
    ordenacaoSelect?.addEventListener('change', () => {
        ordenacaoAtual = ordenacaoSelect.value;
        renderizarVinhos(filtroAtual, buscaAtual, ordenacaoAtual);
    });
    document.getElementById('limpar-filtros')?.addEventListener('click', () => {
        filtroAtual = 'todos'; buscaAtual = ''; ordenacaoAtual = 'padrao';
        if (buscaInput) buscaInput.value = '';
        if (ordenacaoSelect) ordenacaoSelect.value = 'padrao';
        filtros.forEach(button => {
            const active = button.dataset.filtro === 'todos';
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        renderizarVinhos();
    });

    ordenacoes.forEach(btn => {
        btn.addEventListener('click', () => {
            ordenacoes.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            ordenacaoAtual = btn.dataset.ordenacao || 'padrao';
            renderizarVinhos(filtroAtual, buscaAtual, ordenacaoAtual);
        });
    });

    if (buscaInput) {
        buscaInput.addEventListener('input', () => {
            buscaAtual = buscaInput.value;
            renderizarVinhos(filtroAtual, buscaAtual, ordenacaoAtual);
        });
    }
}

// ===== NAVEGAÇÃO =====
function configurarNavegacao() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            
            // Só prevenir default para âncoras internas (que começam com #)
            if (href && href.startsWith('#')) {
                // Ignorar '#', pois não referencia um alvo válido
                if (href === '#') {
                    return;
                }
                e.preventDefault();
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            }
            // Links externos (como admin.html) funcionarão normalmente
        });
    });
}

// ===== ATUALIZAR INFORMAÇÕES DE CONTATO =====
async function atualizarInformacoesContato() {
    console.log('=== INICIANDO ATUALIZAÇÃO DE INFORMAÇÕES ===');
    console.log('Carregando configurações para atualizar página...');
    await vinhoManager.carregarConfiguracoes();
    const config = vinhoManager.configuracoes;
    console.log('Configurações carregadas:', config);

    // Atualizar logo se existir
    const logoImg = document.getElementById('logo-img');
    const logoAdminImg = document.getElementById('logo-img-admin');
    
    if (config.logo_url) {
        if (logoImg) {
            logoImg.src = window.RenderSeguro.url(config.logo_url);
            logoImg.style.display = 'block';
            console.log('Logo renderizada no site:', config.logo_url);
        }
        if (logoAdminImg) {
            logoAdminImg.src = window.RenderSeguro.url(config.logo_url);
            logoAdminImg.style.display = 'block';
        }
    }

    // Atualizar informações de contato usando IDs específicos
    const telefoneElement = document.getElementById('contato-telefone');
    const emailElement = document.getElementById('contato-email');
    const enderecoElement = document.getElementById('contato-endereco');

    console.log('Elementos encontrados:', {
        telefone: !!telefoneElement,
        email: !!emailElement,
        endereco: !!enderecoElement
    });

    if (telefoneElement) {
        console.log('Atualizando telefone de:', telefoneElement.textContent, 'para:', config.telefone);
        telefoneElement.textContent = config.telefone || '(54) 99999-9999';
        const numero = telefoneElement.textContent.replace(/\D/g, '');
        telefoneElement.href = `tel:+${numero.length >= 12 && numero.startsWith('55') ? numero : `55${numero}`}`;
    }

    if (emailElement) {
        console.log('Atualizando email de:', emailElement.textContent, 'para:', config.email);
        emailElement.textContent = config.email || 'davinivinhosfinos@gmail.com';
        emailElement.href = `mailto:${encodeURIComponent(emailElement.textContent)}`;
    }

    if (enderecoElement) {
        console.log('Atualizando endereço de:', enderecoElement.textContent, 'para:', config.endereco);
        enderecoElement.textContent = config.endereco || 'Jolimont, RS';
    }

    // Atualizar título e descrição do Hero
    const heroTitle = document.querySelector('.hero-content h2');
    const heroDescription = document.querySelector('.hero-content p');
    
    if (heroTitle && config.titulo) {
        console.log('Atualizando título do hero:', config.titulo);
        heroTitle.textContent = config.titulo;
    }
    
    if (heroDescription && config.descricao) {
        console.log('Atualizando descrição do hero:', config.descricao);
        heroDescription.textContent = config.descricao;
    }

    // Atualizar título da página
    if (config.titulo) {
        console.log('Atualizando título da página:', config.titulo);
        document.title = config.titulo;
    }

    // Atualizar logo/nome do site
    const logoElement = document.querySelector('.logo h1');
    if (logoElement && config.nome_site) {
        console.log('Atualizando nome do site:', config.nome_site);
        logoElement.textContent = config.nome_site;
    }

    // Atualizar links das redes sociais
    const socialLinks = document.querySelectorAll('.social-link');
    console.log('Social links encontrados:', socialLinks.length);
    if (socialLinks[0] && config.instagram) {
        console.log('Atualizando Instagram:', config.instagram);
        socialLinks[0].href = window.RenderSeguro.url(config.instagram, '#');
    }
    if (socialLinks[1] && config.facebook) {
        console.log('Atualizando Facebook:', config.facebook);
        socialLinks[1].href = window.RenderSeguro.url(config.facebook, '#');
    }
    if (socialLinks[2] && config.whatsapp) {
        const whatsappLink = `https://wa.me/${config.whatsapp.replace(/\D/g, '')}`;
        console.log('Atualizando WhatsApp:', whatsappLink);
        socialLinks[2].href = whatsappLink;
    }

    console.log('Informações de contato atualizadas!');
}

// ===== FUNÇÕES UTILITÁRIAS =====
function capitalizar(str) {
    // Tratamento especial para tipos de suco integral
    if (str === 'suco_integral_tinto') return 'Suco Integral - Tinto';
    if (str === 'suco_integral_branco') return 'Suco Integral - Branco';
    
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatarPreco(preco) {
    return parseFloat(preco).toFixed(2).replace('.', ',');
}

function calcularPrecoComDesconto(precoOriginal, vipTipo) {
    return window.vipManager
        ? window.vipManager.calcularDesconto(precoOriginal, vipTipo)
        : window.Precos.paraCentavos(precoOriginal) / 100;
}

function renderizarPrecoVinho(vinho) {
    const usuario = window.authManager?.usuarioLogado;
    const vipTipo = usuario?.is_vip ? usuario.vip_tipo : null;
    const original = window.Precos.paraCentavos(vinho.preco) / 100;
    const final = calcularPrecoComDesconto(vinho.preco, vipTipo);
    const badge = final < original ? (window.vipManager?.getBadgeHtml(vipTipo) || '') : '';
    return (final < original ? '<span class="preco-original" style="text-decoration:line-through">R$ ' + formatarPreco(original) + '</span> ' + badge + ' ' : '') +
        '<span class="preco-final">R$ ' + formatarPreco(final) + '</span>';
}

function atualizarPrecosExibidos() {
    document.querySelectorAll('[data-preco-vinho]').forEach(element => {
        const vinho = vinhoManager.getVinhoPorId(Number(element.dataset.precoVinho));
        if (vinho) element.innerHTML = renderizarPrecoVinho(vinho);
    });
    window.carrinhoManager?.atualizarInterface();
}

function calcularIndiceAleatorioDoDia(total) {
    if (!total) return 0;
    const agora = new Date();
    const inicioAno = new Date(agora.getFullYear(), 0, 1);
    const diasPassados = Math.floor((agora - inicioAno) / 86400000);
    const semana = Math.floor((diasPassados + inicioAno.getDay()) / 7);
    const seed = `${agora.getFullYear()}-S${semana}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31 + seed.charCodeAt(i)) % 2147483647;
    }
    return hash % total;
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async () => {
    // Renderizar vinhos iniciais
    await renderizarVinhos();

    // Renderizar destaque da semana
    await renderizarDestaqueSemana();

    // Atualizar informações de contato
    await atualizarInformacoesContato();

    // Configurar filtros
    configurarFiltros();

    // Configurar navegação
    configurarNavegacao();

    // Configurar modal
    const modal = document.getElementById('modal-vinho');
    const closeBtn = modal?.querySelector('.close');

    if (closeBtn) {
        closeBtn.addEventListener('click', fecharModal);
    }

    if (modal) {
        modal.addEventListener('keydown', event => {
            if (document.getElementById('modal-idade')?.style.display === 'block') return;
            if (event.key === 'Escape') { event.preventDefault(); fecharModal(); }
            if (event.key !== 'Tab') return;
            const focusables = [...modal.querySelectorAll('button, a[href], input, summary')].filter(element => !element.disabled && element.getClientRects().length);
            const first = focusables[0]; const last = focusables[focusables.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        });
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                fecharModal();
            }
        });
    }

    // Scroll suave para seções
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            // Ignorar href '#' (sem alvo)
            if (!href || href === '#') {
                return;
            }
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
});
