// ===== VARIÁVEIS GLOBAIS =====
let vinhoEmEdicao = null;
let imagemUpload = null;

// ===== GERENCIAMENTO DE CONFIGURAÇÕES =====
async function carregarConfiguracoes() {
    try {
        console.log('Carregando configurações...', typeof vinhoManager);
        if (typeof vinhoManager === 'undefined') {
            console.error('vinhoManager não está definido!');
            return;
        }
        await vinhoManager.carregarConfiguracoes();
        const config = vinhoManager.configuracoes;
        console.log('Configurações carregadas:', config);
        
        document.getElementById('config-nome-site').value = config.nome_site || '';
        document.getElementById('config-titulo').value = config.titulo || '';
        document.getElementById('config-descricao').value = config.descricao || '';
        document.getElementById('config-telefone').value = config.telefone || '';
        document.getElementById('config-email').value = config.email || '';
        document.getElementById('config-endereco').value = config.endereco || '';
        document.getElementById('config-instagram').value = config.instagram || '';
        document.getElementById('config-facebook').value = config.facebook || '';
        document.getElementById('config-whatsapp').value = config.whatsapp || '';
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
    }
}

async function configurarFormularioConfig() {
    const form = document.getElementById('form-configuracoes');
    if (!form) {
        console.log('Formulário de configurações não encontrado');
        return;
    }

    console.log('Configurando formulário de configurações');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Formulário de configurações submetido');

        const configuracoes = {
            nome_site: document.getElementById('config-nome-site').value.trim(),
            titulo: document.getElementById('config-titulo').value.trim(),
            descricao: document.getElementById('config-descricao').value.trim(),
            telefone: document.getElementById('config-telefone').value.trim(),
            email: document.getElementById('config-email').value.trim(),
            endereco: document.getElementById('config-endereco').value.trim(),
            instagram: document.getElementById('config-instagram').value.trim(),
            facebook: document.getElementById('config-facebook').value.trim(),
            whatsapp: document.getElementById('config-whatsapp').value.trim()
        };

        console.log('Dados a serem salvos:', configuracoes);

        try {
            const resultado = await vinhoManager.salvarConfiguracoes(configuracoes);
            console.log('Configurações salvas:', resultado);
            mostrarMensagem('Configurações salvas com sucesso! As alterações já estão visíveis no site.', 'sucesso');
        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
            mostrarMensagem('Erro ao salvar configurações. Tente novamente.', 'erro');
        }
    });
}

