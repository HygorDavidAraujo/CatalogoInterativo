// ===== VARIÁVEIS GLOBAIS =====
let vinhoEmEdicao = null;

// ===== GERENCIAMENTO DE CONFIGURAÇÕES =====
function carregarConfiguracoes() {
    const config = vinhoManager.configuracoes;
    
    document.getElementById('config-telefone').value = config.telefone || '';
    document.getElementById('config-email').value = config.email || '';
    document.getElementById('config-endereco').value = config.endereco || '';
    document.getElementById('config-instagram').value = config.instagram || '';
    document.getElementById('config-facebook').value = config.facebook || '';
    document.getElementById('config-whatsapp').value = config.whatsapp || '';
}

function configurarFormularioConfig() {
    const form = document.getElementById('form-configuracoes');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const configuracoes = {
            telefone: document.getElementById('config-telefone').value.trim(),
            email: document.getElementById('config-email').value.trim(),
            endereco: document.getElementById('config-endereco').value.trim(),
            instagram: document.getElementById('config-instagram').value.trim(),
            facebook: document.getElementById('config-facebook').value.trim(),
            whatsapp: document.getElementById('config-whatsapp').value.trim()
        };

        vinhoManager.salvarConfiguracoes(configuracoes);
        mostrarMensagem('Configurações salvas com sucesso! As alterações já estão visíveis no site.', 'sucesso');
    });
}

