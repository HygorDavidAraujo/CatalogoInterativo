(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const texto = v => window.RenderSeguro.texto(v);
    const moeda = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    async function api(caminho, dados, method = 'POST') {
        const token = window.authManager?.obterToken();
        const response = await fetch(`${API_URL}${caminho}`, { method, cache: 'no-store',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
            ...(dados === undefined ? {} : { body: JSON.stringify(dados) }) });
        if (token !== window.authManager?.obterToken()) throw new Error('Sessão alterada. Recarregue o painel.');
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'Não foi possível concluir a operação.');
        return body;
    }
    async function executar(form, mensagem, acao) {
        if (form.dataset.enviando) return;
        form.dataset.enviando = 'true';
        const controles = [...form.querySelectorAll('button, input, select, textarea')];
        const estados = controles.map(c => c.disabled);
        controles.forEach(c => { c.disabled = true; });
        mensagem.textContent = 'Processando…';
        try { await acao(); }
        catch (error) { mensagem.textContent = error.message; }
        finally { delete form.dataset.enviando; controles.forEach((c, i) => { c.disabled = form.dataset.registrado === 'true' || estados[i]; }); }
    }
    function whatsapp(telefone, mensagem) {
        let numero = String(telefone || '').replace(/\D/g, '');
        if (/^\d{10,11}$/.test(numero)) numero = `55${numero}`;
        return /^55\d{10,11}$/.test(numero) ? `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}` : '';
    }

    window.pagamentosAdmin = {
        async montar(pedido, alvo) {
            try {
                const { pagamento: p, historico = [] } = await api(`/pagamentos/pedidos/${pedido.id}`, undefined, 'GET');
                if (!alvo.isConnected) return;
                const bloqueado = Boolean(p) || ['cancelado', 'finalizado'].includes(pedido.status);
                const totalProdutos = pedido.itens.reduce((s, i) => s + Number(i.subtotal), 0);
                alvo.innerHTML = `<h3>Entrega e pagamento</h3>
                    <p>Produtos: <strong>${moeda(totalProdutos)}</strong> · Desconto manual: <strong>${moeda(pedido.desconto_manual || 0)}</strong> · Frete: <strong>${pedido.frete == null ? 'a combinar' : moeda(pedido.frete)}</strong></p>
                    <form id="pedido-entrega-form" class="cobranca-form">
                        <div><label for="cobranca-entrega">Forma de entrega</label><select id="cobranca-entrega" ${bloqueado ? 'disabled' : ''}><option value="entrega">Entrega</option><option value="retirada" ${pedido.entrega_tipo === 'retirada' ? 'selected' : ''}>Retirada</option></select></div>
                        <div><label for="cobranca-frete">Frete (R$)</label><input id="cobranca-frete" type="number" min="0" max="99999999.99" step="0.01" required value="${pedido.frete == null ? '' : Number(pedido.frete)}" ${bloqueado ? 'disabled' : ''}></div>
                        <div class="campo-inteiro"><label for="cobranca-detalhes">Endereço, prazo ou local de retirada combinado</label><textarea id="cobranca-detalhes" minlength="3" maxlength="1000" required ${bloqueado ? 'disabled' : ''}>${texto(pedido.entrega_detalhes || '')}</textarea></div>
                        <button type="submit" class="btn btn-secondary" ${bloqueado ? 'disabled' : ''}>Salvar entrega e recalcular total</button>
                    </form><p id="cobranca-feedback" role="status"></p><div id="cobranca-acoes"></div>`;
                const feedback = alvo.querySelector('#cobranca-feedback');
                const form = alvo.querySelector('#pedido-entrega-form');
                form.addEventListener('submit', event => {
                    event.preventDefault();
                    const dados = { frete: $('cobranca-frete').value, entrega_tipo: $('cobranca-entrega').value,
                        entrega_detalhes: $('cobranca-detalhes').value.trim() };
                    executar(form, feedback, async () => {
                        await api(`/pagamentos/pedidos/${pedido.id}/entrega`, dados, 'PUT');
                        await window.pedidosAdmin.abrir(pedido.id);
                        window.pedidosAdmin.listar();
                    });
                });
                const acoes = alvo.querySelector('#cobranca-acoes');
                if (p?.status === 'pago') {
                    acoes.innerHTML = `<p class="cobranca-paga"><strong>Pagamento registrado</strong> · ${p.confirmacao === 'manual_admin' ? 'Conferido pelo administrador' : 'Confirmado pela API InfinitePay'}</p><p>Identificador da transação: ${texto(p.transaction_nsu)}</p>${pedido.status === 'cancelado' ? '<p role="alert">Pedido cancelado com pagamento registrado. Confira e trate o estorno na InfinitePay.</p>' : ''}`;
                } else if (pedido.status === 'cancelado') {
                    acoes.textContent = 'Pedido cancelado: cobrança e confirmação manual de recebimento estão bloqueadas. Se houver uma cobrança anterior, confira a situação e eventual estorno na InfinitePay.';
                } else if (p?.metodo === 'tap') {
                    acoes.innerHTML = `<p>Uma tentativa de cobrança foi iniciada no InfiniteTap. Confira o resultado no aplicativo antes de registrar o pagamento.</p>
                        <form id="tap-conferencia" class="cobranca-form"><div class="campo-inteiro"><label for="tap-nsu">NSU da transação aprovada (UUID, não o código de autorização)</label><input id="tap-nsu" required pattern="[0-9a-fA-F-]{36}" maxlength="36" autocomplete="off"></div>
                        <label class="campo-inteiro"><input type="checkbox" id="tap-conferido" required> Conferi na minha conta InfinitePay o pagamento aprovado, o valor de ${moeda(pedido.total)} e o cliente desta venda.</label><button type="submit" class="btn btn-primary">Registrar pagamento conferido</button></form>
                        ${['cancelado', 'finalizado'].includes(pedido.status) ? '' : `<button type="button" id="tap-reabrir" class="btn btn-secondary">Retomar a mesma tentativa</button>
                        <form id="tap-trocar-form" class="cobranca-form">
                            <h4 class="campo-inteiro">Pagamento não aprovado? Escolha outra forma</h4>
                            <div><label for="tap-nova-forma">Forma de pagamento</label><select id="tap-nova-forma"><option value="debit">Débito por aproximação</option><option value="credit">Crédito por aproximação</option><option value="checkout">Pix / crédito no checkout InfinitePay</option></select></div>
                            <div><label for="tap-novas-parcelas">Parcelas no crédito por aproximação</label><select id="tap-novas-parcelas">${Array.from({ length: Math.min(12, Math.floor(Number(pedido.total))) }, (_, i) => `<option value="${i + 1}">${i + 1}x${i ? '' : ' (à vista)'}</option>`).join('')}</select></div>
                            <label class="campo-inteiro"><input type="checkbox" id="tap-sem-pagamento" required> Conferi na InfinitePay que a tentativa anterior não teve pagamento aprovado.</label>
                            <p class="campo-inteiro">Para Pix, o cliente paga pelo checkout. A tentativa anterior ficará no histórico; o valor e os descontos deste pedido serão mantidos.</p>
                            <button type="submit" class="btn btn-primary">Continuar com a forma escolhida</button>
                        </form>`}`;
                    $('tap-reabrir')?.addEventListener('click', () => {
                        if (!window.confirm('Confira primeiro no aplicativo InfinitePay: esta tentativa NÃO teve pagamento aprovado? Reabrir uma venda já paga pode cobrar o cliente novamente.')) return;
                        executar(acoes, feedback, async () => {
                            const resultado = await api(`/pagamentos/pedidos/${pedido.id}/tap`, { payment_method: 'credit', installments: 1, reabrir_sem_pagamento: true });
                            const link = document.createElement('a'); link.className = 'btn btn-primary';
                            link.href = resultado.url; link.textContent = 'Abrir InfiniteTap para retomar';
                            acoes.append(link); feedback.textContent = 'Use somente se confirmou no aplicativo que não houve pagamento.';
                        });
                    });
                    $('tap-conferencia').addEventListener('submit', event => {
                        event.preventDefault();
                        const dados = { transaction_nsu: $('tap-nsu').value.trim(), pagamento_id: p.id, conferido: $('tap-conferido').checked };
                        executar($('tap-conferencia'), feedback, async () => {
                            await api(`/pagamentos/pedidos/${pedido.id}/tap/conferir`, dados);
                            await window.pedidosAdmin.abrir(pedido.id);
                            window.pedidosAdmin.listar();
                        });
                    });
                    if ($('tap-trocar-form')) {
                        $('tap-nova-forma').value = p.modalidade === 'credit' ? 'credit' : 'debit';
                        $('tap-novas-parcelas').value = String(p.parcelas || 1);
                        const atualizarParcelas = () => {
                            const credito = $('tap-nova-forma').value === 'credit';
                            $('tap-novas-parcelas').disabled = !credito;
                            if (!credito) $('tap-novas-parcelas').value = '1';
                        };
                        atualizarParcelas();
                        $('tap-nova-forma').addEventListener('change', atualizarParcelas);
                        $('tap-trocar-form').addEventListener('submit', event => {
                            event.preventDefault();
                            const forma = $('tap-nova-forma').value;
                            const dados = { metodo: forma === 'checkout' ? 'checkout' : 'tap', pagamento_anterior_id: p.id,
                                sem_pagamento: $('tap-sem-pagamento').checked };
                            if (dados.metodo === 'tap') { dados.payment_method = forma; dados.installments = Number($('tap-novas-parcelas').value); }
                            executar(acoes, feedback, async () => {
                                let resultado;
                                try { resultado = await api(`/pagamentos/pedidos/${pedido.id}/trocar`, dados); }
                                catch (error) {
                                    // A nova tentativa pode ter sido salva antes de uma falha externa.
                                    // Reabrir mostra a cobrança atual e permite recuperá-la sem duplicar.
                                    await window.pedidosAdmin.abrir(pedido.id);
                                    const mensagem = $('cobranca-feedback'); if (mensagem) mensagem.textContent = error.message;
                                    return;
                                }
                                if (resultado.metodo === 'checkout') {
                                    await window.pedidosAdmin.abrir(pedido.id);
                                } else {
                                    const link = document.createElement('a'); link.className = 'btn btn-primary';
                                    link.textContent = 'Abrir InfiniteTap com a nova forma'; link.href = resultado.url;
                                    const voltar = document.createElement('button'); voltar.type = 'button'; voltar.className = 'btn btn-secondary';
                                    voltar.textContent = 'Atualizar resultado no pedido'; voltar.addEventListener('click', () => window.pedidosAdmin.abrir(pedido.id));
                                    acoes.replaceChildren(link, voltar);
                                    link.addEventListener('click', () => { setTimeout(() => window.pedidosAdmin.abrir(pedido.id), 1500); }, { once: true });
                                    feedback.textContent = 'Nova tentativa preparada. Confira o resultado no aplicativo InfinitePay antes de registrar o recebimento.';
                                }
                            });
                        });
                    }
                } else if (p?.checkout_url) {
                    if (new Date(p.expira_em) <= new Date()) {
                        acoes.textContent = 'Link expirado. Confira a cobrança na InfinitePay antes de emitir outro pedido.';
                    } else if (pedido.status === 'cancelado') {
                        acoes.textContent = 'Pedido cancelado. O cancelamento do pedido não invalida o link na InfinitePay. Confira a cobrança no aplicativo.';
                    } else {
                        const url = window.RenderSeguro.url(p.checkout_url);
                        acoes.innerHTML = `<p>Link válido até ${texto(new Date(p.expira_em).toLocaleString('pt-BR'))}. Entrega e valor bloqueados após a emissão.</p>
                            <div class="cobranca-botoes"><a class="btn btn-primary" href="${texto(url)}" target="_blank" rel="noopener noreferrer">Abrir checkout</a><button class="btn btn-secondary" type="button" id="cobranca-copiar">Copiar link</button></div>`;
                        $('cobranca-copiar').addEventListener('click', async () => {
                            try { await navigator.clipboard.writeText(url); feedback.textContent = 'Link copiado.'; }
                            catch { feedback.textContent = `Copie o link: ${url}`; }
                        });
                        const wa = whatsapp(pedido.telefone, `Olá, ${pedido.nome_completo}! Pedido #${pedido.id}\nProdutos: ${moeda(totalProdutos)}\nDesconto: ${moeda(pedido.desconto_manual || 0)}\nFrete: ${moeda(pedido.frete)}\nTotal: ${moeda(pedido.total)}\n${pedido.entrega_detalhes}\nFinalize o pagamento: ${url}`);
                        if (wa) {
                            const link = document.createElement('a'); link.className = 'btn btn-secondary';
                            link.textContent = 'Enviar link pelo WhatsApp'; link.href = wa; link.target = '_blank'; link.rel = 'noopener noreferrer';
                            acoes.querySelector('.cobranca-botoes').append(link);
                        }
                    }
                } else if (!bloqueado || (p?.metodo === 'checkout' && !['cancelado', 'finalizado'].includes(pedido.status))) {
                    acoes.innerHTML = `<p>Confirme a entrega e o valor antes de emitir. O link aceitará um pagamento e terá validade de 24 horas.</p>
                        <p>O checkout oferece Pix e cartão de crédito parcelado. As taxas, descontos por meio de pagamento e condições são definidos na conta InfinitePay. O total enviado aqui inclui somente produtos, desconto manual e frete.</p>
                        <div class="cobranca-botoes"><button type="button" id="cobranca-gerar" class="btn btn-primary">${p ? 'Recuperar cobrança Pix / crédito' : 'Gerar checkout Pix / crédito'}</button></div>`;
                    $('cobranca-gerar').disabled = pedido.frete == null || !pedido.entrega_tipo;
                    $('cobranca-gerar').addEventListener('click', () => executar(acoes, feedback, async () => {
                        await api(`/pagamentos/pedidos/${pedido.id}/checkout`, {});
                        await window.pedidosAdmin.abrir(pedido.id);
                        window.pedidosAdmin.listar();
                    }));
                    if (pedido.origem === 'presencial' && !p) {
                        acoes.insertAdjacentHTML('beforeend', `<form id="tap-iniciar" class="cobranca-form"><div><label for="tap-modalidade">Aproximação no InfiniteTap</label><select id="tap-modalidade"><option value="credit">Crédito</option><option value="debit">Débito</option></select></div><div><label for="tap-parcelas">Parcelas no crédito</label><select id="tap-parcelas">${Array.from({ length: Math.min(12, Math.floor(Number(pedido.total))) }, (_, i) => `<option value="${i + 1}">${i + 1}x${i ? '' : ' (à vista)'}</option>`).join('')}</select></div><button class="btn btn-primary" type="submit">Preparar cobrança por aproximação</button></form><p>Crédito em até 12x, com parcela mínima de R$ 1,00. Confira as taxas e condições finais no aplicativo InfinitePay antes de aproximar o cartão. Para Pix, use o checkout acima.</p>`);
                        $('tap-modalidade').addEventListener('change', () => {
                            const debito = $('tap-modalidade').value === 'debit';
                            $('tap-parcelas').disabled = debito;
                            if (debito) $('tap-parcelas').value = '1';
                        });
                        $('tap-iniciar').addEventListener('submit', event => {
                            event.preventDefault();
                            const dados = { payment_method: $('tap-modalidade').value, installments: Number($('tap-parcelas').value) };
                            executar(acoes, feedback, async () => {
                                const resultado = await api(`/pagamentos/pedidos/${pedido.id}/tap`, dados);
                                // Link clicado pelo operador preserva gesto do usuário necessário ao Android.
                                const link = document.createElement('a'); link.className = 'btn btn-primary';
                                link.textContent = 'Abrir InfiniteTap para cobrar'; link.href = resultado.url;
                                acoes.replaceChildren(link);
                                link.addEventListener('click', () => {
                                    setTimeout(() => window.pedidosAdmin.abrir(pedido.id), 1500);
                                }, { once: true });
                                feedback.textContent = 'Cobrança preparada. Abra o InfiniteTap e confira o resultado no aplicativo antes de registrar o pagamento.';
                            });
                        });
                    }
                }
                if (historico.length) {
                    const detalhes = document.createElement('details');
                    const titulo = document.createElement('summary'); titulo.textContent = 'Tentativas anteriores de pagamento'; detalhes.append(titulo);
                    const lista = document.createElement('ul');
                    historico.forEach(tentativa => {
                        const item = document.createElement('li');
                        item.textContent = `${tentativa.modalidade === 'debit' ? 'Débito' : 'Crédito'} · ${Number(tentativa.parcelas || 1)}x · substituída em ${new Date(tentativa.substituida_em).toLocaleString('pt-BR')} após conferência do operador.`;
                        lista.append(item);
                    });
                    detalhes.append(lista); alvo.append(detalhes);
                }
            } catch (error) { if (alvo.isConnected) alvo.textContent = error.message; }
        }
    };

    let chave = null;
    let criado = null;
    let opcoes = { clientes: [], vinhos: [] };
    async function carregarOpcoes() {
        const feedback = $('venda-feedback');
        try {
            const dados = await api(`/vendas-rapidas/opcoes?busca=${encodeURIComponent($('venda-busca-cliente').value.trim())}`, undefined, 'GET');
            opcoes = dados;
            const select = $('venda-cliente'); const anterior = select.value;
            select.innerHTML = '<option value="">Selecione um cliente</option>';
            dados.clientes.forEach(c => {
                const option = document.createElement('option'); option.value = c.id;
                option.textContent = `${c.nome_completo} · ${c.email}`; select.append(option);
            });
            select.value = anterior;
            const produto = $('venda-produto'); const anteriorProduto = produto.value;
            produto.innerHTML = '<option value="">Selecione um vinho</option>';
            dados.vinhos.forEach(v => {
                const option = document.createElement('option'); option.value = v.id;
                option.textContent = `${v.nome} · ${moeda(v.preco)} (antes dos benefícios do cliente)`; produto.append(option);
            });
            produto.value = anteriorProduto;
            feedback.textContent = 'Selecione o cliente e os vinhos para conferir os preços antes de registrar.';
            window.dispatchEvent(new Event('venda:opcoes'));
        } catch (error) { feedback.textContent = error.message; }
    }
    document.addEventListener('DOMContentLoaded', () => {
        if (!$('venda-rapida') || !window.authManager?.isAdmin()) return;
        let iniciado = false;
        const itens = new Map();
        let previa = null, versaoPrevia = 0, timerPrevia;
        const desconto = () => ({ tipo: $('venda-desconto-tipo').value, valor: $('venda-desconto-valor').value || '0' });
        const itensEnviados = () => [...itens].map(([id, item]) => ({ id, quantidade: item.quantidade }));
        const desenhar = (precos = null) => {
            $('venda-itens').replaceChildren();
            itens.forEach((i, id) => {
                const linha = document.createElement('li');
                const calculado = precos?.itens.find(p => p.id === id);
                const span = document.createElement('span'); span.textContent = `${i.quantidade} × ${i.nome}`;
                const preco = document.createElement('small'); preco.textContent = calculado ? `${moeda(calculado.preco)} por unidade · Subtotal ${moeda(calculado.subtotal)}` : 'Aguardando cálculo dos preços para este cliente';
                span.append(preco);
                const remover = document.createElement('button'); remover.type = 'button'; remover.className = 'btn btn-secondary';
                remover.textContent = 'Remover'; remover.addEventListener('click', () => { if (!criado) { itens.delete(id); desenhar(); agendarPrevia(); } });
                linha.append(span, remover); $('venda-itens').append(linha);
            });
        };
        async function recalcular(versao) {
            const dados = { itens: itensEnviados(), desconto: desconto() };
            if ($('venda-novo-cliente').checked) dados.novo_cliente = true;
            else dados.cliente_id = Number($('venda-cliente').value);
            try {
                const resultado = await api('/vendas-rapidas/simular', dados);
                if (versao !== versaoPrevia || criado) return;
                previa = resultado; desenhar(resultado);
                $('venda-resumo').textContent = `Produtos com benefícios do cliente: ${moeda(resultado.subtotal)} · Desconto manual: ${moeda(resultado.desconto_manual)} · Total: ${moeda(resultado.total)}`;
                $('venda-registrar').disabled = false;
                $('venda-feedback').textContent = 'Confira os preços e o total acima antes de registrar a venda.';
            } catch (error) {
                if (versao !== versaoPrevia || criado) return;
                $('venda-resumo').textContent = error.message;
            }
        }
        function agendarPrevia() {
            if (criado) return;
            clearTimeout(timerPrevia); const versao = ++versaoPrevia; previa = null;
            $('venda-registrar').disabled = true; desenhar();
            if (!itens.size) { $('venda-resumo').textContent = 'Adicione vinhos para calcular o total.'; return; }
            if (!$('venda-novo-cliente').checked && !$('venda-cliente').value) { $('venda-resumo').textContent = 'Selecione ou pré-cadastre o cliente para calcular os preços.'; return; }
            $('venda-resumo').textContent = 'Calculando preços e desconto…';
            timerPrevia = setTimeout(() => recalcular(versao), 250);
        }
        window.addEventListener('venda:opcoes', agendarPrevia);
        $('venda-cliente').addEventListener('change', agendarPrevia);
        $('venda-desconto-tipo').addEventListener('change', () => {
            $('venda-desconto-valor').max = $('venda-desconto-tipo').value === 'percentual' ? '100' : '99999999.99';
            agendarPrevia();
        });
        $('venda-desconto-valor').addEventListener('input', agendarPrevia);
        window.addEventListener('painel:secao', event => {
            if (event.detail.secao === 'venda-rapida' && !iniciado) { iniciado = true; carregarOpcoes(); }
        });
        if (!$('venda-rapida').hidden) { iniciado = true; carregarOpcoes(); }
        $('venda-buscar').addEventListener('click', carregarOpcoes);
        $('venda-busca-cliente').addEventListener('keydown', event => {
            if (event.key === 'Enter') { event.preventDefault(); carregarOpcoes(); }
        });
        $('venda-novo-cliente').addEventListener('change', () => {
            const novo = $('venda-novo-cliente').checked;
            $('venda-precadastro').hidden = !novo; $('venda-cliente').disabled = novo;
            $('venda-precadastro').querySelectorAll('input').forEach(input => { input.required = novo; input.disabled = !novo; });
            agendarPrevia();
        });
        $('venda-adicionar').addEventListener('click', () => {
            if (criado) return;
            const id = Number($('venda-produto').value); const quantidade = Number($('venda-quantidade').value);
            const vinho = opcoes.vinhos.find(v => v.id === id);
            const soma = (itens.get(id)?.quantidade || 0) + quantidade;
            if (!vinho || !Number.isInteger(quantidade) || quantidade < 1 || soma > 999) {
                $('venda-feedback').textContent = 'Selecione um vinho e uma quantidade entre 1 e 999.'; return;
            }
            itens.set(id, { nome: vinho.nome, quantidade: soma }); desenhar(); agendarPrevia();
        });
        $('venda-form').addEventListener('submit', event => {
            event.preventDefault();
            if (!itens.size) { $('venda-feedback').textContent = 'Adicione pelo menos um vinho.'; return; }
            if (!previa && !criado) { $('venda-feedback').textContent = 'Aguarde e confira o cálculo do total antes de registrar.'; agendarPrevia(); return; }
            chave ||= crypto.randomUUID();
            const dados = { chave_criacao: chave, itens: itensEnviados(), desconto: desconto(),
                total_previsto: previa?.total.toFixed(2), observacoes: $('venda-observacoes').value.trim() };
            if ($('venda-novo-cliente').checked) dados.cliente = { nome_completo: $('venda-nome').value.trim(), telefone: $('venda-telefone').value.trim(), email: $('venda-email').value.trim() };
            else dados.cliente_id = Number($('venda-cliente').value);
            executar($('venda-form'), $('venda-feedback'), async () => {
                const resultado = criado ? { pedidoId: criado } : await api('/vendas-rapidas', dados);
                criado = resultado.pedidoId;
                $('venda-form').dataset.registrado = 'true';
                $('venda-feedback').textContent = `Venda #${criado} registrada. Abra o pedido para cobrar. Inicie uma nova venda antes de atender outro cliente.`;
                $('venda-abrir-pedido').hidden = false; $('venda-abrir-pedido').textContent = `Abrir venda #${criado} para cobrar`;
                await window.pedidosAdmin.abrir(criado); window.pedidosAdmin.listar(); window.pedidosAdmin.resumo();
            });
        });
        $('venda-abrir-pedido').addEventListener('click', () => { if (criado) window.pedidosAdmin.abrir(criado); });
        $('venda-nova').addEventListener('click', () => {
            if (!criado && itens.size && !window.confirm('Descartar os itens desta venda ainda não registrada?')) return;
            criado = null; chave = null; itens.clear(); desenhar(); $('venda-form').reset();
            previa = null; ++versaoPrevia; clearTimeout(timerPrevia);
            delete $('venda-form').dataset.registrado;
            $('venda-form').querySelectorAll('button,input,select,textarea').forEach(c => { c.disabled = false; });
            $('venda-precadastro').hidden = true; $('venda-cliente').disabled = false;
            $('venda-precadastro').querySelectorAll('input').forEach(i => { i.required = false; i.disabled = true; });
            $('venda-abrir-pedido').hidden = true; $('venda-feedback').textContent = 'Nova venda pronta para atendimento.';
            carregarOpcoes();
            agendarPrevia();
        });
    });
})();
