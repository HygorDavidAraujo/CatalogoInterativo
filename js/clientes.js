// ===== CARREGAR CLIENTES =====
let clientesCarregados = false;
let consultaClientes = null;
function carregarClientes() {
    if (!consultaClientes) {
        consultaClientes = buscarClientes().finally(() => { consultaClientes = null; });
    }
    return consultaClientes;
}

async function buscarClientes() {
    try {
        console.log('Carregando clientes...');
        
        const response = await fetch(`${API_URL}/auth/usuarios`, {
            headers: (typeof obterHeadersComAutenticacao === 'function') 
                ? obterHeadersComAutenticacao() 
                : { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.authManager?.obterToken?.() || localStorage.getItem('jwt_token') || ''}` }
        });
        
        if (!response.ok) {
            throw new Error('Erro ao carregar clientes');
        }
        
        const usuarios = await response.json();
        console.log('Usuários recebidos:', usuarios.length);
        
        todosClientes = usuarios;
        clientesCarregados = true;
        filtrarClientes(document.getElementById('filtro-busca')?.value?.toLowerCase() || '');
        atualizarEstatisticas(usuarios);
        const clienteSolicitado = window.RenderSeguro.id(new URLSearchParams(window.location.search).get('cliente'));
        if (clienteSolicitado && usuarios.some(cliente => Number(cliente.id) === clienteSolicitado)) {
            await abrirModalCliente(clienteSolicitado);
        }
        return true;
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        document.getElementById('lista-clientes').innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: #f44336;">
                    <i class="fas fa-exclamation-triangle"></i> Erro ao carregar clientes
                </td>
            </tr>
        `;
        return false;
    }
}

function atualizarEstatisticas(usuarios) {
    const totalClientes = document.getElementById('total-clientes');
    if (totalClientes) {
        totalClientes.textContent = usuarios.length;
    }
}

function renderizarClientes(usuarios) {
    const tbody = document.getElementById('lista-clientes');
    
    if (usuarios.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center;">
                    <i class="fas fa-info-circle"></i> Nenhum cliente cadastrado
                </td>
            </tr>
        `;
        return;
    }

    const headers = ['ID', 'Nome', 'Email', 'Telefone', 'Cadastro', 'Pedidos', 'Admin', 'Ações'];
    tbody.innerHTML = usuarios.map(original => {
        const usuario = window.RenderSeguro.dados(original);
        const dataCadastro = usuario.created_at ? 
            new Date(usuario.created_at).toLocaleDateString('pt-BR') : 
            'N/A';
        const isAdmin = usuario.is_admin ? 
            '<i class="fas fa-check" style="color: #4caf50;"></i>' : 
            '-';
        
        return `
            <tr data-cliente-id="${usuario.id}">
                <td data-label="${headers[0]}">${usuario.id}</td>
                <td data-label="${headers[1]}"><strong>${usuario.nome_completo || '-'}</strong></td>
                <td data-label="${headers[2]}">${usuario.email}</td>
                <td data-label="${headers[3]}">${usuario.telefone || '-'}</td>
                <td data-label="${headers[4]}">${dataCadastro}</td>
                <td data-label="${headers[5]}" style="text-align: center;"><span class="badge-pedidos" id="pedidos-${usuario.id}">-</span></td>
                <td data-label="${headers[6]}" style="text-align: center;">${isAdmin}</td>
                <td data-label="${headers[7]}" style="text-align: center;">
                    <button class="btn-icon btn-visualizar" data-cliente-acao="visualizar" title="Ver detalhes">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon btn-editar" data-cliente-acao="editar" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    tbody.querySelectorAll('[data-cliente-acao]').forEach(button => {
        button.addEventListener('click', () => {
            const id = window.RenderSeguro.id(button.closest('[data-cliente-id]').dataset.clienteId);
            if (!id) return;
            if (button.dataset.clienteAcao === 'visualizar') abrirModalCliente(id);
            else abrirModalEditar(id);
        });
    });
    
    // Carregar quantidade de pedidos para cada cliente
    usuarios.forEach(usuario => {
        carregarQuantidadePedidos(usuario.id);
    });
}

async function carregarQuantidadePedidos(clienteId) {
    try {
        const response = await fetch(`${API_URL}/pedidos/cliente/${clienteId}`, {
            headers: (typeof obterHeadersComAutenticacao === 'function') 
                ? obterHeadersComAutenticacao() 
                : { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.authManager?.obterToken?.() || localStorage.getItem('jwt_token') || ''}` }
        });
        if (response.ok) {
            const pedidos = await response.json();
            const badge = document.getElementById(`pedidos-${clienteId}`);
            if (badge) {
                badge.textContent = pedidos.length;
                badge.style.color = pedidos.length > 0 ? 'var(--cor-primaria)' : '#999';
                badge.style.fontWeight = pedidos.length > 0 ? 'bold' : 'normal';
            }
        }
    } catch (error) {
        console.error(`Erro ao carregar pedidos do cliente ${clienteId}:`, error);
    }
}

// ===== VARIÁVEIS GLOBAIS =====
let todosClientes = [];

// ===== FILTROS =====
function configurarFiltros() {
    const inputBusca = document.getElementById('filtro-busca');
    
    if (inputBusca) {
        inputBusca.addEventListener('input', (e) => {
            const termo = e.target.value.toLowerCase();
            filtrarClientes(termo);
        });
    }
}

function filtrarClientes(termo) {
    if (!termo) {
        renderizarClientes(todosClientes);
        return;
    }

    const clientesFiltrados = todosClientes.filter(cliente => {
        const nome = (cliente.nome_completo || '').toLowerCase();
        const email = (cliente.email || '').toLowerCase();
        const telefone = (cliente.telefone || '').toLowerCase();
        
        return nome.includes(termo) || 
               email.includes(termo) || 
               telefone.includes(termo);
    });

    renderizarClientes(clientesFiltrados);
}

function limparFiltros() {
    const inputBusca = document.getElementById('filtro-busca');
    if (inputBusca) inputBusca.value = '';
    renderizarClientes(todosClientes);
}

// ===== MODAL DE DETALHES =====
async function abrirModalCliente(clienteId) {
    const modal = document.getElementById('modal-cliente');
    const modalBody = document.getElementById('modal-cliente-body');
    const modalContent = document.querySelector('.modal-cliente-detalhes');
    
    modal.style.display = 'block';
    modalContent.setAttribute('data-cliente-id', clienteId);
    modalBody.innerHTML = '<div style="text-align: center; padding: 2rem;"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';

    try {
        // Buscar dados do cliente
        const cliente = window.RenderSeguro.dados(todosClientes.find(c => c.id === clienteId));
        
        // Buscar histórico de pedidos
        const response = await fetch(`${API_URL}/pedidos/cliente/${clienteId}`, {
            headers: (typeof obterHeadersComAutenticacao === 'function')
                ? obterHeadersComAutenticacao()
                : { 'Content-Type': 'application/json' }
        });
        const pedidos = response.ok ? await response.json() : [];

        console.log('Pedidos do cliente:', pedidos);

        // Renderizar detalhes
        modalBody.innerHTML = `
            <div class="cliente-info-grid">
                <div class="info-section">
                    <h3><i class="fas fa-user"></i> Informações Pessoais</h3>
                    <div class="info-item">
                        <label>Nome Completo:</label>
                        <span>${cliente.nome_completo}</span>
                    </div>
                    <div class="info-item">
                        <label>E-mail:</label>
                        <span>${cliente.email}</span>
                    </div>
                    <div class="info-item">
                        <label>Telefone:</label>
                        <span>${cliente.telefone || 'Não informado'}</span>
                    </div>
                    <div class="info-item">
                        <label>Cadastrado em:</label>
                        <span>${new Date(cliente.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                    <div class="info-item">
                        <label>Tipo:</label>
                        <span class="badge ${cliente.is_admin ? 'badge-admin' : 'badge-cliente'}">
                            ${cliente.is_admin ? 'Administrador' : 'Cliente'}
                        </span>
                    </div>
                </div>

                <div class="info-section">
                    <h3><i class="fas fa-chart-line"></i> Estatísticas</h3>
                    <div class="stats-grid">
                        <div class="stat-card">
                            <i class="fas fa-shopping-cart"></i>
                            <div class="stat-value">${pedidos.length}</div>
                            <div class="stat-label">Pedidos</div>
                        </div>
                        <div class="stat-card">
                            <i class="fas fa-dollar-sign"></i>
                            <div class="stat-value">R$ ${calcularTotalGasto(pedidos)}</div>
                            <div class="stat-label">Total Gasto</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="historico-section">
                <h3><i class="fas fa-history"></i> Histórico de Pedidos</h3>
                ${pedidos.length === 0 ? `
                    <div class="sem-pedidos">
                        <i class="fas fa-inbox"></i>
                        <p>Este cliente ainda não realizou nenhum pedido.</p>
                    </div>
                ` : `
                    <div class="pedidos-lista">
                        ${pedidos.map(pedido => renderizarPedido(pedido)).join('')}
                    </div>
                `}
            </div>
        `;
        modalBody.querySelectorAll('.pedido-status-select').forEach(select => {
            select.addEventListener('change', () => {
                const id = window.RenderSeguro.id(select.dataset.pedidoId);
                if (id) alterarStatusPedido(id, select.value);
            });
        });
        modalBody.querySelectorAll('[data-pedido-no-painel]').forEach(link => {
            link.addEventListener('click', event => {
                const id = window.RenderSeguro.id(link.dataset.pedidoNoPainel);
                if (!id || !window.pedidosAdmin) return;
                event.preventDefault();
                fecharModalCliente();
                window.pedidosAdmin.abrir(id);
            });
        });
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        modalBody.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #f44336;">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Erro ao carregar detalhes do cliente</p>
            </div>
        `;
    }
}

function fecharModalCliente() {
    const modal = document.getElementById('modal-cliente');
    modal.style.display = 'none';
}

function calcularTotalGasto(pedidos) {
    const total = pedidos.reduce((sum, pedido) => sum + parseFloat(pedido.total), 0);
    return total.toFixed(2).replace('.', ',');
}

function renderizarPedido(pedido) {
    pedido = window.RenderSeguro.dados(pedido);
    const statusOptions = window.PedidoStatus.opcoes;
    const statusAtual = window.PedidoStatus.obter(pedido.status);

    return `
        <div class="pedido-card">
            <div class="pedido-header">
                <div class="pedido-info">
                    <span class="pedido-id">#${pedido.id}</span>
                    <a href="admin.html?pedido=${pedido.id}#pedidos-recebidos" data-pedido-no-painel="${pedido.id}">Abrir no painel de pedidos</a>
                    <span class="pedido-data">${new Date(pedido.created_at).toLocaleString('pt-BR')}</span>
                </div>
                <div class="pedido-status-container">
                    <select class="pedido-status-select ${statusAtual.classe}"
                            data-pedido-id="${pedido.id}"
                            data-status-atual="${statusAtual.valor}"
                            aria-label="Status do pedido #${pedido.id}">
                        ${!statusAtual.valor ? '<option value="" disabled selected>Status não reconhecido</option>' : ''}
                        ${statusOptions.map(opt => `
                            <option value="${opt.valor}" ${statusAtual.valor === opt.valor ? 'selected' : ''}>
                                ${opt.label}
                            </option>
                        `).join('')}
                    </select>
                </div>
            </div>
            <div class="pedido-itens">
                ${pedido.itens.map(item => {
                    const precoUnitario = parseFloat(item.preco_unitario || 0);
                    const subtotal = parseFloat(item.subtotal || 0);
                    const quantidade = parseInt(item.quantidade || 0);
                    
                    return `
                        <div class="pedido-item">
                            <span>${quantidade}x ${item.vinho_nome}</span>
                            <span>R$ ${precoUnitario.toFixed(2).replace('.', ',')} cada = R$ ${subtotal.toFixed(2).replace('.', ',')}</span>
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="pedido-total">
                <strong>Total:</strong>
                <strong>R$ ${parseFloat(pedido.total).toFixed(2).replace('.', ',')}</strong>
            </div>
            ${pedido.observacoes ? `
                <div class="pedido-obs">
                    <i class="fas fa-comment"></i> ${pedido.observacoes}
                </div>
            ` : ''}
        </div>
    `;
}

// ===== MODAL DE EDIÇÃO =====
async function abrirModalEditar(clienteId) {
    const cliente = todosClientes.find(c => c.id === clienteId);
    if (!cliente) return;

    const modal = document.getElementById('modal-editar-cliente');
    
    // Carregar benefícios VIP e atualizar select dinamicamente
    await carregarBeneficiosVipSelect();
    
    // Preencher formulário
    document.getElementById('edit-usuario-id').value = cliente.id;
    document.getElementById('edit-nome').value = cliente.nome_completo || '';
    document.getElementById('edit-email').value = cliente.email || '';
    document.getElementById('edit-telefone').value = cliente.telefone || '';
    document.getElementById('edit-cpf').value = cliente.cpf || '';
    document.getElementById('edit-logradouro').value = cliente.logradouro || '';
    document.getElementById('edit-numero').value = cliente.numero || '';
    document.getElementById('edit-complemento').value = cliente.complemento || '';
    document.getElementById('edit-bairro').value = cliente.bairro || '';
    document.getElementById('edit-cep').value = cliente.cep || '';
    document.getElementById('edit-cidade').value = cliente.cidade || '';
    document.getElementById('edit-estado').value = cliente.estado || '';
    document.getElementById('edit-is-admin').checked = cliente.is_admin === 1 || cliente.is_admin === true;
    document.getElementById('edit-is-vip').checked = cliente.is_vip === 1 || cliente.is_vip === true;
    document.getElementById('edit-vip-tipo').value = cliente.vip_tipo || '';

    modal.style.display = 'block';
}

async function carregarBeneficiosVipSelect() {
    try {
        // Carregar benefícios via VipManager
        await window.vipManager.carregar();
        const beneficios = window.vipManager.beneficios;
        
        // Atualizar select
        const select = document.getElementById('edit-vip-tipo');
        if (!select) return;
        
        select.innerHTML = '<option value="">Selecione...</option>';
        
        beneficios.forEach(beneficio => {
            const option = document.createElement('option');
            option.value = beneficio.slug;
            
            // Formatar descrição do benefício
            let descricao = beneficio.nome;
            if (beneficio.tipo_desconto === 'percentual') {
                descricao += ` - ${beneficio.valor_desconto}% desconto`;
            } else if (beneficio.tipo_desconto === 'valor_fixo') {
                descricao += ` - R$ ${Number(beneficio.valor_desconto).toFixed(2).replace('.', ',')} desconto`;
            }
            
            option.textContent = descricao;
            select.appendChild(option);
        });
        
        console.log('✓ Select VIP atualizado com benefícios dinâmicos');
    } catch (error) {
        console.error('Erro ao carregar benefícios VIP para select:', error);
    }
}

function fecharModalEditar() {
    const modal = document.getElementById('modal-editar-cliente');
    modal.style.display = 'none';
}

// Configurar tabs do modal de edição
function configurarTabsEditar() {
    const tabButtons = document.querySelectorAll('.tab-btn-edit');
    const tabContents = document.querySelectorAll('.tab-content-edit');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');

            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// Configurar formulário de edição
function configurarFormEditar() {
    const form = document.getElementById('form-editar-cliente');
    if (!form || form.dataset.configurado === 'true') return;
    form.dataset.configurado = 'true';

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (form.dataset.salvando === 'true') return;

        const usuarioId = document.getElementById('edit-usuario-id').value;
        
        const usuarioSalvo = sessionStorage.getItem('usuario');
        let isAdmin = false;
        if (usuarioSalvo) {
            const usuario = JSON.parse(usuarioSalvo);
            isAdmin = usuario.isAdmin === true;
        }
        const dados = {
            usuario_id: parseInt(usuarioId),
            nome: document.getElementById('edit-nome').value.trim(),
            telefone: document.getElementById('edit-telefone').value.trim(),
            cpf: document.getElementById('edit-cpf').value.trim() || null,
            logradouro: document.getElementById('edit-logradouro').value.trim(),
            numero: document.getElementById('edit-numero').value.trim(),
            complemento: document.getElementById('edit-complemento').value.trim(),
            bairro: document.getElementById('edit-bairro').value.trim(),
            cep: document.getElementById('edit-cep').value.trim(),
            cidade: document.getElementById('edit-cidade').value.trim(),
            estado: document.getElementById('edit-estado').value.trim(),
            is_admin: document.getElementById('edit-is-admin').checked
        };
        // Só admin pode editar VIP
        if (isAdmin) {
            dados.is_vip = document.getElementById('edit-is-vip').checked;
            dados.vip_tipo = document.getElementById('edit-vip-tipo').value;
        }

        const botaoSalvar = form.querySelector('button[type="submit"]');
        form.dataset.salvando = 'true';
        if (botaoSalvar) botaoSalvar.disabled = true;
        try {
            const response = await fetch(`${API_URL}/auth/usuarios/${usuarioId}`, {
                method: 'PUT',
                headers: (typeof obterHeadersComAutenticacao === 'function')
                    ? obterHeadersComAutenticacao()
                    : { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.authManager?.obterToken?.() || localStorage.getItem('jwt_token') || ''}` },
                body: JSON.stringify(dados)
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                const campos = { nome: 'Nome', telefone: 'Telefone', cpf: 'CPF', logradouro: 'Logradouro',
                    numero: 'Número', complemento: 'Complemento', bairro: 'Bairro', cep: 'CEP', cidade: 'Cidade', estado: 'Estado', vip_tipo: 'Tipo VIP' };
                const detalhes = Array.isArray(error.details) ? error.details.map(item => `${campos[item.field] || 'Campo'}: ${item.message}`).join('; ') : '';
                throw new Error(detalhes || error.error || 'Erro ao atualizar cliente. Tente novamente.');
            }

            mostrarMensagem('Cliente atualizado com sucesso!', 'sucesso');
            fecharModalEditar();
            await carregarClientes();
        } catch (error) {
            console.error('Erro ao salvar:', error);
            mostrarMensagem(error.message, 'erro');
        } finally {
            form.dataset.salvando = 'false';
            if (botaoSalvar) botaoSalvar.disabled = false;
        }
    });
}

