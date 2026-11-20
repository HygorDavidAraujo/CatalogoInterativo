// Fila de pedidos usa os mesmos registros exibidos no histórico do cliente.
(function() {
    'use strict';
    const $ = id => document.getElementById(id);
    const moeda = valor => Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const data = valor => new Date(valor).toLocaleString('pt-BR');

    class PedidosAdmin {
        constructor() {
            this.pagina = 1;
            this.filtros = { status: '', busca: '' };
            this.versaoLista = 0;
            this.versaoDetalhe = 0;
            this.conhecidos = new Set();
            this.novos = new Set();
            this.iniciado = false;
            this.token = window.authManager?.obterToken();
        }

        async api(caminho, options = {}) {
            if (this.encerrado || !this.token || this.token !== window.authManager?.obterToken()) {
                this.encerrar();
                throw new Error('Sessão alterada. Recarregue o painel para continuar.');
            }
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);
            try {
                const response = await fetch(`${API_URL}/pedidos${caminho}`, {
                    ...options, cache: 'no-store', signal: controller.signal,
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` }
                });
                if ([401, 403].includes(response.status) || this.token !== window.authManager?.obterToken()) {
                    this.encerrar();
                    throw new Error('Acesso expirado. Entre novamente como administrador.');
                }
                if (!response.ok) {
                    const erro = await response.json().catch(() => ({}));
                    throw new Error(erro.error || 'Não foi possível concluir a operação. Tente novamente.');
                }
                return await response.json();
            } finally {
                clearTimeout(timeout);
            }
        }

        encerrar() {
            this.encerrado = true;
            clearInterval(this.timer);
            this.versaoLista++;
            this.versaoDetalhe++;
            $('pedidos-lista').replaceChildren();
            $('pedido-detalhe').replaceChildren();
            $('pedido-detalhe').hidden = true;
            $('pedidos-novos').hidden = true;
            $('pedidos-contador').textContent = '—';
            $('pedidos-feedback').textContent = 'Entre novamente como administrador para consultar os pedidos.';
        }

        async resumo() {
            if (this.encerrado || this.atualizandoResumo) return;
            this.atualizandoResumo = true;
            try {
                const resumo = await this.api('/resumo');
                const ids = resumo.recentes.map(Number);
                if (!this.iniciado) {
                    // Primeira carga estabelece a referência sem anunciar pedidos antigos.
                    this.menorInicial = ids.length ? Math.min(...ids) : 0;
                    this.iniciado = true;
                } else {
                    ids.filter(id => id > this.menorInicial && !this.conhecidos.has(id)).forEach(id => this.novos.add(id));
                }
                ids.forEach(id => this.conhecidos.add(id));
                $('pedidos-contador').textContent = resumo.em_aberto;
                $('pedidos-resumo').textContent = `${resumo.em_aberto} em aberto • ${resumo.total} pedidos • Atualizado às ${new Date().toLocaleTimeString('pt-BR')}`;
                if (!window.notificacoesAdmin) {
                    $('pedidos-novos').hidden = !this.novos.size;
                    $('pedidos-aviso-texto').textContent = this.novos.size ? `${this.novos.size} novo(s) pedido(s) recebido(s).` : '';
                }
            } catch (error) {
                $('pedidos-resumo').textContent = 'Falha na atualização automática. Use Atualizar pedidos para tentar novamente.';
            } finally {
                this.atualizandoResumo = false;
            }
        }

        async listar() {
            const versao = ++this.versaoLista;
            $('pedidos-lista').setAttribute('aria-busy', 'true');
            $('pedidos-feedback').textContent = 'Carregando pedidos…';
            $('pedidos-anterior').disabled = true;
            $('pedidos-proxima').disabled = true;
            try {
                const query = new URLSearchParams({ ...this.filtros, pagina: this.pagina });
                const resposta = await this.api(`/recebidos?${query}`);
                if (versao !== this.versaoLista) return;
                const pedidos = window.RenderSeguro.dados(resposta.pedidos);
                $('pedidos-lista').innerHTML = pedidos.map(p => `
                    <article class="pedido-fila">
                        <div><strong>Pedido #${p.id}</strong><span>${data(p.created_at)}</span></div>
                        <div><strong>${p.nome_completo}</strong><span>${window.PedidoStatus.obter(p.status).label}</span></div>
                        <strong>${moeda(p.total)}</strong>
                        <button type="button" class="btn btn-secondary" data-abrir-pedido="${p.id}" aria-label="Ver pedido #${p.id}">Ver pedido</button>
                    </article>`).join('');
                $('pedidos-feedback').textContent = resposta.total ? `${resposta.total} pedido(s) encontrado(s).` : 'Nenhum pedido encontrado para estes filtros.';
                $('pedidos-pagina').textContent = `Página ${this.pagina} de ${Math.max(1, Math.ceil(resposta.total / resposta.por_pagina))}`;
                $('pedidos-anterior').disabled = this.pagina <= 1;
                $('pedidos-proxima').disabled = this.pagina * resposta.por_pagina >= resposta.total;
                return true;
            } catch (error) {
                if (versao !== this.versaoLista) return;
                $('pedidos-lista').replaceChildren();
                $('pedidos-feedback').textContent = error.message;
            } finally {
                if (versao === this.versaoLista) $('pedidos-lista').setAttribute('aria-busy', 'false');
            }
        }

        async abrir(id) {
            id = window.RenderSeguro.id(id);
            if (!id) return;
            window.painelAdmin?.abrir('pedidos-recebidos');
            const versao = ++this.versaoDetalhe;
            const painel = $('pedido-detalhe');
            painel.hidden = false;
            painel.innerHTML = '<p role="status">Carregando detalhes…</p>';
            try {
                const pedido = await this.api(`/${id}`);
                if (versao !== this.versaoDetalhe) return;
                this.pedidoAtual = pedido;
                window.notificacoesAdmin?.marcarPedidoLido(id);
                const p = window.RenderSeguro.dados(pedido);
                const atual = window.PedidoStatus.obter(p.status);
                painel.innerHTML = `
                    <div class="pedidos-cabecalho"><h3 id="pedido-detalhe-titulo" tabindex="-1">Pedido #${p.id}</h3><button type="button" class="btn btn-secondary" data-fechar-pedido>Fechar detalhes</button></div>
                    <p>${data(p.created_at)}</p>
                    <p><strong>${p.nome_completo}</strong> • ${p.email} • ${p.telefone || 'Telefone não informado'}</p>
                    <a class="pedido-cliente-link" href="admin.html?cliente=${p.usuario_id}#clientes">Abrir cadastro e histórico do cliente</a>
                    <ul class="pedido-fila-itens">${p.itens.map(item => `<li><span>${Number(item.quantidade)} × ${item.vinho_nome}<small>${moeda(item.preco_unitario)} por unidade</small></span><strong>${moeda(item.subtotal)}</strong></li>`).join('')}</ul>
                    <p class="pedido-fila-total">Total do pedido: <strong>${moeda(p.total)}</strong></p>
                    ${p.observacoes ? `<p class="pedido-fila-obs"><strong>Observações:</strong> ${p.observacoes}</p>` : ''}
                    <form id="pedido-status-form" class="pedidos-filtros" data-status-atual="${atual.valor}">
                        <div><label for="pedido-novo-status">Status do pedido #${p.id}</label><select id="pedido-novo-status">${!atual.valor ? '<option value="" selected disabled>Status não reconhecido</option>' : ''}${window.PedidoStatus.opcoes.map(o => `<option value="${o.valor}" ${o.valor === atual.valor ? 'selected' : ''}>${o.label}</option>`).join('')}</select></div>
                        <button type="submit" class="btn btn-primary">Salvar status</button>
                    </form><p id="pedido-status-feedback" role="status"></p>
                    <section class="pedido-cobranca" id="pedido-cobranca" aria-label="Entrega e pagamento"></section>`;
                window.pagamentosAdmin?.montar(pedido, painel.querySelector('#pedido-cobranca'));
                painel.querySelector('[data-fechar-pedido]').addEventListener('click', () => this.fechar());
                painel.querySelector('.pedido-cliente-link').addEventListener('click', event => {
                    if (!window.clientesPainel) return;
                    event.preventDefault();
                    this.fechar();
                    window.clientesPainel.abrir(pedido.usuario_id);
                });
                $('pedido-status-form').addEventListener('submit', event => {
                    event.preventDefault();
                    this.salvarStatus(id);
                });
                $('pedido-detalhe-titulo').focus();
                painel.scrollIntoView({ block: 'nearest' });
            } catch (error) {
                if (versao !== this.versaoDetalhe) return;
                painel.replaceChildren();
                const mensagem = document.createElement('p');
                mensagem.setAttribute('role', 'alert');
                mensagem.textContent = error.message;
                painel.append(mensagem);
            }
        }

        fechar() {
            this.versaoDetalhe++;
            $('pedido-detalhe').hidden = true;
            $('pedido-detalhe').replaceChildren();
            $('pedidos-atualizar').focus();
        }

        async salvarStatus(id) {
            const form = $('pedido-status-form');
            const anterior = form.dataset.statusAtual;
            const select = $('pedido-novo-status');
            const mensagem = $('pedido-status-feedback');
            const status = select.value;
            if (!window.PedidoStatus.valores.includes(status)) return;
            if (status === anterior) { mensagem.textContent = 'Este status já está salvo.'; return; }
            const controles = [...form.elements];
            controles.forEach(el => { el.disabled = true; });
            mensagem.textContent = 'Salvando status…';
            try {
                const resposta = await this.api(`/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
                if (resposta.status !== status) throw new Error('O status não foi confirmado pelo servidor. Reabra o pedido.');
                form.dataset.statusAtual = status;
                if (this.pedidoAtual?.id === id) {
                    this.pedidoAtual.status = status;
                    const cobranca = $('pedido-cobranca');
                    if (cobranca) window.pagamentosAdmin?.montar(this.pedidoAtual, cobranca);
                }
                mensagem.textContent = 'Status atualizado. O histórico do cliente também foi atualizado.';
                await Promise.all([this.listar(), this.resumo()]);
            } catch (error) {
                select.value = anterior;
                mensagem.textContent = error.message;
            } finally {
                // O formulário pode ter sido fechado ou substituído durante a requisição.
                controles.forEach(el => { el.disabled = false; });
            }
        }

        iniciar() {
            $('pedidos-status').insertAdjacentHTML('beforeend', window.PedidoStatus.opcoes.map(o => `<option value="${o.valor}">${o.label}</option>`).join(''));
            $('pedidos-lista').addEventListener('click', event => {
                const botao = event.target.closest('[data-abrir-pedido]');
                if (botao) this.abrir(botao.dataset.abrirPedido);
            });
            $('pedidos-filtros').addEventListener('submit', event => {
                event.preventDefault();
                this.filtros = { busca: $('pedidos-busca').value.trim(), status: $('pedidos-status').value };
                this.pagina = 1;
                this.listar();
            });
            $('pedidos-anterior').addEventListener('click', () => { if (this.pagina > 1) { this.pagina--; this.listar(); } });
            $('pedidos-proxima').addEventListener('click', () => { this.pagina++; this.listar(); });
            $('pedidos-atualizar').addEventListener('click', () => { this.listar(); this.resumo(); });
            $('pedidos-ver-novos').addEventListener('click', async () => {
                if (window.notificacoesAdmin) return;
                window.painelAdmin?.abrir('pedidos-recebidos', { foco: true });
                const revisados = [...this.novos];
                this.filtros = { status: '', busca: '' };
                $('pedidos-filtros').reset();
                this.pagina = 1;
                const carregou = await this.listar();
                if (!carregou) return;
                revisados.forEach(id => this.novos.delete(id));
                $('pedidos-novos').hidden = !this.novos.size;
                $('pedidos-aviso-texto').textContent = this.novos.size ? `${this.novos.size} novo(s) pedido(s) recebido(s).` : '';
                $('pedidos-atualizar').focus();
            });
            document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.resumo(); });
            $('pedido-detalhe').addEventListener('keydown', event => { if (event.key === 'Escape') this.fechar(); });
            this.listar();
            this.resumo();
            this.timer = setInterval(() => { if (document.visibilityState === 'visible') this.resumo(); }, 30000);
            window.addEventListener('pagehide', () => clearInterval(this.timer));
            window.addEventListener('pageshow', event => {
                if (!event.persisted || this.encerrado) return;
                clearInterval(this.timer);
                this.resumo();
                this.timer = setInterval(() => { if (document.visibilityState === 'visible') this.resumo(); }, 30000);
            });
            const id = new URLSearchParams(window.location.search).get('pedido');
            if (id) this.abrir(id);
        }
    }
    window.PedidosAdmin = PedidosAdmin;
    document.addEventListener('DOMContentLoaded', () => {
        if (!$('pedidos-recebidos') || !window.authManager?.isAdmin()) return;
        window.pedidosAdmin = new PedidosAdmin();
        window.pedidosAdmin.iniciar();
    });
})();
