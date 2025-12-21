// ===== CONFIGURAÇÃO DA API =====
// Usar configuração centralizada se disponível, senão fallback
const API_URL = window.APP_CONFIG 
    ? `${window.APP_CONFIG.API_URL}/api`
    : (window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api'
        : window.location.origin + '/api');

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

// ===== GERENCIAMENTO DE DADOS COM API =====
class VinhoManager {
    constructor() {
        this.vinhos = [];
        this.configuracoes = {};
    }

    async carregarVinhos(admin = false) {
        try {
            const url = admin ? `${API_URL}/vinhos?admin=true` : `${API_URL}/vinhos`;
            const response = await (window.fetchWithTimeout 
                ? window.fetchWithTimeout(url) 
                : fetch(url));
            
            if (!response.ok) throw new Error(`Erro ao carregar vinhos: ${response.status}`);
            
            const responseData = await response.json();
            
            // Extrair array de vinhos (a API agora retorna {data, pagination})
            let vinhos = Array.isArray(responseData) 
                ? responseData 
                : (responseData.data || responseData);
            
            // Otimizar URLs do Cloudinary
            if (window.optimizeCloudinaryUrl) {
                vinhos = vinhos.map(vinho => ({
                    ...vinho,
                    imagem: window.optimizeCloudinaryUrl(vinho.imagem, 'card'),
                    imagemOriginal: vinho.imagem
                }));
            }
            
            this.vinhos = vinhos;
            return this.vinhos;
        } catch (error) {
            console.error('Erro ao carregar vinhos:', error);
            this.vinhos = [];
            return [];
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

// ===== RENDERIZAÇÃO DOS VINHOS =====
async function renderizarVinhos(filtro = 'todos', busca = '') {
    const container = document.getElementById('vinhos-container');
    if (!container) return;

    // Loading state
    container.innerHTML = `
        <div class="loading-container" role="status" aria-live="polite">
            <div class="loading-spinner"></div>
            <p>Carregando vinhos...</p>
        </div>
    `;

    let vinhos = [];
    try {
        await vinhoManager.carregarVinhos();
        vinhos = vinhoManager.getVinhos(filtro);

        // Aplicar busca se fornecida
        if (busca) {
            const buscaLower = busca.toLowerCase();
            vinhos = vinhos.filter(v => 
                v.nome.toLowerCase().includes(buscaLower) || 
                v.uva.toLowerCase().includes(buscaLower)
            );
        }

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
        container.innerHTML = `
            <div class="mensagem-erro" role="alert">
                <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
                <p>Erro ao carregar vinhos. Tente novamente.</p>
                <button class="btn btn-primary" onclick="renderizarVinhos('${filtro}', '${busca}')">
                    <i class="fas fa-redo"></i> Tentar Novamente
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = vinhos.map(vinho => {
        const imagemSrc = vinho.imagem ? 
            (vinho.imagem.startsWith('http') ? vinho.imagem : `http://localhost:3000${vinho.imagem}`) :
            'https://via.placeholder.com/300x300?text=Vinho';
        
        return `
            <div class="vinho-card" data-id="${vinho.id}">
                <img src="${imagemSrc}" alt="${vinho.nome}" class="vinho-imagem" onerror="this.src='https://via.placeholder.com/300x300?text=Vinho'">
                <div class="vinho-info">
                    <span class="vinho-tipo tipo-${vinho.tipo}">${capitalizar(vinho.tipo)}</span>
                    <h3 class="vinho-nome">${vinho.nome}</h3>
                    <p class="vinho-uva"><i class="fas fa-grape-alt"></i> ${vinho.uva}</p>
                    <p class="vinho-ano"><i class="fas fa-calendar"></i> Safra ${vinho.ano}</p>
                    <p class="vinho-preco">R$ ${formatarPreco(vinho.preco)}</p>
                    <button class="btn btn-adicionar-carrinho" onclick="event.stopPropagation(); window.carrinhoManager.adicionarItem(${JSON.stringify(vinho).replace(/"/g, '&quot;')})">
                        <i class="fas fa-shopping-cart"></i> Adicionar
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Adicionar event listeners aos cards
    document.querySelectorAll('.vinho-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = parseInt(card.dataset.id);
            abrirModal(id);
        });
    });
}

// ===== MODAL DE DETALHES =====
function abrirModal(id) {
    const vinho = vinhoManager.getVinhoPorId(id);
    if (!vinho) return;

    const modal = document.getElementById('modal-vinho');
    const modalBody = document.getElementById('modal-body');

    const imagemSrc = vinho.imagem ? 
        (vinho.imagem.startsWith('http') ? vinho.imagem : `http://localhost:3000${vinho.imagem}`) :
        'https://via.placeholder.com/400x400?text=Vinho';

    modalBody.innerHTML = `
        <div class="modal-vinho-detalhes">
            <div class="modal-imagem">
                <img src="${imagemSrc}" alt="${vinho.nome}" onerror="this.src='https://via.placeholder.com/400x400?text=Vinho'">
            </div>
            <div class="modal-info">
                <span class="vinho-tipo tipo-${vinho.tipo}">${capitalizar(vinho.tipo)}</span>
                <h2>${vinho.nome}</h2>
                <div class="modal-detalhes">
                    <div class="detalhe-item">
                        <span class="detalhe-label"><i class="fas fa-grape-alt"></i> Tipo de Uva:</span>
                        <span class="detalhe-valor">${vinho.uva}</span>
                    </div>
                    <div class="detalhe-item">
                        <span class="detalhe-label"><i class="fas fa-calendar"></i> Ano de Safra:</span>
                        <span class="detalhe-valor">${vinho.ano}</span>
                    </div>
                    ${vinho.guarda ? `
                    <div class="detalhe-item">
                        <span class="detalhe-label"><i class="fas fa-clock"></i> Tempo de Guarda:</span>
                        <span class="detalhe-valor">${vinho.guarda}</span>
                    </div>
                    ` : ''}
                    ${vinho.harmonizacao ? `
                    <div class="detalhe-item">
                        <span class="detalhe-label"><i class="fas fa-utensils"></i> Harmonização:</span>
                        <span class="detalhe-valor">${vinho.harmonizacao}</span>
                    </div>
                    ` : ''}
                    ${vinho.descricao ? `
                    <div class="detalhe-item">
                        <span class="detalhe-label"><i class="fas fa-info-circle"></i> Sobre o Vinho:</span>
                        <span class="detalhe-valor">${vinho.descricao}</span>
                    </div>
                    ` : ''}
                </div>
                <div class="modal-preco">R$ ${formatarPreco(vinho.preco)}</div>
            </div>
        </div>
    `;

    modal.style.display = 'block';
}

function fecharModal() {
    const modal = document.getElementById('modal-vinho');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ===== FILTROS =====
function configurarFiltros() {
    const filtros = document.querySelectorAll('.filtro-btn');
    const buscaInput = document.getElementById('busca-catalogo');
    
    let filtroAtual = 'todos';
    let buscaAtual = '';

    filtros.forEach(btn => {
        btn.addEventListener('click', () => {
            filtros.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filtroAtual = btn.dataset.filtro;
            renderizarVinhos(filtroAtual, buscaAtual);
        });
    });

    if (buscaInput) {
        buscaInput.addEventListener('input', () => {
            buscaAtual = buscaInput.value;
            renderizarVinhos(filtroAtual, buscaAtual);
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
    }

    if (emailElement) {
        console.log('Atualizando email de:', emailElement.textContent, 'para:', config.email);
        emailElement.textContent = config.email || 'contato@davinivinhos.com.br';
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
        socialLinks[0].href = config.instagram;
    }
    if (socialLinks[1] && config.facebook) {
        console.log('Atualizando Facebook:', config.facebook);
        socialLinks[1].href = config.facebook;
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

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async () => {
    // Renderizar vinhos iniciais
    await renderizarVinhos();

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
