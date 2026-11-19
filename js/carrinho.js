// ===== GERENCIAMENTO DO CARRINHO =====
class CarrinhoManager {
    constructor() {
        this.itens = [];
        this.carregarCarrinho();
    }

    getAuthHeaders() {
        const token = window.authManager?.obterToken?.() || localStorage.getItem('jwt_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return headers;
    }

    carregarCarrinho() {
        const carrinhoSalvo = localStorage.getItem('carrinho');
        if (carrinhoSalvo) {
            this.itens = JSON.parse(carrinhoSalvo);
        }
        this.itens = this.itens.map(item => ({
            ...item,
            alcoolica: typeof item.alcoolica === 'boolean'
                ? item.alcoolica
                : this.determinarFlagAlcoolica(item)
        }));
        this.atualizarInterface();
    }

    salvarCarrinho() {
        localStorage.setItem('carrinho', JSON.stringify(this.itens));
        this.atualizarInterface();
    }

    atualizarProdutos(vinhos) {
        const atuais = new Map(vinhos.map(vinho => [vinho.id, vinho]));
        this.itens = this.itens.map(item => {
            const atual = atuais.get(item.id);
            if (!atual) return { ...item, indisponivel: true };
            return { ...item, nome: atual.nome, preco: Number(atual.preco), tipo: atual.tipo,
                imagem: atual.imagem, indisponivel: false };
        });
        this.salvarCarrinho();
    }

    adicionarItem(vinho, quantidade = 1) {
        if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 999) {
            this.mostrarMensagem('Informe uma quantidade entre 1 e 999.', 'erro');
            return false;
        }
        const idadeManager = window.idadeManager;
        const alcoolica = this.determinarFlagAlcoolica(vinho);

        if (alcoolica && !(idadeManager?.podeComprarBebidaAlcoolica?.())) {
            idadeManager?.abrirModal?.();
            this.mostrarMensagem('Confirme que tem 18 anos ou mais para adicionar bebidas alcoólicas.', 'erro');
            return false;
        }

        const itemExistente = this.itens.find(item => item.id === vinho.id);
        
        if (itemExistente) {
            if (Number(itemExistente.quantidade) + quantidade > 999) {
                this.mostrarMensagem('A quantidade máxima por produto é 999.', 'erro');
                return false;
            }
            itemExistente.quantidade = Number(itemExistente.quantidade) + quantidade;
            if (typeof itemExistente.alcoolica !== 'boolean') {
                itemExistente.alcoolica = alcoolica;
            }
        } else {
            this.itens.push({
                id: vinho.id,
                nome: vinho.nome,
                tipo: vinho.tipo,
                preco: parseFloat(vinho.preco),
                imagem: vinho.imagem,
                quantidade,
                alcoolica
            });
        }
        
        this.salvarCarrinho();
        this.mostrarMensagem('Vinho adicionado ao carrinho!', 'sucesso');
        return true;
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

    getDescontoVip(preco) {
        const usuario = window.authManager?.usuarioLogado;
        const vipTipo = usuario?.is_vip ? usuario.vip_tipo : null;
        return window.vipManager
            ? window.vipManager.calcularDesconto(preco, vipTipo)
            : window.Precos.paraCentavos(preco) / 100;
    }

    getTotal() {
        const centavos = this.itens.reduce((total, item) =>
            total + window.Precos.paraCentavos(this.getDescontoVip(item.preco)) * item.quantidade, 0);
        return centavos / 100;
    }

    getTotalItens() {
        return this.itens.reduce((total, item) => total + item.quantidade, 0);
    }

    determinarFlagAlcoolica(vinho) {
        return window.idadeManager?.isBebidaAlcoolica?.(vinho) ?? true;
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

            carrinhoBody.innerHTML = this.itens.map(original => {
                const item = window.RenderSeguro.dados(original);
                let precoOriginal = parseFloat(item.preco);
                let precoFinal = this.getDescontoVip(precoOriginal);
                let usuario = window.authManager?.usuarioLogado;
                let isVip = usuario?.is_vip;
                let vipTipo = usuario?.vip_tipo;
                let badge = '';
                if (isVip && vipTipo && precoFinal < precoOriginal) {
                    badge = window.vipManager?.getBadgeHtml(vipTipo) || '';
                }
                return `
                <div class="carrinho-item" data-id="${item.id}">
                    <img src="${item.imagem || '/images/placeholder-80x80.svg'}"
                         alt="${item.nome}" 
                         class="carrinho-item-img">
                    <div class="carrinho-item-info">
                        <div class="carrinho-item-nome">${item.nome}</div>
                        ${item.indisponivel ? '<p role="status">Produto indisponível. Remova-o para continuar.</p>' : ''}
                        ${precoFinal !== precoOriginal ? `<div class='carrinho-item-preco'><span class='preco-original' style='text-decoration:line-through;color:#888;'>R$ ${precoOriginal.toFixed(2).replace('.', ',')}</span> ${badge} <span class='preco-final' style='color:#1976d2;font-weight:bold;'>R$ ${precoFinal.toFixed(2).replace('.', ',')}</span></div>` : `<div class="carrinho-item-preco">R$ ${precoOriginal.toFixed(2).replace('.', ',')}</div>`}
                        <div class="carrinho-item-qtd">
                            <button class="btn-qtd" data-carrinho-acao="diminuir" aria-label="Diminuir quantidade">
                                <i class="fas fa-minus"></i>
                            </button>
                            <span class="quantidade">${item.quantidade}</span>
                            <button class="btn-qtd" data-carrinho-acao="aumentar" aria-label="Aumentar quantidade">
                                <i class="fas fa-plus"></i>
                            </button>
                            <button class="btn-remover-item" data-carrinho-acao="remover" aria-label="Remover produto">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
            window.RenderSeguro.imagens(carrinhoBody);
            carrinhoBody.querySelectorAll('[data-carrinho-acao]').forEach(button => {
                button.addEventListener('click', () => {
                    const id = window.RenderSeguro.id(button.closest('.carrinho-item').dataset.id);
                    const item = this.itens.find(item => item.id === id);
                    if (!item) return;
                    if (button.dataset.carrinhoAcao === 'remover') this.removerItem(id);
                    else this.atualizarQuantidade(id, Number(item.quantidade) + (button.dataset.carrinhoAcao === 'aumentar' ? 1 : -1));
                });
            });

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
        if (this.finalizandoPedido) return;
        if (this.itens.length === 0) {
            alert('Seu carrinho está vazio!');
            return;
        }
        if (this.itens.some(item => item.indisponivel)) {
            this.mostrarMensagem('Remova os produtos indisponíveis antes de finalizar o pedido.', 'erro');
            return;
        }

        const idadeManager = window.idadeManager;
        const possuiAlcoolica = this.itens.some(item => idadeManager?.isBebidaAlcoolica?.(item));
        if (possuiAlcoolica && !(idadeManager?.podeComprarBebidaAlcoolica?.())) {
            idadeManager?.abrirModal?.();
            this.mostrarMensagem('Pedidos com bebida alcoólica exigem confirmação de maioridade.', 'erro');
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
        const token = window.authManager?.obterToken?.() || localStorage.getItem('jwt_token');
        if (!token) {
            this.fecharCarrinho();
            alert('Sua sessão expirou. Faça login novamente para finalizar o pedido.');
            abrirModalAuth();
            return;
        }
        
        this.finalizandoPedido = true;
        const btnFinalizar = document.getElementById('btn-finalizar-pedido');
        if (btnFinalizar) btnFinalizar.disabled = true;

        try {
            // O servidor consulta os preços e benefícios vigentes no banco.
            const itensSolicitados = this.itens.map(item => ({
                id: item.id,
                quantidade: item.quantidade
            }));

            // Salvar pedido no banco de dados
            const response = await fetch(`${API_URL}/pedidos`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    itens: itensSolicitados,
                    observacoes: 'Pedido via WhatsApp'
                })
            });

            if (!response.ok) {
                const erro = await response.json().catch(() => ({}));
                throw new Error(erro.error || 'Erro ao registrar pedido. Tente novamente.');
            }

            const resultado = await response.json();
            console.log('Pedido salvo:', resultado);
            
            // Montar mensagem para WhatsApp
            let mensagem = `🍷 *PEDIDO DE VINHOS*\n\n`;
            mensagem += `*Pedido #${resultado.pedidoId}*\n\n`;
            
            let nomeClienteComVip = usuario.nome;
            if (usuario?.is_vip && usuario?.vip_tipo) {
                nomeClienteComVip += ` (VIP ${usuario.vip_tipo.toUpperCase()})`;
            }
            
            mensagem += `*Cliente:* ${nomeClienteComVip}\n`;
            mensagem += `*Email:* ${usuario.email}\n`;
            mensagem += `*Telefone:* ${usuario.telefone || 'Não informado'}\n\n`;
            mensagem += `*ITENS DO PEDIDO:*\n`;
            mensagem += `━━━━━━━━━━━━━━━━\n`;

            resultado.itens.forEach((item, index) => {
                const precoComDesconto = item.preco;
                const subtotal = item.subtotal;
                mensagem += `\n${index + 1}. *${item.nome}*\n`;
                mensagem += `   • Tipo: ${item.tipo}\n`;
                mensagem += `   • Quantidade: ${item.quantidade}x\n`;
                mensagem += `   • Preço Unit: R$ ${precoComDesconto.toFixed(2).replace('.', ',')}\n`;
                mensagem += `   • Subtotal: R$ ${subtotal.toFixed(2).replace('.', ',')}\n`;
            });

            mensagem += `\n━━━━━━━━━━━━━━━━\n`;
            mensagem += `*TOTAL: R$ ${resultado.total.toFixed(2).replace('.', ',')}*`;

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
            this.mostrarMensagem(error.message || 'Erro ao registrar pedido. Tente novamente.', 'erro');
        } finally {
            this.finalizandoPedido = false;
            if (btnFinalizar) btnFinalizar.disabled = false;
        }
    }

    mostrarMensagem(texto, tipo) {
        // Criar elemento de mensagem
        const mensagem = document.createElement('div');
        mensagem.className = `mensagem-flutuante mensagem-${tipo}`;
        mensagem.innerHTML = `
            <i class="fas fa-${tipo === 'sucesso' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span></span>
        `;
        mensagem.querySelector('span').textContent = texto;
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
window.carrinhoManager = new CarrinhoManager();

// ===== CONFIGURAR EVENTOS DO CARRINHO =====
function configurarEventosCarrinho() {
    const btnAbrir = document.getElementById('btn-abrir-carrinho');
    const btnFechar = document.getElementById('btn-fechar-carrinho');
    const overlay = document.getElementById('carrinho-overlay');
    const btnFinalizar = document.getElementById('btn-finalizar-pedido');

    if (btnAbrir) {
        btnAbrir.addEventListener('click', () => window.carrinhoManager.abrirCarrinho());
    }

    if (btnFechar) {
        btnFechar.addEventListener('click', () => window.carrinhoManager.fecharCarrinho());
    }

    if (overlay) {
        overlay.addEventListener('click', () => window.carrinhoManager.fecharCarrinho());
    }

    if (btnFinalizar) {
        btnFinalizar.addEventListener('click', () => window.carrinhoManager.finalizarPedido());
    }
}

document.addEventListener('DOMContentLoaded', configurarEventosCarrinho);

// Quando VipManager carregar, atualizar interface para exibir badges dinâmicas
if (window.vipManager) {
    window.vipManager.onReady(() => {
        console.log('✓ VipManager pronto no carrinho, atualizando badges...');
        if (window.carrinhoManager) {
            window.carrinhoManager.atualizarInterface();
        }
    });
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