// ===== ALTERAR STATUS DO PEDIDO =====
async function alterarStatusPedido(pedidoId, novoStatus) {
    const select = document.querySelector(`.pedido-status-select[data-pedido-id="${pedidoId}"]`);
    if (select?.disabled) return;
    const statusAnterior = select?.dataset.statusAtual || '';
    if (select) select.disabled = true;
    try {
        const response = await fetch(`${API_URL}/pedidos/${pedidoId}/status`, {
            method: 'PUT',
            headers: (typeof obterHeadersComAutenticacao === 'function')
                ? obterHeadersComAutenticacao()
                : { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.authManager?.obterToken?.() || localStorage.getItem('jwt_token') || ''}` },
            body: JSON.stringify({ status: window.PedidoStatus.normalizar(novoStatus) })
        });

        if (!response.ok) {
            const erro = await response.json().catch(() => ({}));
            throw new Error(erro.error || 'Erro ao atualizar status do pedido');
        }

        const result = await response.json();
        const statusSalvo = window.PedidoStatus.obter(result.status || novoStatus);
        if (!statusSalvo.valor) throw new Error('Não foi possível confirmar o status do pedido');
        if (select) {
            select.value = statusSalvo.valor;
            select.dataset.statusAtual = statusSalvo.valor;
            select.className = `pedido-status-select ${statusSalvo.classe}`;
        }
        mostrarMensagem('Status do pedido atualizado com sucesso!', 'sucesso');
        return true;
    } catch (error) {
        if (select) {
            select.value = statusAnterior;
            select.className = `pedido-status-select ${window.PedidoStatus.obter(statusAnterior).classe}`;
        }
        console.error('Erro ao alterar status:', error);
        mostrarMensagem(error.message || 'Erro ao atualizar status do pedido', 'erro');
        return false;
    } finally {
        if (select) select.disabled = false;
    }
}

// ===== INICIALIZAÇÃO =====
window.clientesPainel = {
    async abrir(id) {
        id = window.RenderSeguro.id(id);
        if (!id) return;
        window.painelAdmin?.abrir('clientes');
        const carregou = clientesCarregados || await carregarClientes();
        if (!carregou) return;
        if (!todosClientes.some(cliente => Number(cliente.id) === id)) {
            mostrarMensagem('Cliente não encontrado.', 'erro');
            return;
        }
        await abrirModalCliente(id);
    }
};
document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('lista-clientes')) return;
    document.querySelectorAll('[data-clientes-limpar]').forEach(button => button.addEventListener('click', limparFiltros));
    document.querySelectorAll('[data-fechar-cliente]').forEach(button => button.addEventListener('click', fecharModalCliente));
    document.querySelectorAll('[data-fechar-editar]').forEach(button => button.addEventListener('click', fecharModalEditar));
    if (!window.painelAdmin || !document.getElementById('clientes')?.hidden) carregarClientes();
    window.addEventListener('painel:secao', event => {
        if (event.detail.secao === 'clientes' && !clientesCarregados) carregarClientes();
    });
    configurarFiltros();
    configurarTabsEditar();
    configurarFormEditar();
    
    // Fechar modal ao clicar fora
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('modal-cliente');
        const modalEditar = document.getElementById('modal-editar-cliente');
        
        if (e.target === modal) {
            fecharModalCliente();
        }
        if (e.target === modalEditar) {
            fecharModalEditar();
        }
    });
});
