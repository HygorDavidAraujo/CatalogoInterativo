(function() {
    'use strict';
    document.addEventListener('DOMContentLoaded', () => {
        const navegacao = document.querySelector('.painel-navegacao');
        if (!navegacao) return;
        const secoes = ['pedidos-recebidos', 'catalogo', 'configuracoes'];
        const links = [...navegacao.querySelectorAll('[data-painel-link]')];
        const tabs = [...document.querySelectorAll('[data-catalogo-tab]')];
        let guiaCatalogo = 'lista';

        function selecionarGuia(guia) {
            guiaCatalogo = guia === 'editor' ? 'editor' : 'lista';
            tabs.forEach(tab => {
                const ativa = tab.dataset.catalogoTab === guiaCatalogo;
                tab.setAttribute('aria-selected', String(ativa));
                tab.tabIndex = ativa ? 0 : -1;
                document.getElementById(tab.getAttribute('aria-controls')).hidden = !ativa;
            });
        }

        function abrir(secao, { foco = false, atualizarUrl = true, substituir = false } = {}) {
            if (!secoes.includes(secao)) secao = 'pedidos-recebidos';
            secoes.forEach(id => { document.getElementById(id).hidden = id !== secao; });
            links.forEach(link => {
                if (link.dataset.painelLink === secao) link.setAttribute('aria-current', 'page');
                else link.removeAttribute('aria-current');
            });
            if (atualizarUrl) {
                const hash = `#${secao}${secao === 'catalogo' && guiaCatalogo === 'editor' ? '/cadastro' : ''}`;
                const endereco = new URL(window.location.href);
                if (secao !== 'pedidos-recebidos') endereco.searchParams.delete('pedido');
                endereco.hash = hash;
                if (window.location.href !== endereco.href) {
                    window.history[substituir ? 'replaceState' : 'pushState'](null, '', endereco);
                }
            }
            if (foco) {
                const titulo = document.getElementById(secao).querySelector('h2');
                titulo?.focus({ preventScroll: true });
                navegacao.scrollIntoView({ block: 'start' });
            }
        }

        function abrirCatalogo(guia = 'lista', opcoes = {}) {
            selecionarGuia(guia);
            abrir('catalogo', { ...opcoes, foco: false });
            if (opcoes.foco) {
                const alvo = document.getElementById(guiaCatalogo === 'editor' ? 'nome' : 'titulo-lista-vinhos');
                alvo?.focus({ preventScroll: true });
                navegacao.scrollIntoView({ block: 'start' });
            }
        }

        function lerEndereco() {
            const [secao, guia] = window.location.hash.slice(1).split('/');
            // Links vindos do histórico de clientes abrem diretamente a fila e o pedido.
            if (new URLSearchParams(window.location.search).has('pedido') && !secao) {
                abrir('pedidos-recebidos', { atualizarUrl: false });
                return;
            }
            if (secao === 'catalogo') selecionarGuia(guia === 'cadastro' ? 'editor' : 'lista');
            abrir(secao, { atualizarUrl: false });
        }

        links.forEach(link => link.addEventListener('click', event => {
            event.preventDefault();
            abrir(link.dataset.painelLink, { foco: true });
        }));
        tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => abrirCatalogo(tab.dataset.catalogoTab, { substituir: true }));
            tab.addEventListener('keydown', event => {
                const destinos = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 };
                if (!(event.key in destinos)) return;
                event.preventDefault();
                const proxima = tabs[destinos[event.key]];
                abrirCatalogo(proxima.dataset.catalogoTab, { substituir: true });
                proxima.focus();
            });
        });
        document.getElementById('atalho-pedidos')?.addEventListener('click', event => {
            event.preventDefault();
            abrir('pedidos-recebidos', { foco: true });
        });
        window.addEventListener('hashchange', lerEndereco);
        window.painelAdmin = { abrir, abrirCatalogo };
        selecionarGuia('lista');
        lerEndereco();
    });
})();