// ===== RENDERIZAÇÃO DA LISTA ADMIN =====
async function renderizarListaAdmin(filtros = {}) {
    const container = document.getElementById('lista-vinhos-admin');
    if (!container) return;

    await vinhoManager.carregarVinhos(true); // true = admin, mostra todos os vinhos
    let vinhos = vinhoManager.vinhos;

    // Aplicar filtros
    if (filtros.busca) {
        const buscaLower = filtros.busca.toLowerCase();
        vinhos = vinhos.filter(v => 
            v.nome.toLowerCase().includes(buscaLower) || 
            v.uva.toLowerCase().includes(buscaLower)
        );
    }

    if (filtros.tipo && filtros.tipo !== 'todos') {
        if (filtros.tipo === 'suco_integral') {
            // Filtrar ambos os tipos de suco integral
            vinhos = vinhos.filter(v => 
                v.tipo === 'suco_integral_tinto' || v.tipo === 'suco_integral_branco'
            );
        } else {
            vinhos = vinhos.filter(v => v.tipo === filtros.tipo);
        }
    }

    if (vinhos.length === 0) {
        container.innerHTML = `
            <div class="mensagem-vazio">
                <i class="fas fa-wine-bottle"></i>
                <p>Nenhum vinho cadastrado ainda.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = vinhos.map(vinho => {
        const imagemSrc = vinho.imagem ? 
            (vinho.imagem.startsWith('http') ? vinho.imagem : `http://localhost:3000${vinho.imagem}`) :
            'https://via.placeholder.com/80x80?text=Vinho';
        
        return `
            <div class="vinho-item-admin ${vinho.ativo === 0 || vinho.ativo === false ? 'vinho-inativo' : ''}" data-id="${vinho.id}">
                <img src="${imagemSrc}" alt="${vinho.nome}" class="vinho-item-imagem" onerror="this.src='https://via.placeholder.com/80x80?text=Vinho'">
                <div class="vinho-item-info">
                    <div class="vinho-item-nome">${vinho.nome}</div>
                    <div class="vinho-item-detalhes">
                        ${capitalizar(vinho.tipo)} | ${vinho.uva} | ${vinho.ano}
                    </div>
                    <div class="vinho-item-preco">R$ ${formatarPreco(vinho.preco)}</div>
                </div>
                <div class="vinho-item-acoes">
                    <button class="btn-icon-small btn-editar" onclick="editarVinho(${vinho.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon-small btn-excluir" onclick="confirmarExclusao(${vinho.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                    <label class="toggle-switch" title="${vinho.ativo === 0 || vinho.ativo === false ? 'Clique para mostrar no site' : 'Clique para ocultar do site'}">
                        <input type="checkbox" ${vinho.ativo === 1 || vinho.ativo === true ? 'checked' : ''} onchange="toggleVisibilidade(${vinho.id}, this.checked)">
                        <span class="toggle-slider"></span>
                        <span class="toggle-label">${vinho.ativo === 0 || vinho.ativo === false ? 'Oculto' : 'Visível'}</span>
                    </label>
                </div>
            </div>
        `;
    }).join('');
}

// ===== UPLOAD DE IMAGEM =====
function configurarUploadImagem() {
    const fileInput = document.getElementById('imagem');
    const uploadPreview = document.getElementById('upload-preview');
    const previewImg = document.getElementById('preview-imagem');

    // Click no preview abre o seletor
    uploadPreview.addEventListener('click', () => {
        fileInput.click();
    });

    // Quando seleciona arquivo
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            imagemUpload = file;
            
            // Validar tamanho
            if (file.size > 5 * 1024 * 1024) {
                mostrarMensagem('Arquivo muito grande! Máximo 5MB.', 'erro');
                fileInput.value = '';
                return;
            }

            // Validar tipo
            if (!file.type.startsWith('image/')) {
                mostrarMensagem('Apenas arquivos de imagem são permitidos!', 'erro');
                fileInput.value = '';
                return;
            }

            // Mostrar preview
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImg.src = e.target.result;
                previewImg.style.display = 'block';
                uploadPreview.style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    });

    // Drag and drop
    uploadPreview.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadPreview.style.borderColor = 'var(--cor-secundaria)';
    });

    uploadPreview.addEventListener('dragleave', () => {
        uploadPreview.style.borderColor = 'var(--cor-primaria)';
    });

    uploadPreview.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadPreview.style.borderColor = 'var(--cor-primaria)';
        
        const file = e.dataTransfer.files[0];
        if (file) {
            fileInput.files = e.dataTransfer.files;
            fileInput.dispatchEvent(new Event('change'));
        }
    });
}

