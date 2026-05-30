// ===== VARIÁVEIS GLOBAIS =====
let vinhoEmEdicao = null;
let imagemUpload = null;
let removerImagem = false;
let logoUpload = null;
let removerLogo = false;

// Recupera cabeçalhos com JWT do authManager
function getAuthHeaders() {
    const token = window.authManager?.obterToken?.() || localStorage.getItem('jwt_token');
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

function isVinhoAtivo(value) {
    return value === null ||
           value === undefined ||
           value === 1 ||
           value === '1' ||
           value === true ||
           value === 'true';
}

function exigirTokenOuAvisar() {
    const token = window.authManager?.obterToken?.() || localStorage.getItem('jwt_token');
    if (!token) {
        alert('Sua sessão expirou. Faça login como administrador novamente para cadastrar vinhos.');
        throw new Error('Token ausente - faça login novamente');
    }
    return token;
}

// ===== PAÍS E BANDEIRA =====
function atualizarPreviewBandeira(paisNome, paisCodigo, bandeiraUrl) {
    const preview = document.getElementById('flag-preview');
    const img = document.getElementById('flag-img');
    const label = document.getElementById('flag-label');
    const inputCodigo = document.getElementById('pais-codigo');
    const inputBandeira = document.getElementById('bandeira-url');

    const codigo = (paisCodigo || '').toUpperCase();
    const url = bandeiraUrl || (codigo ? `https://flagcdn.com/w80/${codigo.toLowerCase()}.png` : '');

    inputCodigo.value = codigo;
    inputBandeira.value = url;

    if (preview && img && label && url) {
        img.src = url;
        img.alt = `Bandeira de ${paisNome || codigo}`;
        label.textContent = paisNome || codigo;
        preview.style.display = 'inline-flex';
    } else if (preview) {
        preview.style.display = 'none';
    }
}

function configurarSelecaoPais() {
    const selectPais = document.getElementById('pais-origem');
    const inputCodigo = document.getElementById('pais-codigo');
    if (!selectPais) return;

    selectPais.addEventListener('change', () => {
        const option = selectPais.options[selectPais.selectedIndex];
        const paisNome = option.value;
        const paisCodigo = option.dataset.code || '';
        const bandeiraUrl = option.dataset.flag || '';

        // Permitir edição manual apenas se o país não estiver na lista
        if (inputCodigo) {
            inputCodigo.readOnly = !!paisCodigo;
            if (!paisCodigo) {
                inputCodigo.value = '';
            }
        }

        atualizarPreviewBandeira(paisNome, paisCodigo, bandeiraUrl);
    });
}

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
        
        // Carregar logo se houver
        if (config.logo_url) {
            const previewImg = document.getElementById('logo-preview-img');
            const uploadPreview = document.getElementById('logo-upload-preview');
            const uploadActions = document.getElementById('logo-upload-actions');
            previewImg.src = config.logo_url;
            previewImg.style.display = 'block';
            uploadPreview.style.display = 'none';
            if (uploadActions) uploadActions.style.display = 'flex';
            removerLogo = false;
            logoUpload = null;
        }
        
        await preencherDestaqueSemana(config);
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

        const destaqueSelect = document.getElementById('config-destaque-vinho');
        const destaqueId = destaqueSelect ? destaqueSelect.value : '';

        const configuracoes = {
            nome_site: document.getElementById('config-nome-site').value.trim(),
            titulo: document.getElementById('config-titulo').value.trim(),
            descricao: document.getElementById('config-descricao').value.trim(),
            telefone: document.getElementById('config-telefone').value.trim(),
            email: document.getElementById('config-email').value.trim(),
            endereco: document.getElementById('config-endereco').value.trim(),
            instagram: document.getElementById('config-instagram').value.trim(),
            facebook: document.getElementById('config-facebook').value.trim(),
            whatsapp: document.getElementById('config-whatsapp').value.trim(),
            destaque_vinho_id: destaqueId ? parseInt(destaqueId, 10) : null
        };

        console.log('Dados a serem salvos:', configuracoes);

        // Verificar se tem logo
        try {
            if (logoUpload) {
                // Fazer upload da logo via backend
                const formData = new FormData();
                formData.append('logo', logoUpload);

                const uploadResponse = await fetch(`${API_URL}/configuracoes/upload-logo`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: formData
                });

                if (uploadResponse.ok) {
                    const uploadData = await uploadResponse.json();
                    configuracoes.logo_url = uploadData.logo_url;
                    console.log('Logo enviada com sucesso:', configuracoes.logo_url);
                } else {
                    const errorText = await uploadResponse.text();
                    console.error('Erro no upload:', errorText);
                    mostrarMensagem('Erro ao fazer upload da logo. Tente novamente.', 'erro');
                    return;
                }
            } else if (removerLogo) {
                configuracoes.logo_url = null;
            } else if (document.getElementById('logo-preview-img').style.display !== 'none') {
                const currentLogoUrl = document.getElementById('logo-preview-img').src;
                if (currentLogoUrl && !currentLogoUrl.includes('blob:')) {
                    configuracoes.logo_url = currentLogoUrl;
                }
            }

            const resultado = await vinhoManager.salvarConfiguracoes(configuracoes);
            console.log('Configurações salvas:', resultado);
            atualizarStatusDestaque(resultado);
            
            // Resetar estados de upload
            logoUpload = null;
            removerLogo = false;
            
            mostrarMensagem('Configurações salvas com sucesso! As alterações já estão visíveis no site.', 'sucesso');
        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
            mostrarMensagem('Erro ao salvar configurações. Tente novamente.', 'erro');
        }
    });
}

