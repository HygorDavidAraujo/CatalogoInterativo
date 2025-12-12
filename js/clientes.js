// ===== CARREGAR CLIENTES =====
async function carregarClientes() {
    try {
        console.log('Carregando clientes...');
        
        const response = await fetch(`${API_URL}/auth/usuarios`);
        
        if (!response.ok) {
            throw new Error('Erro ao carregar clientes');
        }
        
        const usuarios = await response.json();
        console.log('Usuários recebidos:', usuarios.length);
        
        todosClientes = usuarios;
        renderizarClientes(usuarios);
        atualizarEstatisticas(usuarios);
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        document.getElementById('lista-clientes').innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: #f44336;">
                    <i class="fas fa-exclamation-triangle"></i> Erro ao carregar clientes
                </td>
            </tr>
        `;
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

    tbody.innerHTML = usuarios.map(usuario => {
        const dataCadastro = usuario.created_at ? 
            new Date(usuario.created_at).toLocaleDateString('pt-BR') : 
            'N/A';
        const isAdmin = usuario.is_admin ? 
            '<i class="fas fa-check" style="color: #4caf50;"></i>' : 
            '-';
        
        return `
            <tr>
                <td>${usuario.id}</td>
                <td><strong>${usuario.nome_completo || '-'}</strong></td>
                <td>${usuario.email}</td>
                <td>${usuario.telefone || '-'}</td>
                <td>${dataCadastro}</td>
                <td style="text-align: center;"><span class="badge-pedidos" id="pedidos-${usuario.id}">-</span></td>
                <td style="text-align: center;">${isAdmin}</td>
                <td style="text-align: center;">
                    <button class="btn-icon btn-visualizar" onclick="abrirModalCliente(${usuario.id})" title="Ver detalhes">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon btn-editar" onclick="abrirModalEditar(${usuario.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    // Carregar quantidade de pedidos para cada cliente
    usuarios.forEach(usuario => {
        carregarQuantidadePedidos(usuario.id);
    });
}

async function carregarQuantidadePedidos(clienteId) {
    try {
        const response = await fetch(`${API_URL}/pedidos/cliente/${clienteId}`);
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
        const cliente = todosClientes.find(c => c.id === clienteId);
        
        // Buscar histórico de pedidos
        const response = await fetch(`${API_URL}/pedidos/cliente/${clienteId}`);
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
    const statusOptions = [
        { valor: 'pendente', label: 'Pendente' },
        { valor: 'em_preparacao', label: 'Em Preparação' },
        { valor: 'em_rota_entrega', label: 'Em Rota de Entrega' },
        { valor: 'aguardando_pagamento', label: 'Aguardando Pagamento' },
        { valor: 'finalizado', label: 'Finalizado' }
    ];

    const statusClass = {
        'pendente': 'status-pendente',
        'em_preparacao': 'status-preparacao',
        'em_rota_entrega': 'status-rota',
        'aguardando_pagamento': 'status-pagamento',
        'finalizado': 'status-finalizado',
        'confirmado': 'status-confirmado',
        'entregue': 'status-entregue',
        'cancelado': 'status-cancelado'
    }[pedido.status] || 'status-pendente';

    const statusLabel = {
        'pendente': 'Pendente',
        'em_preparacao': 'Em Preparação',
        'em_rota_entrega': 'Em Rota de Entrega',
        'aguardando_pagamento': 'Aguardando Pagamento',
        'finalizado': 'Finalizado',
        'confirmado': 'Confirmado',
        'entregue': 'Entregue',
        'cancelado': 'Cancelado'
    }[pedido.status] || pedido.status;

    return `
        <div class="pedido-card">
            <div class="pedido-header">
                <div class="pedido-info">
                    <span class="pedido-id">#${pedido.id}</span>
                    <span class="pedido-data">${new Date(pedido.created_at).toLocaleString('pt-BR')}</span>
                </div>
                <div class="pedido-status-container">
                    <select class="pedido-status-select ${statusClass}" 
                            data-pedido-id="${pedido.id}"
                            onchange="alterarStatusPedido(${pedido.id}, this.value)">
                        ${statusOptions.map(opt => `
                            <option value="${opt.valor}" ${pedido.status === opt.valor ? 'selected' : ''}>
                                ${opt.label}
                            </option>
                        `).join('')}
                    </select>
                </div>
            </div>
            <div class="pedido-itens">
                ${pedido.itens.map(item => `
                    <div class="pedido-item">
                        <span>${item.quantidade}x ${item.vinho_nome}</span>
                        <span>R$ ${parseFloat(item.subtotal).toFixed(2).replace('.', ',')}</span>
                    </div>
                `).join('')}
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
function abrirModalEditar(clienteId) {
    const cliente = todosClientes.find(c => c.id === clienteId);
    if (!cliente) return;

    const modal = document.getElementById('modal-editar-cliente');
    
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

    modal.style.display = 'block';
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
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const usuarioId = document.getElementById('edit-usuario-id').value;
        
        const dados = {
            usuario_id: parseInt(usuarioId),
            nome: document.getElementById('edit-nome').value.trim(),
            telefone: document.getElementById('edit-telefone').value.trim(),
            cpf: document.getElementById('edit-cpf').value.trim(),
            logradouro: document.getElementById('edit-logradouro').value.trim(),
            numero: document.getElementById('edit-numero').value.trim(),
            complemento: document.getElementById('edit-complemento').value.trim(),
            bairro: document.getElementById('edit-bairro').value.trim(),
            cep: document.getElementById('edit-cep').value.trim(),
            cidade: document.getElementById('edit-cidade').value.trim(),
            estado: document.getElementById('edit-estado').value.trim(),
            is_admin: document.getElementById('edit-is-admin').checked
        };

        try {
            const response = await fetch(`${API_URL}/auth/usuarios/${usuarioId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dados)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro ao atualizar cliente');
            }

            mostrarMensagem('Cliente atualizado com sucesso!', 'sucesso');
            fecharModalEditar();
            await carregarClientes();
        } catch (error) {
            console.error('Erro ao salvar:', error);
            mostrarMensagem(error.message, 'erro');
        }
    });
}