// ===== RENDERIZAÇÃO DA LISTA ADMIN =====
function renderizarListaAdmin() {
    const container = document.getElementById('lista-vinhos-admin');
    if (!container) return;

    const vinhos = vinhoManager.getVinhos();

    if (vinhos.length === 0) {
        container.innerHTML = `
            <div class="mensagem-vazio">
                <i class="fas fa-wine-bottle"></i>
                <p>Nenhum vinho cadastrado ainda.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = vinhos.map(vinho => `
        <div class="vinho-item-admin" data-id="${vinho.id}">
            <img src="${vinho.imagem}" alt="${vinho.nome}" class="vinho-item-imagem" onerror="this.src='https://via.placeholder.com/80x80?text=Vinho'">
            <div class="vinho-item-info">
                <div class="vinho-item-nome">${vinho.nome}</div>
                <div class="vinho-item-detalhes">
                    ${capitalizar(vinho.tipo)} | ${vinho.uva} | ${vinho.ano}
                </div>
                <div class="vinho-item-preco">R$ ${formatarPreco(vinho.preco)}</div>
            </div>
            <div class="vinho-item-acoes">
                <button class="btn-icon btn-editar" onclick="editarVinho(${vinho.id})">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn-icon btn-excluir" onclick="confirmarExclusao(${vinho.id})">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </div>
        </div>
    `).join('');
}

// ===== FORMULÁRIO =====
function configurarFormulario() {
    const form = document.getElementById('form-vinho');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const dadosVinho = {
            nome: document.getElementById('nome').value.trim(),
            tipo: document.getElementById('tipo').value,
            uva: document.getElementById('uva').value.trim(),
            ano: parseInt(document.getElementById('ano').value),
            guarda: document.getElementById('guarda').value.trim(),
            harmonizacao: document.getElementById('harmonizacao').value.trim(),
            descricao: document.getElementById('descricao').value.trim(),
            preco: parseFloat(document.getElementById('preco').value),
            imagem: document.getElementById('imagem').value.trim()
        };

        if (vinhoEmEdicao) {
            // Atualizar vinho existente
            vinhoManager.atualizarVinho(vinhoEmEdicao, dadosVinho);
            mostrarMensagem('Vinho atualizado com sucesso!', 'sucesso');
            vinhoEmEdicao = null;
        } else {
            // Adicionar novo vinho
            vinhoManager.adicionarVinho(dadosVinho);
            mostrarMensagem('Vinho cadastrado com sucesso!', 'sucesso');
        }

        form.reset();
        renderizarListaAdmin();
    });

    // Botão cancelar
    const btnCancelar = document.getElementById('btn-cancelar');
    if (btnCancelar) {
        btnCancelar.addEventListener('click', () => {
            form.reset();
            vinhoEmEdicao = null;
            const titulo = document.querySelector('.admin-card h2');
            if (titulo) {
                titulo.innerHTML = '<i class="fas fa-plus-circle"></i> Cadastrar Novo Vinho';
            }
        });
    }
}

// ===== EDIÇÃO DE VINHO =====
function editarVinho(id) {
    const vinho = vinhoManager.getVinhoPorId(id);
    if (!vinho) return;

    vinhoEmEdicao = id;

    // Preencher formulário
    document.getElementById('nome').value = vinho.nome;
    document.getElementById('tipo').value = vinho.tipo;
    document.getElementById('uva').value = vinho.uva;
    document.getElementById('ano').value = vinho.ano;
    document.getElementById('guarda').value = vinho.guarda || '';
    document.getElementById('harmonizacao').value = vinho.harmonizacao || '';
    document.getElementById('descricao').value = vinho.descricao || '';
    document.getElementById('preco').value = vinho.preco;
    document.getElementById('imagem').value = vinho.imagem;

    // Alterar título do formulário
    const titulo = document.querySelector('.admin-card h2');
    if (titulo) {
        titulo.innerHTML = '<i class="fas fa-edit"></i> Editar Vinho';
    }

    // Scroll para o formulário
    document.getElementById('form-vinho').scrollIntoView({ behavior: 'smooth' });
}

// ===== EXCLUSÃO DE VINHO =====
let vinhoParaExcluir = null;

function confirmarExclusao(id) {
    vinhoParaExcluir = id;
    const modal = document.getElementById('modal-confirmar');
    if (modal) {
        modal.style.display = 'block';
    }
}

function excluirVinho() {
    if (vinhoParaExcluir) {
        vinhoManager.excluirVinho(vinhoParaExcluir);
        mostrarMensagem('Vinho excluído com sucesso!', 'sucesso');
        renderizarListaAdmin();
        fecharModalConfirmacao();
        vinhoParaExcluir = null;
    }
}

function fecharModalConfirmacao() {
    const modal = document.getElementById('modal-confirmar');
    if (modal) {
        modal.style.display = 'none';
    }
    vinhoParaExcluir = null;
}

// ===== MENSAGENS =====
function mostrarMensagem(texto, tipo) {
    // Remover mensagens anteriores
    const mensagensAnteriores = document.querySelectorAll('.mensagem-sucesso, .mensagem-erro');
    mensagensAnteriores.forEach(msg => msg.remove());

    // Criar nova mensagem
    const mensagem = document.createElement('div');
    mensagem.className = tipo === 'sucesso' ? 'mensagem-sucesso' : 'mensagem-erro';
    mensagem.textContent = texto;

    // Inserir no início do formulário
    const form = document.getElementById('form-vinho');
    if (form) {
        form.parentElement.insertBefore(mensagem, form);

        // Remover após 5 segundos
        setTimeout(() => {
            mensagem.remove();
        }, 5000);
    }
}

// ===== CONFIGURAÇÃO DOS MODAIS =====
function configurarModais() {
    const modalConfirmar = document.getElementById('modal-confirmar');
    const btnConfirmar = document.getElementById('btn-confirmar-delete');
    const btnCancelar = document.getElementById('btn-cancelar-delete');

    if (btnConfirmar) {
        btnConfirmar.addEventListener('click', excluirVinho);
    }

    if (btnCancelar) {
        btnCancelar.addEventListener('click', fecharModalConfirmacao);
    }

    // Fechar ao clicar fora
    if (modalConfirmar) {
        window.addEventListener('click', (e) => {
            if (e.target === modalConfirmar) {
                fecharModalConfirmacao();
            }
        });
    }
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
    carregarConfiguracoes();
    configurarFormularioConfig();
    renderizarListaAdmin();
    configurarFormulario();
    configurarModais();
});
