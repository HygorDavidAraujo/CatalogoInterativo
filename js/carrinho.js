// ===== GERENCIAMENTO DO CARRINHO =====
class CarrinhoManager {
    constructor() {
        this.itens = [];
        this.carregarCarrinho();
    }

    carregarCarrinho() {
        const carrinhoSalvo = localStorage.getItem('carrinho');
        if (carrinhoSalvo) {
            this.itens = JSON.parse(carrinhoSalvo);
        }
        this.atualizarInterface();
    }

    salvarCarrinho() {
        localStorage.setItem('carrinho', JSON.stringify(this.itens));
        this.atualizarInterface();
    }

    adicionarItem(vinho) {
        const itemExistente = this.itens.find(item => item.id === vinho.id);
        
        if (itemExistente) {
            itemExistente.quantidade++;
        } else {
            this.itens.push({
                id: vinho.id,
                nome: vinho.nome,
                tipo: vinho.tipo,
                preco: parseFloat(vinho.preco),
                imagem: vinho.imagem,
                quantidade: 1
            });
        }
        
        this.salvarCarrinho();
        this.mostrarMensagem('Vinho adicionado ao carrinho!', 'sucesso');
    }

    removerItem(id) {
        this.itens = this.itens.filter(item => item.id !== id);
        this.salvarCarrinho();
    }

    atualizarQuantidade(id, quantidade) {
        const item = this.itens.find(item => item.id === id);
        if (item) {
            if (quantidade <= 0) {
                this.removerItem(id);
            } else {
                item.quantidade = quantidade;
                this.salvarCarrinho();
            }
        }
    }

    limparCarrinho() {
        this.itens = [];
        this.salvarCarrinho();
    }

    getTotal() {
        return this.itens.reduce((total, item) => {
            return total + (item.preco * item.quantidade);
        }, 0);
    }

    getTotalItens() {
        return this.itens.reduce((total, item) => total + item.quantidade, 0);
    }