async function preencherDestaqueSemana(config) {
    const select = document.getElementById('config-destaque-vinho');
    if (!select) return;

    if (!vinhoManager.vinhos.length) {
        await vinhoManager.carregarVinhos(true);
    }

    const vinhosAtivos = vinhoManager.vinhos.filter(vinho => isVinhoAtivo(vinho.ativo));
    const opcoes = ['<option value="">Aleatorio (sem fixar)</option>'];

    vinhosAtivos.forEach(vinho => {
        opcoes.push(`<option value="${vinho.id}">${vinho.nome}</option>`);
    });

    select.innerHTML = opcoes.join('');
    select.value = config?.destaque_vinho_id ? String(config.destaque_vinho_id) : '';
    atualizarStatusDestaque(config);
}

function atualizarStatusDestaque(config) {
    const status = document.getElementById('destaque-status');
    if (!status) return;

    if (config?.destaque_vinho_id && config?.destaque_fixado_em) {
        const fixadoEm = new Date(config.destaque_fixado_em);
        const expiraEm = new Date(fixadoEm.getTime() + 7 * 24 * 60 * 60 * 1000);
        const dataFixada = fixadoEm.toLocaleDateString('pt-BR');
        const dataExpira = expiraEm.toLocaleDateString('pt-BR');
        status.textContent = `Fixado em ${dataFixada}. Valido ate ${dataExpira} ou ate substituicao.`;
    } else {
        status.textContent = 'Sem destaque fixado. O sistema escolhe automaticamente.';
    }
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
            '/images/placeholder-80x80.svg';
        const bandeira = vinho.bandeira_url || (vinho.pais_codigo ? `https://flagcdn.com/w40/${vinho.pais_codigo.toLowerCase()}.png` : '');
        const paisHtml = vinho.pais_origem ? ` | <span class="vinho-item-pais">${bandeira ? `<img src="${bandeira}" alt="Bandeira" width="22" height="14">` : ''}${vinho.pais_origem}</span>` : '';
        
        return `
            <div class="vinho-item-admin ${isVinhoAtivo(vinho.ativo) ? '' : 'vinho-inativo'}" data-id="${vinho.id}">
                <img src="${imagemSrc}" alt="${vinho.nome}" class="vinho-item-imagem" onerror="this.src='/images/placeholder-80x80.svg'">
                <div class="vinho-item-info">
                    <div class="vinho-item-nome">${vinho.nome}</div>
                    <div class="vinho-item-detalhes">
                        ${capitalizar(vinho.tipo)} | ${vinho.uva} | ${vinho.ano}${paisHtml}
                    </div>
                    <div class="vinho-item-preco">R$ ${formatarPreco(vinho.preco)}</div>
                </div>
                <div class="vinho-item-acoes">
                    <button class="btn-icon-small btn-editar" onclick="editarVinho(${vinho.id})" title="Editar">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn-icon-small btn-excluir" onclick="confirmarExclusao(${vinho.id})" title="Excluir">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                    <label class="toggle-switch" title="${isVinhoAtivo(vinho.ativo) ? 'Clique para ocultar do site' : 'Clique para mostrar no site'}">
                        <input type="checkbox" ${isVinhoAtivo(vinho.ativo) ? 'checked' : ''} onchange="toggleVisibilidade(${vinho.id}, this.checked)">
                        <span class="toggle-slider"></span>
                        <span class="toggle-label">${isVinhoAtivo(vinho.ativo) ? 'Visível' : 'Oculto'}</span>
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
    const uploadActions = document.getElementById('upload-actions');
    const btnRemoverImagem = document.getElementById('btn-remover-imagem');
    const imagemUrlInput = document.getElementById('imagem-url');

    if (btnRemoverImagem) {
        btnRemoverImagem.addEventListener('click', () => {
            removerImagem = true;
            imagemUpload = null;
            fileInput.value = '';
            if (imagemUrlInput) imagemUrlInput.value = '';
            previewImg.src = '';
            previewImg.style.display = 'none';
            uploadPreview.style.display = 'block';
            if (uploadActions) uploadActions.style.display = 'none';
        });
    }

    if (imagemUrlInput) {
        imagemUrlInput.addEventListener('input', () => {
            if (vinhoEmEdicao) {
                removerImagem = true;
            }
        });

        imagemUrlInput.addEventListener('change', () => {
            const url = imagemUrlInput.value.trim();
            if (url) {
                previewImg.src = url;
                previewImg.style.display = 'block';
                uploadPreview.style.display = 'none';
                if (uploadActions) uploadActions.style.display = 'flex';
            }
        });
    }

    // Click no preview abre o seletor
    uploadPreview.addEventListener('click', () => {
        fileInput.click();
    });

    // Quando seleciona arquivo
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            imagemUpload = file;
            if (vinhoEmEdicao) {
                removerImagem = true;
            }
            
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
                if (uploadActions) uploadActions.style.display = 'flex';
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
            if (vinhoEmEdicao) {
                removerImagem = true;
            }
            fileInput.files = e.dataTransfer.files;
            fileInput.dispatchEvent(new Event('change'));
            if (uploadActions) uploadActions.style.display = 'flex';
        }
    });
}

// ===== UPLOAD DE LOGO =====
function configurarUploadLogo() {
    const fileInput = document.getElementById('config-logo');
    const uploadPreview = document.getElementById('logo-upload-preview');
    const previewImg = document.getElementById('logo-preview-img');
    const uploadActions = document.getElementById('logo-upload-actions');
    const btnRemoverLogo = document.getElementById('btn-remover-logo');

    if (!fileInput) return;

    if (btnRemoverLogo) {
        btnRemoverLogo.addEventListener('click', () => {
            removerLogo = true;
            logoUpload = null;
            fileInput.value = '';
            previewImg.src = '';
            previewImg.style.display = 'none';
            uploadPreview.style.display = 'block';
            if (uploadActions) uploadActions.style.display = 'none';
        });
    }

    // Click no preview abre o seletor
    uploadPreview.addEventListener('click', () => {
        fileInput.click();
    });

    // Quando seleciona arquivo
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            logoUpload = file;
            removerLogo = false;
            
            // Validar tamanho (2MB para logo)
            if (file.size > 2 * 1024 * 1024) {
                mostrarMensagem('Arquivo muito grande! Máximo 2MB.', 'erro');
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
                if (uploadActions) uploadActions.style.display = 'flex';
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
            if (uploadActions) uploadActions.style.display = 'flex';
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
            pais_origem: document.getElementById('pais-origem').value,
            pais_codigo: document.getElementById('pais-codigo').value.trim().toUpperCase(),
            bandeira_url: document.getElementById('bandeira-url').value.trim(),
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
        formData.append('pais_origem', dadosVinho.pais_origem);
        formData.append('pais_codigo', dadosVinho.pais_codigo);
        formData.append('bandeira_url', dadosVinho.bandeira_url);
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

        if (vinhoEmEdicao && removerImagem) {
            formData.append('removerImagem', true);
        }

        try {
            exigirTokenOuAvisar();
            let response;
            if (vinhoEmEdicao) {
                // Atualizar vinho existente
                console.log('Atualizando vinho com ID:', vinhoEmEdicao);
                response = await fetch(`${API_URL}/vinhos/${vinhoEmEdicao}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: formData
                });
                console.log('Resposta da atualização:', response.status);
                mostrarMensagem('Vinho atualizado com sucesso!', 'sucesso');
            } else {
                // Adicionar novo vinho
                console.log('Adicionando novo vinho');
                response = await fetch(`${API_URL}/vinhos`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: formData
                });
                console.log('Resposta do cadastro:', response.status);
                mostrarMensagem('Vinho cadastrado com sucesso!', 'sucesso');
            }

            if (!response.ok) {
                const erro = await response.text();
                console.error('Erro na resposta:', response.status, erro);
                
                // Tratamento específico para rate limiting do Cloudinary
                if (response.status === 429) {
                    try {
                        const errorData = JSON.parse(erro);
                        throw new Error(errorData.error || 'Limite de uploads excedido');
                    } catch (e) {
                        throw new Error('Limite de uploads excedido. Aguarde alguns minutos.');
                    }
                }
                
                throw new Error('Erro ao salvar vinho');
            }

            console.log('Vinho salvo com sucesso, limpando formulário');
            limparFormulario();
            console.log('Recarregando lista de vinhos');
            await renderizarListaAdmin();
        } catch (error) {
            console.error('Erro ao salvar vinho:', error);
            const mensagem = error.message || 'Erro ao salvar vinho. Tente novamente.';
            mostrarMensagem(mensagem, 'erro');
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
    removerImagem = false;

    atualizarPreviewBandeira('', '', '');
    
    // Resetar preview
    const preview = document.getElementById('preview-imagem');
    const uploadPreview = document.getElementById('upload-preview');
    const uploadActions = document.getElementById('upload-actions');
    const fileInput = document.getElementById('imagem');
    const imagemUrlInput = document.getElementById('imagem-url');

    if (preview) {
        preview.src = '';
        preview.style.display = 'none';
    }
    if (uploadPreview) {
        uploadPreview.style.display = 'block';
    }
    if (uploadActions) {
        uploadActions.style.display = 'none';
    }
    if (fileInput) {
        fileInput.value = '';
    }
    if (imagemUrlInput) {
        imagemUrlInput.value = '';
    }
    
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
    removerImagem = false;
    imagemUpload = null;

    const fileInput = document.getElementById('imagem');
    const previewImg = document.getElementById('preview-imagem');
    const uploadPreview = document.getElementById('upload-preview');
    const uploadActions = document.getElementById('upload-actions');
    if (fileInput) {
        fileInput.value = '';
    }
    if (uploadActions) {
        uploadActions.style.display = 'none';
    }

    // Preencher formulário
    document.getElementById('nome').value = vinho.nome;
    document.getElementById('tipo').value = vinho.tipo;
    document.getElementById('uva').value = vinho.uva;
    document.getElementById('pais-origem').value = vinho.pais_origem || '';
    atualizarPreviewBandeira(vinho.pais_origem || '', vinho.pais_codigo || '', vinho.bandeira_url || '');
    document.getElementById('ano').value = vinho.ano;
    document.getElementById('guarda').value = vinho.guarda || '';
    document.getElementById('harmonizacao').value = vinho.harmonizacao || '';
    document.getElementById('descricao').value = vinho.descricao || '';
    document.getElementById('preco').value = vinho.preco;
    document.getElementById('ativo').checked = isVinhoAtivo(vinho.ativo); // Trata valores do MySQL (0/1)

    // Mostrar imagem atual
    if (vinho.imagem) {
        const imagemSrc = vinho.imagem.startsWith('http') ? vinho.imagem : `http://localhost:3000${vinho.imagem}`;
        previewImg.src = imagemSrc;
        previewImg.style.display = 'block';
        uploadPreview.style.display = 'none';
        if (uploadActions) {
            uploadActions.style.display = 'flex';
        }
        
        if (vinho.imagem.startsWith('http')) {
            document.getElementById('imagem-url').value = vinho.imagem;
        }
    } else {
        previewImg.src = '';
        previewImg.style.display = 'none';
        uploadPreview.style.display = 'block';
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
        formData.append('pais_origem', vinho.pais_origem || '');
        formData.append('pais_codigo', vinho.pais_codigo || '');
        formData.append('bandeira_url', vinho.bandeira_url || '');
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
            headers: getAuthHeaders(),
            body: formData,
            cache: 'no-store'
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Resposta erro:', errorText);
            throw new Error('Erro ao atualizar visibilidade');
        }

        const result = await response.json();
        console.log('Resposta sucesso:', result);

        // Atualizar o estado local imediatamente e recarregar a lista
        vinho.ativo = isVinhoAtivo(ativo);
        await vinhoManager.carregarVinhos(true);

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
                method: 'DELETE',
                headers: getAuthHeaders()
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

// ===== TABS DE CONFIGURAÇÃO =====
function configurarTabs() {
    const tabs = document.querySelectorAll('.config-tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;

            // Remover classe active de todas as tabs
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            // Adicionar classe active na tab clicada
            tab.classList.add('active');
            
            // Mostrar conteúdo correspondente
            const targetContent = document.getElementById(`tab-${targetTab}`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

// ===== BENEFÍCIOS VIP =====
let beneficiosVip = [];

async function carregarBeneficios() {
    try {
        const response = await fetch(`${API_URL}/beneficios`);
        if (!response.ok) throw new Error('Erro ao carregar benefícios');
        
        beneficiosVip = await response.json();
        renderizarBeneficios();
        return beneficiosVip;
    } catch (error) {
        console.error('Erro ao carregar benefícios:', error);
        document.getElementById('lista-beneficios').innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #f44336;">
                <i class="fas fa-exclamation-triangle"></i> Erro ao carregar benefícios
            </div>
        `;
    }
}

function renderizarBeneficios() {
    const container = document.getElementById('lista-beneficios');
    if (!container) return;

    if (beneficiosVip.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #666;">
                <i class="fas fa-info-circle"></i> Nenhum benefício cadastrado
            </div>
        `;
        return;
    }

    container.innerHTML = beneficiosVip.map(beneficio => `
        <div class="beneficio-item" data-id="${beneficio.id}">
            <div class="beneficio-info">
                <div class="beneficio-nome">
                    <span class="badge-vip" style="background-color: ${beneficio.cor || '#6B1C40'}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.9em; margin-right: 8px;">${beneficio.nome}</span>
                </div>
                <div class="beneficio-detalhes">
                    <span><i class="fas fa-tag"></i> ${beneficio.slug}</span>
                    <span><i class="fas fa-percent"></i> ${beneficio.tipo_desconto === 'percentual' ? beneficio.valor_desconto + '%' : 'R$ ' + beneficio.valor_desconto.toFixed(2).replace('.', ',')}</span>
                    <span><i class="fas fa-palette"></i> ${beneficio.cor || '#6B1C40'}</span>
                    <span><i class="fas fa-sort"></i> Ordem: ${beneficio.ordem}</span>
                </div>
            </div>
            <div class="beneficio-acoes">
                <button class="btn-icon-small btn-editar-beneficio" onclick="editarBeneficio(${beneficio.id})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon-small btn-excluir-beneficio" onclick="excluirBeneficio(${beneficio.id})" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

async function adicionarBeneficio() {
    const nome = document.getElementById('beneficio-nome').value.trim();
    const slug = document.getElementById('beneficio-slug').value.trim().toLowerCase();
    const tipoDesconto = document.getElementById('beneficio-tipo-desconto').value;
    const valorDesconto = parseFloat(document.getElementById('beneficio-valor-desconto').value);
    const cor = document.getElementById('beneficio-cor').value;
    const ordem = parseInt(document.getElementById('beneficio-ordem').value) || 0;

    if (!nome || !slug || isNaN(valorDesconto)) {
        alert('Por favor, preencha todos os campos obrigatórios');
        return;
    }

    try {
        exigirTokenOuAvisar();
        const response = await fetch(`${API_URL}/beneficios`, {
            method: 'POST',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nome, slug, tipo_desconto: tipoDesconto, valor_desconto: valorDesconto, cor, ordem })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao adicionar benefício');
        }

        mostrarMensagem('Ben efício adicionado com sucesso!', 'sucesso');
        
        // Limpar formulário
        document.getElementById('beneficio-nome').value = '';
        document.getElementById('beneficio-slug').value = '';
        document.getElementById('beneficio-valor-desconto').value = '';
        document.getElementById('beneficio-cor').value = '#6B1C40';
        document.getElementById('beneficio-ordem').value = '0';
        
        // Recarregar lista de benefícios no admin
        await carregarBeneficios();
        
        // Recarregar VipManager no frontend para atualizar badges
        if (window.vipManager) {
            await window.vipManager.recarregar();
            console.log('✓ VipManager recarregado com sucesso');
        }
    } catch (error) {
        console.error('Erro ao adicionar benefício:', error);
        alert(error.message);
    }
}

async function excluirBeneficio(id) {
    if (!confirm('Tem certeza que deseja excluir este benefício? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        exigirTokenOuAvisar();
        const response = await fetch(`${API_URL}/beneficios/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error('Erro ao excluir benefício');

        mostrarMensagem('Benefício excluído com sucesso!', 'sucesso');
        await carregarBeneficios();
    } catch (error) {
        console.error('Erro ao excluir benefício:', error);
        alert('Erro ao excluir benefício. Tente novamente.');
    }
}

function editarBeneficio(id) {
    const beneficio = beneficiosVip.find(b => b.id === id);
    if (!beneficio) return;

    const novoNome = prompt('Nome do Benefício:', beneficio.nome);
    if (!novoNome) return;

    const novoSlug = prompt('Identificador (slug):', beneficio.slug);
    if (!novoSlug) return;

    const novoValor = prompt(`Valor do desconto ${beneficio.tipo_desconto === 'percentual' ? '(%)' : '(R$)'}:`, beneficio.valor_desconto);
    if (!novoValor) return;

    const novaCor = prompt('Cor do Badge (hex):', beneficio.cor || '#6B1C40');
    if (!novaCor) return;

    const novaOrdem = prompt('Ordem de exibição:', beneficio.ordem);
    if (!novaOrdem) return;

    atualizarBeneficio(id, {
        nome: novoNome.trim(),
        slug: novoSlug.trim().toLowerCase(),
        tipo_desconto: beneficio.tipo_desconto,
        valor_desconto: parseFloat(novoValor),
        cor: novaCor.trim(),
        ordem: parseInt(novaOrdem)
    });
}

async function atualizarBeneficio(id, dados) {
    try {
        exigirTokenOuAvisar();
        const response = await fetch(`${API_URL}/beneficios/${id}`, {
            method: 'PUT',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dados)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao atualizar benefício');
        }

        mostrarMensagem('Benefício atualizado com sucesso!', 'sucesso');
        await carregarBeneficios();
        
        // Recarregar VipManager no frontend para atualizar badges e descontos
        if (window.vipManager) {
            await window.vipManager.recarregar();
            console.log('✓ VipManager recarregado com sucesso');
        }
    } catch (error) {
        console.error('Erro ao atualizar benefício:', error);
        alert(error.message);
    }
}

function configurarBeneficios() {
    const btnAdicionar = document.getElementById('btn-adicionar-beneficio');
    if (btnAdicionar) {
        btnAdicionar.addEventListener('click', adicionarBeneficio);
    }
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async () => {
    await carregarConfiguracoes();
    configurarFormularioConfig();
    configurarUploadLogo();
    configurarTabs();
    configurarBeneficios();
    await carregarBeneficios();
    await renderizarListaAdmin();
    configurarFormulario();
    configurarSelecaoPais();
    configurarUploadImagem();
    configurarModais();
    configurarFiltrosAdmin();
});
