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
    
    modal.style.display = 'block';
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
    const statusClass = {
        'pendente': 'status-pendente',
        'confirmado': 'status-confirmado',
        'entregue': 'status-entregue',
        'cancelado': 'status-cancelado'
    }[pedido.status] || 'status-pendente';

    return `
        <div class="pedido-card">
            <div class="pedido-header">
                <div class="pedido-info">
                    <span class="pedido-id">#${pedido.id}</span>
                    <span class="pedido-data">${new Date(pedido.created_at).toLocaleString('pt-BR')}</span>
                </div>
                <span class="pedido-status ${statusClass}">${pedido.status}</span>
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

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    carregarClientes();
    configurarFiltros();
    
    // Fechar modal ao clicar fora
    window.onclick = (e) => {
        const modal = document.getElementById('modal-cliente');
        if (e.target === modal) {
            fecharModalCliente();
        }
    };
});