    atualizarInterface() {
        const badge = document.getElementById('badge-carrinho');
        const carrinhoBody = document.getElementById('carrinho-body');
        const carrinhoFooter = document.getElementById('carrinho-footer');
        const totalElement = document.getElementById('carrinho-total');

        if (!badge || !carrinhoBody) return;

        const totalItens = this.getTotalItens();
        badge.textContent = totalItens;
        badge.style.display = totalItens > 0 ? 'flex' : 'none';

        if (this.itens.length === 0) {
            carrinhoBody.innerHTML = `
                <div class="carrinho-vazio">
                    <i class="fas fa-shopping-cart"></i>
                    <p>Seu carrinho está vazio</p>
                </div>
            `;
            if (carrinhoFooter) carrinhoFooter.style.display = 'none';
        } else {
            carrinhoBody.innerHTML = this.itens.map(item => `
                <div class="carrinho-item" data-id="${item.id}">
                    <img src="${item.imagem || 'https://via.placeholder.com/60x80?text=Vinho'}" 
                         alt="${item.nome}" 
                         class="carrinho-item-img">
                    <div class="carrinho-item-info">
                        <div class="carrinho-item-nome">${item.nome}</div>
                        <div class="carrinho-item-preco">R$ ${item.preco.toFixed(2).replace('.', ',')}</div>
                        <div class="carrinho-item-qtd">
                            <button class="btn-qtd" onclick="carrinhoManager.atualizarQuantidade(${item.id}, ${item.quantidade - 1})">
                                <i class="fas fa-minus"></i>
                            </button>
                            <span>${item.quantidade}</span>
                            <button class="btn-qtd" onclick="carrinhoManager.atualizarQuantidade(${item.id}, ${item.quantidade + 1})">
                                <i class="fas fa-plus"></i>
                            </button>
                            <button class="btn-remover-item" onclick="carrinhoManager.removerItem(${item.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');

            if (carrinhoFooter) {
                carrinhoFooter.style.display = 'block';
                totalElement.textContent = `R$ ${this.getTotal().toFixed(2).replace('.', ',')}`;
            }
        }
    }

    abrirCarrinho() {
        const sidebar = document.getElementById('carrinho-sidebar');
        const overlay = document.getElementById('carrinho-overlay');
        sidebar.classList.add('aberto');
        overlay.classList.add('ativo');
    }

    fecharCarrinho() {
        const sidebar = document.getElementById('carrinho-sidebar');
        const overlay = document.getElementById('carrinho-overlay');
        sidebar.classList.remove('aberto');
        overlay.classList.remove('ativo');
    }

    async finalizarPedido() {
        if (this.itens.length === 0) {
            alert('Seu carrinho está vazio!');
            return;
        }

        // Verificar se está logado
        if (!authManager.isLogado()) {
            this.fecharCarrinho();
            alert('Você precisa estar logado para finalizar o pedido!');
            abrirModalAuth();
            return;
        }

        const usuario = authManager.usuarioLogado;
        
        try {
            // Salvar pedido no banco de dados
            const response = await fetch(`${API_URL}/pedidos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    usuario_id: usuario.id,
                    total: this.getTotal(),
                    itens: this.itens,
                    observacoes: 'Pedido via WhatsApp'
                })
            });

            if (!response.ok) {
                throw new Error('Erro ao salvar pedido');
            }

            const resultado = await response.json();
            console.log('Pedido salvo:', resultado);
            
            // Montar mensagem para WhatsApp
            let mensagem = `🍷 *PEDIDO DE VINHOS*\n\n`;
            mensagem += `*Pedido #${resultado.pedidoId}*\n\n`;
            mensagem += `*Cliente:* ${usuario.nome}\n`;
            mensagem += `*Email:* ${usuario.email}\n`;
            mensagem += `*Telefone:* ${usuario.telefone || 'Não informado'}\n\n`;
            mensagem += `*ITENS DO PEDIDO:*\n`;
            mensagem += `━━━━━━━━━━━━━━━━\n`;

            this.itens.forEach((item, index) => {
                const subtotal = item.preco * item.quantidade;
                mensagem += `\n${index + 1}. *${item.nome}*\n`;
                mensagem += `   • Tipo: ${item.tipo}\n`;
                mensagem += `   • Quantidade: ${item.quantidade}x\n`;
                mensagem += `   • Preço Unit: R$ ${item.preco.toFixed(2).replace('.', ',')}\n`;
                mensagem += `   • Subtotal: R$ ${subtotal.toFixed(2).replace('.', ',')}\n`;
            });

            mensagem += `\n━━━━━━━━━━━━━━━━\n`;
            mensagem += `*TOTAL: R$ ${this.getTotal().toFixed(2).replace('.', ',')}*`;

            // Buscar número do WhatsApp das configurações
            await vinhoManager.carregarConfiguracoes();
            const whatsapp = vinhoManager.configuracoes.whatsapp || '5562981831483';
            
            // Codificar mensagem para URL
            const mensagemCodificada = encodeURIComponent(mensagem);
            const urlWhatsApp = `https://wa.me/${whatsapp}?text=${mensagemCodificada}`;

            // Limpar carrinho
            this.limparCarrinho();
            
            // Abrir WhatsApp
            window.open(urlWhatsApp, '_blank');
            
            this.fecharCarrinho();
            this.mostrarMensagem('Pedido registrado com sucesso!', 'sucesso');
        } catch (error) {
            console.error('Erro ao finalizar pedido:', error);
            this.mostrarMensagem('Erro ao registrar pedido. Tente novamente.', 'erro');
        }
    }

    mostrarMensagem(texto, tipo) {
        // Criar elemento de mensagem
        const mensagem = document.createElement('div');
        mensagem.className = `mensagem-flutuante mensagem-${tipo}`;
        mensagem.innerHTML = `
            <i class="fas fa-${tipo === 'sucesso' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${texto}</span>
        `;
        mensagem.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${tipo === 'sucesso' ? '#4caf50' : '#f44336'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        `;

        document.body.appendChild(mensagem);

        setTimeout(() => {
            mensagem.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => mensagem.remove(), 300);
        }, 3000);
    }
}

// Instância global
const carrinhoManager = new CarrinhoManager();

// ===== CONFIGURAR EVENTOS DO CARRINHO =====
function configurarEventosCarrinho() {
    const btnAbrir = document.getElementById('btn-abrir-carrinho');
    const btnFechar = document.getElementById('btn-fechar-carrinho');
    const overlay = document.getElementById('carrinho-overlay');
    const btnFinalizar = document.getElementById('btn-finalizar-pedido');

    if (btnAbrir) {
        btnAbrir.addEventListener('click', () => carrinhoManager.abrirCarrinho());
    }

    if (btnFechar) {
        btnFechar.addEventListener('click', () => carrinhoManager.fecharCarrinho());
    }

    if (overlay) {
        overlay.addEventListener('click', () => carrinhoManager.fecharCarrinho());
    }

    if (btnFinalizar) {
        btnFinalizar.addEventListener('click', () => carrinhoManager.finalizarPedido());
    }
}

// Adicionar CSS para animações
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
