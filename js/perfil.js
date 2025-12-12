class PerfilManager {
    constructor() {
        this.pedidoParaRefazer = null;
        console.log('PerfilManager constructor chamado');
    }

    init() {
        console.log('=== Inicializando PerfilManager ===');
        
        // Verificar se authManager existe
        if (typeof window.authManager === 'undefined' || !window.authManager) {
            console.error('❌ authManager não está definido!');
            alert('Erro: Sistema de autenticação não carregado. Recarregue a página.');
            return;
        }

        console.log('✓ authManager encontrado');

        // Verificar autenticação
        if (!window.authManager.isLogado()) {
            console.log('❌ Usuário não está logado, redirecionando...');
            window.location.href = 'index.html';
            return;
        }

        console.log('✓ Usuário está logado:', window.window.authManager.usuarioLogado);

        // Atualizar nome do usuário no header
        const usuarioNome = document.getElementById('usuario-nome');
        if (usuarioNome && window.window.authManager.usuarioLogado) {
            const primeiroNome = window.window.authManager.usuarioLogado.nome.split(' ')[0];
            usuarioNome.textContent = primeiroNome;
            console.log('✓ Nome do usuário atualizado:', primeiroNome);
        }

        // Configurar tabs
        console.log('Configurando tabs...');
        this.configurarTabs();
        
        // Carregar dados do usuário
        console.log('Carregando dados do usuário...');
        this.carregarDadosUsuario();
        
        // Configurar formulários
        console.log('Configurando formulários...');
        this.configurarFormularios();
        
        // Configurar botão sair
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Fazendo logout...');
                window.authManager.logout();
                window.location.href = 'index.html';
            });
            console.log('✓ Botão logout configurado');
        }

        // Configurar modal de confirmação
        this.configurarModal();
        
        console.log('=== PerfilManager inicializado com sucesso ===');
    }

    configurarTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        console.log('Configurando tabs:', tabBtns.length, 'botões encontrados');
        console.log('Tab contents:', tabContents.length, 'conteúdos encontrados');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                console.log('Tab clicada:', tabName);
                
                // Remover active de todos
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                // Adicionar active no clicado
                btn.classList.add('active');
                const tabContent = document.getElementById(`tab-${tabName}`);
                if (tabContent) {
                    tabContent.classList.add('active');
                    console.log('Tab ativada:', tabName);
                } else {
                    console.error('Tab content não encontrado:', `tab-${tabName}`);
                }

                // Se for histórico, carregar pedidos
                if (tabName === 'historico') {
                    console.log('Carregando histórico de pedidos...');
                    this.carregarHistoricoPedidos();
                }
            });
        });
    }

    async carregarDadosUsuario() {
        try {
            console.log('📥 Carregando dados do usuário ID:', window.authManager.usuarioLogado.id);
            
            // Buscar dados atualizados do banco
            const response = await fetch(`${API_URL}/auth/usuarios`);
            
            if (!response.ok) {
                throw new Error('Erro ao buscar usuários');
            }
            
            const usuarios = await response.json();
            console.log('📋 Total de usuários recebidos:', usuarios.length);
            
            const usuarioAtual = usuarios.find(u => u.id === window.authManager.usuarioLogado.id);
            
            if (!usuarioAtual) {
                console.error('❌ Usuário não encontrado na lista');
                return;
            }
            
            console.log('✓ Usuário encontrado:', usuarioAtual);
            
            // Atualizar dados na sessão
            window.authManager.usuarioLogado = {
                ...window.authManager.usuarioLogado,
                nome: usuarioAtual.nome_completo || window.authManager.usuarioLogado.nome,
                telefone: usuarioAtual.telefone || '',
                cpf: usuarioAtual.cpf || '',
                logradouro: usuarioAtual.logradouro || '',
                numero: usuarioAtual.numero || '',
                complemento: usuarioAtual.complemento || '',
                bairro: usuarioAtual.bairro || '',
                cep: usuarioAtual.cep || '',
                cidade: usuarioAtual.cidade || '',
                estado: usuarioAtual.estado || ''
            };
            sessionStorage.setItem('usuario', JSON.stringify(window.authManager.usuarioLogado));
            
            const usuario = window.authManager.usuarioLogado;
            
            // Preencher dados pessoais
            const nomeInput = document.getElementById('nome');
            const emailInput = document.getElementById('email');
            const telefoneInput = document.getElementById('telefone');
            const cpfInput = document.getElementById('cpf');
            
            console.log('📝 Preenchendo campos de dados pessoais...');
            if (nomeInput) {
                nomeInput.value = usuario.nome || '';
                console.log('  - Nome:', usuario.nome);
            } else {
                console.error('  ❌ Campo nome não encontrado');
            }
            
            if (emailInput) {
                emailInput.value = usuario.email || '';
                console.log('  - Email:', usuario.email);
            } else {
                console.error('  ❌ Campo email não encontrado');
            }
            
            if (telefoneInput) {
                telefoneInput.value = usuario.telefone || '';
                console.log('  - Telefone:', usuario.telefone);
            } else {
                console.error('  ❌ Campo telefone não encontrado');
            }
            
            if (cpfInput) {
                cpfInput.value = usuario.cpf || '';
                console.log('  - CPF:', usuario.cpf);
            } else {
                console.error('  ❌ Campo CPF não encontrado');
            }

            // Preencher endereço
            console.log('🏠 Preenchendo campos de endereço...');
            console.log('  Dados do banco:', {
                logradouro: usuario.logradouro,
                numero: usuario.numero,
                complemento: usuario.complemento,
                bairro: usuario.bairro,
                cep: usuario.cep,
                cidade: usuario.cidade,
                estado: usuario.estado
            });
            
            const logradouroInput = document.getElementById('logradouro');
            const numeroInput = document.getElementById('numero');
            const complementoInput = document.getElementById('complemento');
            const bairroInput = document.getElementById('bairro');
            const cepInput = document.getElementById('cep');
            const cidadeInput = document.getElementById('cidade');
            const estadoInput = document.getElementById('estado');
            
            if (logradouroInput) {
                logradouroInput.value = usuario.logradouro || '';
                console.log('  ✅ Logradouro preenchido:', logradouroInput.value);
            } else {
                console.error('  ❌ Campo logradouro não encontrado');
            }
            
            if (numeroInput) {
                numeroInput.value = usuario.numero || '';
                console.log('  ✅ Número preenchido:', numeroInput.value);
            } else {
                console.error('  ❌ Campo numero não encontrado');
            }
            
            if (complementoInput) {
                complementoInput.value = usuario.complemento || '';
                console.log('  ✅ Complemento preenchido:', complementoInput.value);
            } else {
                console.error('  ❌ Campo complemento não encontrado');
            }
            
            if (bairroInput) {
                bairroInput.value = usuario.bairro || '';
                console.log('  ✅ Bairro preenchido:', bairroInput.value);
            } else {
                console.error('  ❌ Campo bairro não encontrado');
            }
            
            if (cepInput) {
                cepInput.value = usuario.cep || '';
                console.log('  ✅ CEP preenchido:', cepInput.value);
            } else {
                console.error('  ❌ Campo cep não encontrado');
            }
            
            if (cidadeInput) {
                cidadeInput.value = usuario.cidade || '';
                console.log('  ✅ Cidade preenchida:', cidadeInput.value);
            } else {
                console.error('  ❌ Campo cidade não encontrado');
            }
            
            if (estadoInput) {
                estadoInput.value = usuario.estado || '';
                console.log('  ✅ Estado preenchido:', estadoInput.value);
            } else {
                console.error('  ❌ Campo estado não encontrado');
            }
            
            console.log('✅ Todos os campos preenchidos com sucesso!');
            
        } catch (error) {
            console.error('❌ Erro ao carregar dados do usuário:', error);
            this.mostrarMensagem('Erro ao carregar dados. Tente novamente.', 'erro');
        }
    }

    configurarFormularios() {
        // Formulário de dados pessoais
        const formDadosPessoais = document.getElementById('formDadosPessoais');
        if (formDadosPessoais) {
            formDadosPessoais.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('Salvando dados pessoais...');
                await this.salvarDadosPessoais();
            });
            console.log('✓ Formulário de dados pessoais configurado');
        } else {
            console.error('❌ Formulário formDadosPessoais não encontrado');
        }

        // Formulário de endereço
        const formEndereco = document.getElementById('formEndereco');
        if (formEndereco) {
            formEndereco.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('🏠 Salvando endereço...');
                await this.salvarEndereco();
            });
            console.log('✓ Formulário de endereço configurado');
        } else {
            console.error('❌ Formulário formEndereco não encontrado');
        }

        // Máscaras
        this.aplicarMascaras();
    }

    aplicarMascaras() {
        // Máscara de telefone
        const telefoneInput = document.getElementById('telefone');
        telefoneInput?.addEventListener('input', (e) => {
            let valor = e.target.value.replace(/\D/g, '');
            if (valor.length <= 11) {
                valor = valor.replace(/^(\d{2})(\d)/g, '($1) $2');
                valor = valor.replace(/(\d)(\d{4})$/, '$1-$2');
            }
            e.target.value = valor;
        });

        // Máscara de CPF
        const cpfInput = document.getElementById('cpf');
        cpfInput?.addEventListener('input', (e) => {
            let valor = e.target.value.replace(/\D/g, '');
            if (valor.length <= 11) {
                valor = valor.replace(/(\d{3})(\d)/, '$1.$2');
                valor = valor.replace(/(\d{3})(\d)/, '$1.$2');
                valor = valor.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            }
            e.target.value = valor;
        });

        // Máscara de CEP
        const cepInput = document.getElementById('cep');
        cepInput?.addEventListener('input', (e) => {
            let valor = e.target.value.replace(/\D/g, '');
            if (valor.length <= 8) {
                valor = valor.replace(/(\d{5})(\d)/, '$1-$2');
            }
            e.target.value = valor;
        });
    }

    async salvarDadosPessoais() {
        const dados = {
            nome: document.getElementById('nome').value,
            telefone: document.getElementById('telefone').value,
            cpf: document.getElementById('cpf').value
        };

        try {
            const response = await fetch(`${API_URL}/auth/perfil`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    usuario_id: window.authManager.usuarioLogado.id,
                    ...dados
                })
            });

            if (!response.ok) {
                throw new Error('Erro ao atualizar dados');
            }

            // Atualizar dados no sessionStorage
            window.authManager.usuarioLogado = {
                ...window.authManager.usuarioLogado,
                ...dados
            };
            sessionStorage.setItem('usuario', JSON.stringify(window.authManager.usuarioLogado));

            this.mostrarMensagem('Dados atualizados com sucesso!', 'sucesso');
        } catch (error) {
            console.error('Erro ao salvar dados pessoais:', error);
            this.mostrarMensagem('Erro ao atualizar dados. Tente novamente.', 'erro');
        }
    }

    async salvarEndereco() {
        console.log('📝 Iniciando salvamento de endereço...');
        
        const endereco = {
            logradouro: document.getElementById('logradouro')?.value || '',
            numero: document.getElementById('numero')?.value || '',
            complemento: document.getElementById('complemento')?.value || '',
            bairro: document.getElementById('bairro')?.value || '',
            cep: document.getElementById('cep')?.value || '',
            cidade: document.getElementById('cidade')?.value || '',
            estado: document.getElementById('estado')?.value || ''
        };

        console.log('Dados do endereço:', endereco);

        try {
            console.log('Enviando requisição para API...');
            
            const response = await fetch(`${API_URL}/auth/perfil`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    usuario_id: window.authManager.usuarioLogado.id,
                    ...endereco
                })
            });

            console.log('Resposta da API:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Erro na resposta:', errorData);
                throw new Error(errorData.error || 'Erro ao atualizar endereço');
            }

            const resultado = await response.json();
            console.log('Resultado:', resultado);

            // Atualizar dados no sessionStorage
            window.authManager.usuarioLogado = {
                ...window.authManager.usuarioLogado,
                ...endereco
            };
            sessionStorage.setItem('usuario', JSON.stringify(window.authManager.usuarioLogado));

            console.log('✅ Endereço salvo com sucesso!');
            this.mostrarMensagem('Endereço atualizado com sucesso!', 'sucesso');
        } catch (error) {
            console.error('❌ Erro ao salvar endereço:', error);
            this.mostrarMensagem('Erro ao atualizar endereço. Tente novamente.', 'erro');
        }
    }

    async carregarHistoricoPedidos() {
        console.log('🛍️ === CARREGANDO HISTÓRICO DE PEDIDOS ===');
        
        const listaPedidos = document.getElementById('listaPedidos');
        
        if (!listaPedidos) {
            console.error('❌ Elemento listaPedidos não encontrado!');
            return;
        }
        
        console.log('✓ Elemento listaPedidos encontrado');
        listaPedidos.innerHTML = '<p style="text-align: center; padding: 2rem; color: #666;">⏳ Carregando pedidos...</p>';

        try {
            const clienteId = window.authManager.usuarioLogado.id;
            const url = `${API_URL}/pedidos/cliente/${clienteId}`;
            
            console.log('📡 Fazendo requisição para:', url);
            console.log('Cliente ID:', clienteId);
            
            const response = await fetch(url);
            
            console.log('📥 Response status:', response.status);
            console.log('📥 Response ok:', response.ok);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Erro na resposta:', errorText);
                throw new Error('Erro ao carregar pedidos');
            }

            const pedidos = await response.json();
            console.log('📦 Pedidos recebidos:', pedidos);
            console.log('📦 Quantidade de pedidos:', pedidos.length);

            if (!pedidos || pedidos.length === 0) {
                console.log('ℹ️ Nenhum pedido encontrado');
                listaPedidos.innerHTML = `
                    <div class="sem-pedidos">
                        <div class="sem-pedidos-icon">📦</div>
                        <p>Você ainda não fez nenhum pedido</p>
                        <small>Explore nosso catálogo e faça seu primeiro pedido!</small>
                    </div>
                `;
                return;
            }

            console.log('🎨 Renderizando pedidos...');
            const pedidosHtml = pedidos.map((pedido, index) => {
                console.log(`  Renderizando pedido ${index + 1}:`, pedido);
                return this.renderizarPedido(pedido);
            }).join('');
            
            listaPedidos.innerHTML = pedidosHtml;
            console.log('✅ Pedidos renderizados com sucesso!');

            // Adicionar evento nos botões de refazer
            const botoesRefazer = document.querySelectorAll('.btn-refazer');
            console.log(`🔘 Configurando ${botoesRefazer.length} botões de refazer`);
            
            botoesRefazer.forEach(btn => {
                btn.addEventListener('click', () => {
                    const pedidoId = parseInt(btn.dataset.pedidoId);
                    const pedido = pedidos.find(p => p.id === pedidoId);
                    console.log('🔄 Botão refazer clicado para pedido:', pedidoId);
                    this.abrirModalRefazer(pedido);
                });
            });

            console.log('✅ === HISTÓRICO CARREGADO COM SUCESSO ===');

        } catch (error) {
            console.error('❌ Erro ao carregar histórico:', error);
            console.error('Stack trace:', error.stack);
            listaPedidos.innerHTML = `
                <div class="sem-pedidos">
                    <p>❌ Erro ao carregar pedidos</p>
                    <small>${error.message}</small>
                </div>
            `;
        }
    }

    renderizarPedido(pedido) {
        console.log('Renderizando pedido:', pedido);
        
        const data = new Date(pedido.created_at).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const statusClass = pedido.status.toLowerCase();
        const statusLabel = {
            'pendente': 'Pendente',
            'em_preparacao': 'Em Preparação',
            'em_rota_entrega': 'Em Rota de Entrega',
            'aguardando_pagamento': 'Aguardando Pagamento',
            'finalizado': 'Finalizado',
            'confirmado': 'Confirmado',
            'enviado': 'Enviado',
            'entregue': 'Entregue',
            'cancelado': 'Cancelado'
        }[pedido.status.toLowerCase()] || pedido.status;

        const itensHtml = (pedido.itens && pedido.itens.length > 0) 
            ? pedido.itens.map(item => {
                const subtotal = parseFloat(item.subtotal) || 0;
                const quantidade = parseInt(item.quantidade) || 0;
                return `
                    <div class="produto-item">
                        <div>
                            <div class="produto-nome">${item.vinho_nome}</div>
                            <div class="produto-quantidade">${quantidade}x</div>
                        </div>
                        <div class="produto-preco">R$ ${subtotal.toFixed(2).replace('.', ',')}</div>
                    </div>
                `;
            }).join('')
            : '<p>Nenhum item encontrado</p>';

        const total = parseFloat(pedido.total) || 0;

        return `
            <div class="pedido-item">
                <div class="pedido-item-header">
                    <div class="pedido-info">
                        <div class="pedido-numero">Pedido #${pedido.id}</div>
                        <div class="pedido-data">${data}</div>
                        <span class="status-badge ${statusClass}">${statusLabel}</span>
                    </div>
                    <div class="pedido-acoes">
                        <button class="btn-refazer" data-pedido-id="${pedido.id}">
                            🔄 Pedir Novamente
                        </button>
                    </div>
                </div>
                <div class="pedido-item-body">
                    <div class="pedido-produtos">
                        <h4>Itens do Pedido:</h4>
                        ${itensHtml}
                    </div>
                    <div class="pedido-resumo">
                        <div class="resumo-linha total">
                            <span>Total</span>
                            <span>R$ ${total.toFixed(2).replace('.', ',')}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    configurarModal() {
        const modal = document.getElementById('modalConfirmacao');
        const btnCancelar = document.getElementById('btnCancelarRefazer');
        const btnConfirmar = document.getElementById('btnConfirmarRefazer');

        btnCancelar.addEventListener('click', () => {
            modal.style.display = 'none';
            this.pedidoParaRefazer = null;
        });

        btnConfirmar.addEventListener('click', () => {
            modal.style.display = 'none';
            this.refazerPedido(this.pedidoParaRefazer);
        });

        // Fechar ao clicar fora
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                this.pedidoParaRefazer = null;
            }
        });
    }

    abrirModalRefazer(pedido) {
        this.pedidoParaRefazer = pedido;
        document.getElementById('modalConfirmacao').style.display = 'flex';
    }

    async refazerPedido(pedido) {
        try {
            console.log('🔄 Iniciando processo de pedir novamente...');
            console.log('📦 Pedido a ser repetido:', pedido);

            // Verificar se o carrinhoManager existe
            if (!window.carrinhoManager) {
                console.error('❌ carrinhoManager não encontrado');
                this.mostrarMensagem('Erro: Sistema de carrinho não disponível.', 'erro');
                return;
            }

            // Limpar o carrinho atual
            console.log('🗑️ Limpando carrinho atual...');
            window.carrinhoManager.carrinho = [];
            window.carrinhoManager.salvarCarrinho();

            // Adicionar cada item do pedido ao carrinho
            console.log('➕ Adicionando itens ao carrinho...');
            let itensAdicionados = 0;
            
            for (const item of pedido.itens) {
                // Buscar informações completas do vinho
                try {
                    const response = await fetch(`${API_URL}/vinhos/${item.vinho_id}`);
                    if (response.ok) {
                        const vinho = await response.json();
                        console.log(`  ✅ Vinho encontrado: ${vinho.nome}`);
                        
                        // Adicionar ao carrinho a quantidade especificada
                        // Adicionar item à lista diretamente com a quantidade
                        const itemCarrinho = {
                            id: vinho.id,
                            nome: vinho.nome,
                            preco: parseFloat(vinho.preco),
                            imagem: vinho.imagem,
                            tipo: vinho.tipo,
                            quantidade: item.quantidade
                        };
                        
                        // Verificar se já existe no carrinho
                        const existente = window.carrinhoManager.itens.find(i => i.id === vinho.id);
                        if (existente) {
                            existente.quantidade += item.quantidade;
                        } else {
                            window.carrinhoManager.itens.push(itemCarrinho);
                        }
                        
                        itensAdicionados++;
                    } else {
                        console.warn(`  ⚠️ Vinho ${item.vinho_nome} (ID: ${item.vinho_id}) não encontrado no catálogo`);
                        // Se o vinho não existir mais, adicionar com dados do pedido antigo
                        const itemCarrinho = {
                            id: item.vinho_id,
                            nome: item.vinho_nome,
                            preco: parseFloat(item.preco_unitario),
                            imagem: '/img/vinho-default.jpg',
                            tipo: 'Não disponível',
                            quantidade: item.quantidade
                        };
                        
                        const existente = window.carrinhoManager.itens.find(i => i.id === item.vinho_id);
                        if (existente) {
                            existente.quantidade += item.quantidade;
                        } else {
                            window.carrinhoManager.itens.push(itemCarrinho);
                        }
                        
                        itensAdicionados++;
                    }
                } catch (error) {
                    console.error(`  ❌ Erro ao buscar vinho ${item.vinho_nome}:`, error);
                    // Em caso de erro, adicionar com dados do pedido antigo
                    const itemCarrinho = {
                        id: item.vinho_id,
                        nome: item.vinho_nome,
                        preco: parseFloat(item.preco_unitario),
                        imagem: '/img/vinho-default.jpg',
                        tipo: 'Não disponível',
                        quantidade: item.quantidade
                    };
                    
                    const existente = window.carrinhoManager.itens.find(i => i.id === item.vinho_id);
                    if (existente) {
                        existente.quantidade += item.quantidade;
                    } else {
                        window.carrinhoManager.itens.push(itemCarrinho);
                    }
                    
                    itensAdicionados++;
                }
            }
            
            // Salvar o carrinho após adicionar todos os itens
            window.carrinhoManager.salvarCarrinho();

            console.log(`✅ ${itensAdicionados} itens adicionados ao carrinho`);

            // Salvar e atualizar a interface do carrinho
            window.carrinhoManager.salvarCarrinho();
            window.carrinhoManager.renderizarCarrinho();
            
            // Atualizar o contador do carrinho
            if (window.carrinhoManager.atualizarContador) {
                window.carrinhoManager.atualizarContador();
            }

            // Mostrar mensagem de sucesso
            this.mostrarMensagem(`${itensAdicionados} ${itensAdicionados === 1 ? 'produto adicionado' : 'produtos adicionados'} ao carrinho!`, 'sucesso');

            // Abrir o carrinho automaticamente após 500ms
            setTimeout(() => {
                console.log('🛒 Abrindo carrinho...');
                window.carrinhoManager.abrirCarrinho();
            }, 500);

        } catch (error) {
            console.error('❌ Erro ao refazer pedido:', error);
            this.mostrarMensagem('Erro ao adicionar produtos ao carrinho. Tente novamente.', 'erro');
        }
    }

    mostrarMensagem(texto, tipo = 'info') {
        const mensagemDiv = document.getElementById('mensagem');
        if (mensagemDiv) {
            mensagemDiv.textContent = texto;
            mensagemDiv.className = `mensagem ${tipo}`;
            mensagemDiv.style.display = 'block';

            setTimeout(() => {
                mensagemDiv.style.display = 'none';
            }, 4000);
        }
    }
}

// Inicializar quando carregar a página
console.log('=== Script perfil.js carregado ===');
console.log('Estado do documento:', document.readyState);

let perfilManager;

function inicializarPerfil() {
    console.log('Função inicializarPerfil chamada');
    try {
        perfilManager = new PerfilManager();
        perfilManager.init();
    } catch (error) {
        console.error('Erro ao inicializar PerfilManager:', error);
        alert('Erro ao carregar a página. Por favor, recarregue.');
    }
}

// Aguardar carregamento completo
if (document.readyState === 'loading') {
    console.log('Aguardando DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', inicializarPerfil);
} else {
    console.log('DOM já carregado, inicializando imediatamente...');
    // Aguardar um pouco para garantir que todos os scripts foram carregados
    setTimeout(inicializarPerfil, 100);
}

