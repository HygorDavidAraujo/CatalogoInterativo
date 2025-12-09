// ===== GERENCIAMENTO DE DADOS =====
class VinhoManager {
    constructor() {
        this.vinhos = this.carregarVinhos();
    }

    carregarVinhos() {
        const vinhos = localStorage.getItem('vinhos');
        return vinhos ? JSON.parse(vinhos) : this.getDadosIniciais();
    }

    salvarVinhos() {
        localStorage.setItem('vinhos', JSON.stringify(this.vinhos));
    }

    getDadosIniciais() {
        return [
            {
                id: 1,
                nome: 'Château Margaux',
                tipo: 'tinto',
                uva: 'Cabernet Sauvignon',
                ano: 2015,
                guarda: '10 a 20 anos',
                harmonizacao: 'Carnes vermelhas, cordeiro, queijos maturados',
                descricao: 'Um vinho elegante e complexo, com notas de frutas negras, especiarias e taninos sedosos.',
                preco: 450.00,
                imagem: 'https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=500'
            },
            {
                id: 2,
                nome: 'Domaine Leflaive',
                tipo: 'branco',
                uva: 'Chardonnay',
                ano: 2018,
                guarda: '5 a 10 anos',
                harmonizacao: 'Peixes, frutos do mar, aves',
                descricao: 'Vinho branco refinado com aromas cítricos, notas minerais e final persistente.',
                preco: 320.00,
                imagem: 'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?w=500'
            },
            {
                id: 3,
                nome: 'Château d\'Esclans',
                tipo: 'rose',
                uva: 'Grenache',
                ano: 2020,
                guarda: '2 a 5 anos',
                harmonizacao: 'Saladas, pratos leves, queijos suaves',
                descricao: 'Rosé delicado com aromas florais, frutas vermelhas frescas e excelente acidez.',
                preco: 180.00,
                imagem: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=500'
            }
        ];
    }

    getVinhos(filtro = 'todos') {
        if (filtro === 'todos') {
            return this.vinhos;
        }
        return this.vinhos.filter(vinho => vinho.tipo === filtro);
    }

    getVinhoPorId(id) {
        return this.vinhos.find(vinho => vinho.id === id);
    }

    adicionarVinho(vinho) {
        const novoId = this.vinhos.length > 0 
            ? Math.max(...this.vinhos.map(v => v.id)) + 1 
            : 1;
        const novoVinho = { ...vinho, id: novoId };
        this.vinhos.push(novoVinho);
        this.salvarVinhos();
        return novoVinho;
    }

    atualizarVinho(id, dadosAtualizados) {
        const index = this.vinhos.findIndex(vinho => vinho.id === id);
        if (index !== -1) {
            this.vinhos[index] = { ...this.vinhos[index], ...dadosAtualizados };
            this.salvarVinhos();
            return this.vinhos[index];
        }
        return null;
    }

    excluirVinho(id) {
        const index = this.vinhos.findIndex(vinho => vinho.id === id);
        if (index !== -1) {
            this.vinhos.splice(index, 1);
            this.salvarVinhos();
            return true;
        }
        return false;
    }
}

// Instância global do gerenciador
const vinhoManager = new VinhoManager();

// ===== RENDERIZAÇÃO DO CATÁLOGO =====
function renderizarVinhos(filtro = 'todos') {
    const container = document.getElementById('vinhos-container');
    if (!container) return;

    const vinhos = vinhoManager.getVinhos(filtro);

    if (vinhos.length === 0) {
        container.innerHTML = `
            <div class="mensagem-vazio">
                <i class="fas fa-wine-bottle"></i>
                <p>Nenhum vinho encontrado nesta categoria.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = vinhos.map(vinho => `
        <div class="vinho-card" data-id="${vinho.id}">
            <img src="${vinho.imagem}" alt="${vinho.nome}" class="vinho-imagem" onerror="this.src='https://via.placeholder.com/300x300?text=Vinho'">
            <div class="vinho-info">
                <span class="vinho-tipo tipo-${vinho.tipo}">${capitalizar(vinho.tipo)}</span>
                <h3 class="vinho-nome">${vinho.nome}</h3>
                <p class="vinho-uva"><i class="fas fa-grape-alt"></i> ${vinho.uva}</p>
                <p class="vinho-ano"><i class="fas fa-calendar"></i> Safra ${vinho.ano}</p>
                <p class="vinho-preco">R$ ${formatarPreco(vinho.preco)}</p>
            </div>
        </div>
    `).join('');

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

    modalBody.innerHTML = `
        <div class="modal-vinho-detalhes">
            <div class="modal-imagem">
                <img src="${vinho.imagem}" alt="${vinho.nome}" onerror="this.src='https://via.placeholder.com/400x400?text=Vinho'">
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
    filtros.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remover classe active de todos
            filtros.forEach(b => b.classList.remove('active'));
            // Adicionar ao clicado
            btn.classList.add('active');
            // Renderizar vinhos filtrados
            const filtro = btn.dataset.filtro;
            renderizarVinhos(filtro);
        });
    });
}

// ===== NAVEGAÇÃO =====
function configurarNavegacao() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            const target = link.getAttribute('href');
            if (target) {
                document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}

// ===== FUNÇÕES UTILITÁRIAS =====
function capitalizar(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatarPreco(preco) {
    return parseFloat(preco).toFixed(2).replace('.', ',');
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    // Renderizar vinhos iniciais
    renderizarVinhos();

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
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
});
