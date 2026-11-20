(function() {
    'use strict';
    const $ = id => document.getElementById(id);
    class NotificacoesAdmin {
        constructor() {
            this.token = window.authManager?.obterToken();
            this.itens = [];
            this.cursor = null;
        }

        async api(caminho = '', options = {}) {
            if (this.encerrado || !this.token || this.token !== window.authManager?.obterToken()) {
                this.encerrar();
                throw new Error('Sua sessão mudou. Recarregue o painel.');
            }
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);
            try {
                const resposta = await fetch(`${API_URL}/notificacoes${caminho}`, { ...options, cache: 'no-store',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` }, signal: controller.signal });
                if (this.token !== window.authManager?.obterToken()) { this.encerrar(); throw new Error('Sua sessão mudou. Recarregue o painel.'); }
                const dados = await resposta.json();
                if ([401, 403].includes(resposta.status)) {
                    this.encerrar();
                }
                if (!resposta.ok) throw new Error(dados.error || 'Falha ao atualizar notificações.');
                return dados;
            } finally { clearTimeout(timeout); }
        }

        async resumo() {
            if (this.encerrado) return;
            if (this.resumindo) { this.resumoPendente = true; return; }
            this.resumindo = true;
            try {
                const resumo = await this.api('/resumo');
                $('notificacoes-contador').textContent = resumo.nao_lidas;
                $('pedidos-novos').hidden = resumo.nao_lidas === 0;
                const aviso = `${resumo.nao_lidas} notificação(ões) não lida(s).`;
                if ($('pedidos-aviso-texto').textContent !== aviso) $('pedidos-aviso-texto').textContent = aviso;
                $('notificacoes-feedback').textContent = '';
            } catch (erro) {
                $('notificacoes-contador').textContent = '—';
                $('notificacoes-feedback').textContent = erro.message;
            } finally {
                this.resumindo = false;
                if (this.resumoPendente) { this.resumoPendente = false; this.resumo(); }
            }
        }

        encerrar() {
            this.encerrado = true;
            clearInterval(this.timer);
            this.itens = [];
            $('notificacoes-lista').replaceChildren();
            $('central-notificacoes').hidden = true;
            $('pedidos-novos').hidden = true;
            $('notificacoes-contador').textContent = '—';
        }

        async carregar(mais = false) {
            if (this.carregando) return;
            this.carregando = true;
            $('notificacoes-lista').setAttribute('aria-busy', 'true');
            try {
                const dados = await this.api(mais && this.cursor ? `?antes=${this.cursor}` : '');
                this.itens = mais ? [...this.itens, ...dados.notificacoes] : dados.notificacoes;
                this.cursor = dados.proximo_cursor;
                this.renderizar();
            } catch (erro) { $('notificacoes-feedback').textContent = erro.message; }
            finally { this.carregando = false; $('notificacoes-lista').setAttribute('aria-busy', 'false'); }
        }

        renderizar() {
            const itens = window.RenderSeguro.dados(this.itens);
            $('notificacoes-lista').innerHTML = itens.length ? itens.map(n => `<article class="notificacao-item ${n.lida ? 'notificacao-lida' : ''}">
                <div><span class="notificacao-situacao">${n.lida ? 'Lida' : 'Não lida'}</span><h3>Pedido #${n.pedido_id}</h3>
                <p>${new Date(n.created_at).toLocaleString('pt-BR')} · ${window.PedidoStatus.obter(n.status).label}</p></div>
                <button type="button" class="btn btn-secondary" data-notificacao="${n.id}">Abrir pedido</button></article>`).join('') : '<p class="notificacoes-vazio">Nenhuma notificação por aqui. Novos pedidos aparecerão nesta central.</p>';
            $('notificacoes-mais').hidden = !this.cursor;
            $('notificacoes-marcar-todas').disabled = !this.itens.some(n => !n.lida);
        }

        async abrirPedido(id) {
            const notificacao = this.itens.find(n => Number(n.id) === id);
            if (!notificacao) return;
            try {
                await this.api(`/${id}/lida`, { method: 'PUT', body: '{}' });
                notificacao.lida = true;
                this.renderizar();
                await this.resumo();
                this.fechar();
                window.pedidosAdmin?.abrir(notificacao.pedido_id);
            } catch (erro) { $('notificacoes-feedback').textContent = erro.message; }
        }

        async abrir() {
            $('central-notificacoes').hidden = false;
            $('notificacoes-abrir').setAttribute('aria-expanded', 'true');
            $('titulo-notificacoes').focus();
            $('central-notificacoes').scrollIntoView({ block: 'start' });
            await Promise.all([this.carregar(), this.resumo()]);
        }

        async marcarPedidoLido(id) {
            if (this.itens.some(n => Number(n.pedido_id) === Number(id) && n.lida)) return;
            try {
                await this.api(`/pedido/${id}/lida`, { method: 'PUT', body: '{}' });
                await this.resumo();
            } catch (erro) { $('notificacoes-feedback').textContent = erro.message; }
        }

        fechar() {
            $('central-notificacoes').hidden = true;
            $('notificacoes-abrir').setAttribute('aria-expanded', 'false');
            $('notificacoes-abrir').focus();
        }

        async configurarPush() {
            if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
                $('push-alternar').textContent = 'Push não disponível neste navegador';
                $('push-feedback').textContent = 'Use um navegador compatível. No iPhone ou iPad, abra o site adicionado à Tela de Início.';
                return;
            }
            try {
                const config = await this.api('/push/config');
                if (!config.disponivel) { $('push-alternar').textContent = 'Push aguardando configuração'; return; }
                this.chave = config.chave_publica;
                this.usuarioId = config.usuario_id;
                let timeout;
                try { this.registro = await Promise.race([navigator.serviceWorker.ready,
                    new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Recarregue o painel para iniciar as notificações do dispositivo.')), 8000); })]); }
                finally { clearTimeout(timeout); }
                const inscricao = await this.registro.pushManager.getSubscription();
                const preferencia = this.lerPreferenciaDispositivo();
                const restaurar = !preferencia || (preferencia.usuarioId === this.usuarioId && preferencia.ativo);
                if (inscricao && Notification.permission === 'granted' && restaurar) {
                    await this.registrarPush(inscricao);
                    this.inscricao = inscricao;
                    $('push-feedback').textContent = 'Avisos ativados neste dispositivo.';
                } else {
                    this.inscricao = null;
                    this.preferenciaPush(false);
                }
                this.atualizarBotaoPush();
            } catch (erro) { $('push-feedback').textContent = erro.message; $('push-alternar').textContent = 'Push indisponível no momento'; }
        }

        preferenciaPush(ativo) {
            this.registro?.active?.postMessage({ tipo: 'PUSH_PREFERENCIA', ativo });
        }

        lerPreferenciaDispositivo() {
            try {
                const valor = JSON.parse(localStorage.getItem('davini_push_preferencia'));
                return valor && Number.isInteger(valor.usuarioId) && typeof valor.ativo === 'boolean' ? valor : null;
            } catch (_) { return null; }
        }

        salvarPreferenciaDispositivo(ativo) {
            try { localStorage.setItem('davini_push_preferencia', JSON.stringify({ usuarioId: this.usuarioId, ativo })); }
            catch (_) {}
        }

        async registrarPush(inscricao) {
            await this.api('/push/inscricao', { method: 'POST', body: JSON.stringify(inscricao.toJSON()) });
            this.salvarPreferenciaDispositivo(true);
            this.preferenciaPush(true);
        }

        atualizarBotaoPush() {
            $('push-alternar').disabled = false;
            $('push-alternar').textContent = this.inscricao ? 'Desativar neste dispositivo' : 'Ativar neste dispositivo';
        }

        async alternarPush() {
            $('push-alternar').disabled = true;
            try {
                if (this.inscricao) {
                    const inscricao = this.inscricao;
                    this.salvarPreferenciaDispositivo(false);
                    this.preferenciaPush(false);
                    await inscricao.unsubscribe();
                    this.inscricao = null;
                    await this.api('/push/inscricao', { method: 'DELETE', body: JSON.stringify({ endpoint: inscricao.endpoint }) });
                    $('push-feedback').textContent = 'Avisos desativados neste dispositivo.';
                } else {
                    // Chamado somente pelo clique explícito do administrador.
                    const permissao = await Notification.requestPermission();
                    if (permissao !== 'granted') throw new Error('Permissão não concedida. Você pode alterá-la nas configurações do navegador.');
                    const base64 = this.chave.replace(/-/g, '+').replace(/_/g, '/');
                    const chave = Uint8Array.from(atob(base64 + '='.repeat((4 - base64.length % 4) % 4)), c => c.charCodeAt(0));
                    const inscricao = await this.registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave });
                    try { await this.registrarPush(inscricao); }
                    catch (erro) { await inscricao.unsubscribe(); throw erro; }
                    this.inscricao = inscricao;
                    $('push-feedback').textContent = 'Avisos ativados. Você receberá novos pedidos mesmo fora do painel.';
                }
            } catch (erro) { $('push-feedback').textContent = erro.message; }
            finally { this.atualizarBotaoPush(); }
        }

        iniciar() {
            $('notificacoes-abrir').addEventListener('click', () => this.abrir());
            $('notificacoes-fechar').addEventListener('click', () => this.fechar());
            $('central-notificacoes').addEventListener('keydown', event => { if (event.key === 'Escape') this.fechar(); });
            $('pedidos-ver-novos').addEventListener('click', () => this.abrir());
            $('notificacoes-mais').addEventListener('click', () => this.carregar(true));
            $('notificacoes-lista').addEventListener('click', event => {
                const botao = event.target.closest('[data-notificacao]');
                const id = window.RenderSeguro.id(botao?.dataset.notificacao);
                if (id) this.abrirPedido(id);
            });
            $('notificacoes-marcar-todas').addEventListener('click', async () => {
                const botao = $('notificacoes-marcar-todas');
                botao.disabled = true;
                try {
                    await this.api('/lidas', { method: 'PUT', body: JSON.stringify({ ate_id: Math.max(...this.itens.map(n => n.id)) }) });
                    await Promise.all([this.carregar(), this.resumo()]);
                } catch (erro) { $('notificacoes-feedback').textContent = erro.message; }
                finally { this.renderizar(); }
            });
            $('push-alternar').addEventListener('click', () => this.alternarPush());
            this.resumo();
            this.configurarPush();
            const monitorar = () => { clearInterval(this.timer); if (!this.encerrado) this.timer = setInterval(() => { if (!document.hidden) this.resumo(); }, 30000); };
            monitorar();
            document.addEventListener('visibilitychange', () => { if (!document.hidden) this.resumo(); });
            window.addEventListener('pagehide', () => clearInterval(this.timer));
            window.addEventListener('pageshow', event => { if (event.persisted) { monitorar(); this.resumo(); } });
        }
    }
    window.NotificacoesAdmin = NotificacoesAdmin;
    document.addEventListener('DOMContentLoaded', () => {
        if (!$('central-notificacoes') || !window.authManager?.obterToken()) return;
        window.notificacoesAdmin = new NotificacoesAdmin();
        window.notificacoesAdmin.iniciar();
    });
})();