function mostrarMensagem(texto, tipo) {
    // Remover mensagens anteriores
    const mensagensAnteriores = document.querySelectorAll('.toast-message');
    mensagensAnteriores.forEach(msg => msg.remove());

    // Criar nova mensagem
    const mensagem = document.createElement('div');
    mensagem.className = `toast-message toast-${tipo}`;
    mensagem.innerHTML = `
        <i class="fas fa-${tipo === 'sucesso' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${texto}</span>
    `;

    document.body.appendChild(mensagem);

    // Remover após 4 segundos
    setTimeout(() => {
        mensagem.classList.add('fade-out');
        setTimeout(() => mensagem.remove(), 300);
    }, 4000);
}

// ===== ALTERAR STATUS DO PEDIDO =====
async function alterarStatusPedido(pedidoId, novoStatus) {
    try {
        const response = await fetch(`${API_URL}/pedidos/${pedidoId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: novoStatus })
        });

        if (!response.ok) {
            throw new Error('Erro ao atualizar status');
        }

        const result = await response.json();
        mostrarMensagem('Status do pedido atualizado com sucesso!', 'sucesso');
        
        // Recarregar os dados do cliente para atualizar a exibição
        const clienteId = parseInt(document.querySelector('.modal-cliente-detalhes').getAttribute('data-cliente-id') || 0);
        if (clienteId > 0) {
            abrirModalCliente(clienteId);
        }
    } catch (error) {
        console.error('Erro ao alterar status:', error);
        mostrarMensagem('Erro ao atualizar status do pedido', 'erro');
    }
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    carregarClientes();
    configurarFiltros();
    configurarTabsEditar();
    configurarFormEditar();
    
    // Fechar modal ao clicar fora
    window.onclick = (e) => {
        const modal = document.getElementById('modal-cliente');
        const modalEditar = document.getElementById('modal-editar-cliente');
        
        if (e.target === modal) {
            fecharModalCliente();
        }
        if (e.target === modalEditar) {
            fecharModalEditar();
        }
    };
});