// ===== FORMULÁRIO =====
function configurarFormulario() {
    const form = document.getElementById('form-vinho');
    if (!form) {
        console.log('Formulário de vinho não encontrado');
        return;
    }

    console.log('Configurando formulário de vinhos');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Formulário de vinho submetido');

        const formData = new FormData();
        const dadosVinho = {
            nome: document.getElementById('nome').value.trim(),
            tipo: document.getElementById('tipo').value,
            uva: document.getElementById('uva').value.trim(),
            ano: document.getElementById('ano').value,
            guarda: document.getElementById('guarda').value.trim(),
            harmonizacao: document.getElementById('harmonizacao').value.trim(),
            descricao: document.getElementById('descricao').value.trim(),
            preco: document.getElementById('preco').value
        };
        console.log('Dados coletados do vinho:', dadosVinho);

        formData.append('nome', dadosVinho.nome);
        formData.append('tipo', dadosVinho.tipo);
        formData.append('uva', dadosVinho.uva);
        formData.append('ano', dadosVinho.ano);
        formData.append('guarda', dadosVinho.guarda);
        formData.append('harmonizacao', dadosVinho.harmonizacao);
        formData.append('descricao', dadosVinho.descricao);
        formData.append('preco', dadosVinho.preco);
        
        // Adicionar campo ativo (checkbox)
        const ativo = document.getElementById('ativo').checked;
        formData.append('ativo', ativo);
        console.log('Campo ativo:', ativo);
        
        // Verificar se tem upload ou URL
        const imagemUrl = document.getElementById('imagem-url').value.trim();
        if (imagemUpload) {
            console.log('Adicionando imagem do upload:', imagemUpload.name);
            formData.append('imagem', imagemUpload);
        } else if (imagemUrl) {
            formData.append('imagemUrl', imagemUrl);
        }

        try {
            let response;
            if (vinhoEmEdicao) {
                // Atualizar vinho existente
                console.log('Atualizando vinho com ID:', vinhoEmEdicao);
                response = await fetch(`${API_URL}/vinhos/${vinhoEmEdicao}`, {
                    method: 'PUT',
                    body: formData
                });
                console.log('Resposta da atualização:', response.status);
                mostrarMensagem('Vinho atualizado com sucesso!', 'sucesso');
            } else {
                // Adicionar novo vinho
                console.log('Adicionando novo vinho');
                response = await fetch(`${API_URL}/vinhos`, {
                    method: 'POST',
                    body: formData
                });
                console.log('Resposta do cadastro:', response.status);
                mostrarMensagem('Vinho cadastrado com sucesso!', 'sucesso');
            }

            if (!response.ok) {
                const erro = await response.text();
                console.error('Erro na resposta:', response.status, erro);
                throw new Error('Erro ao salvar vinho');
            }

            console.log('Vinho salvo com sucesso, limpando formulário');
            limparFormulario();
            console.log('Recarregando lista de vinhos');
            await renderizarListaAdmin();
        } catch (error) {
            console.error('Erro ao salvar vinho:', error);
            mostrarMensagem('Erro ao salvar vinho. Tente novamente.', 'erro');
        }
    });

    // Botão cancelar
    const btnCancelar = document.getElementById('btn-cancelar');
    if (btnCancelar) {
        btnCancelar.addEventListener('click', limparFormulario);
    }
}

function limparFormulario() {
    const form = document.getElementById('form-vinho');
    form.reset();
    
    vinhoEmEdicao = null;
    imagemUpload = null;
    
    // Resetar preview
    document.getElementById('preview-imagem').style.display = 'none';
    document.getElementById('upload-preview').style.display = 'block';
    
    const titulo = document.querySelector('.admin-card h2');
    if (titulo) {
        titulo.innerHTML = '<i class="fas fa-plus-circle"></i> Cadastrar Novo Vinho';
    }
}

// ===== EDIÇÃO DE VINHO =====
async function editarVinho(id) {
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
    document.getElementById('ativo').checked = (vinho.ativo === 1 || vinho.ativo === true); // Trata valores do MySQL (0/1)

    // Mostrar imagem atual
    if (vinho.imagem) {
        const imagemSrc = vinho.imagem.startsWith('http') ? vinho.imagem : `http://localhost:3000${vinho.imagem}`;
        document.getElementById('preview-imagem').src = imagemSrc;
        document.getElementById('preview-imagem').style.display = 'block';
        document.getElementById('upload-preview').style.display = 'none';
        
        if (vinho.imagem.startsWith('http')) {
            document.getElementById('imagem-url').value = vinho.imagem;
        }
    }

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

// ===== TOGGLE VISIBILIDADE =====
async function toggleVisibilidade(id, ativo) {
    try {
        console.log('Toggle visibilidade:', { id, ativo });
        
        const vinho = vinhoManager.vinhos.find(v => v.id == id);
        if (!vinho) {
            console.error('Vinho não encontrado:', id);
            return;
        }

        console.log('Vinho encontrado:', vinho);
        console.log('Alterando ativo de', vinho.ativo, 'para', ativo);

        const formData = new FormData();
        formData.append('nome', vinho.nome);
        formData.append('tipo', vinho.tipo);
        formData.append('uva', vinho.uva);
        formData.append('ano', vinho.ano);
        formData.append('guarda', vinho.guarda || '');
        formData.append('harmonizacao', vinho.harmonizacao || '');
        formData.append('descricao', vinho.descricao || '');
        formData.append('preco', vinho.preco);
        formData.append('ativo', ativo);
        if (vinho.imagem) {
            formData.append('imagemUrl', vinho.imagem);
        }

        console.log('FormData ativo:', formData.get('ativo'));

        const response = await fetch(`${API_URL}/vinhos/${id}`, {
            method: 'PUT',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Resposta erro:', errorText);
            throw new Error('Erro ao atualizar visibilidade');
        }

        const result = await response.json();
        console.log('Resposta sucesso:', result);

        mostrarMensagem(ativo ? 'Vinho agora está visível no site!' : 'Vinho ocultado do site!', 'sucesso');
        await renderizarListaAdmin();
    } catch (error) {
        console.error('Erro ao alterar visibilidade:', error);
        mostrarMensagem('Erro ao alterar visibilidade. Tente novamente.', 'erro');
        await renderizarListaAdmin(); // Recarregar para reverter o estado visual
    }
}

async function excluirVinho() {
    if (vinhoParaExcluir) {
        try {
            const response = await fetch(`${API_URL}/vinhos/${vinhoParaExcluir}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Erro ao excluir vinho');
            }

            mostrarMensagem('Vinho excluído com sucesso!', 'sucesso');
            await renderizarListaAdmin();
            fecharModalConfirmacao();
        } catch (error) {
            console.error('Erro ao excluir vinho:', error);
            mostrarMensagem('Erro ao excluir vinho. Tente novamente.', 'erro');
        }
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
    const mensagensAnteriores = document.querySelectorAll('.mensagem-sucesso, .mensagem-erro');
    mensagensAnteriores.forEach(msg => msg.remove());

    const mensagem = document.createElement('div');
    mensagem.className = tipo === 'sucesso' ? 'mensagem-sucesso' : 'mensagem-erro';
    mensagem.textContent = texto;

    const form = document.getElementById('form-configuracoes');
    if (form) {
        form.parentElement.insertBefore(mensagem, form);

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
    // Tratamento especial para tipos de suco integral
    if (str === 'suco_integral_tinto') return 'Suco Integral - Tinto';
    if (str === 'suco_integral_branco') return 'Suco Integral - Branco';
    
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatarPreco(preco) {
    return parseFloat(preco).toFixed(2).replace('.', ',');
}

// ===== FILTROS ADMIN =====
function configurarFiltrosAdmin() {
    const buscaInput = document.getElementById('busca-admin');
    const tipoSelect = document.getElementById('filtro-tipo-admin');

    if (buscaInput) {
        buscaInput.addEventListener('input', () => {
            const busca = buscaInput.value;
            const tipo = tipoSelect ? tipoSelect.value : 'todos';
            renderizarListaAdmin({ busca, tipo });
        });
    }

    if (tipoSelect) {
        tipoSelect.addEventListener('change', () => {
            const busca = buscaInput ? buscaInput.value : '';
            const tipo = tipoSelect.value;
            renderizarListaAdmin({ busca, tipo });
        });
    }
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async () => {
    await carregarConfiguracoes();
    configurarFormularioConfig();
    await renderizarListaAdmin();
    configurarFormulario();
    configurarUploadImagem();
    configurarModais();
    configurarFiltrosAdmin();
});
