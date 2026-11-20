# Validação do catálogo e da operação

Data: 19/11/2026, fuso America/Sao_Paulo.

Site: https://catalogointerativo.vercel.app/

Deployment inspecionado: `dpl_71NCsTsForCvjRFosTj9i4CcwkaK`, estado `READY`.
Commit publicado: `aeec702fc8bdf3b531ced910786179b3ce9652d7`.

## Produção: verificações públicas realizadas

- Catálogo e APIs de vinhos, configurações e benefícios responderam HTTP 200.
- A versão publicada contém Clientes integrado à navegação do painel.
- Rotas administrativas exigem autenticação.
- Confirmação de maioridade, busca, estado vazio e limpeza dos filtros funcionaram no navegador.
- Grade: duas colunas em 320/390 px, três em 768 px, quatro em 1024 px e cinco em 1440 px, sem rolagem horizontal.
- Ficha, seleção de quantidade e carrinho funcionaram. Finalizar sem sessão abriu o login sem registrar pedido.
- Nenhuma exceção JavaScript ou resposta HTTP com erro apareceu na navegação pública verificada.
- Produção possui um rótulo cadastrado, conforme o cenário de teste informado pelo responsável.

As consultas de runtime pela integração Vercel encontraram avisos do driver PostgreSQL sobre `sslmode`, classificados como erro por saírem em stderr. Os registros examinados eram avisos de compatibilidade futura, sem exceção da aplicação; as APIs consultadas responderam normalmente. Esta amostra não comprova ausência de erros fora da janela consultada.

## Fluxo completo em ambiente isolado

Executado no Edge com frontend e Express reais, usando pool PostgreSQL, armazenamento de sessões e envio de e-mails simulados. Nenhuma alteração no Neon e nenhum envio de mensagem ao WhatsApp.

| Etapa | Resultado |
|---|---|
| Catálogo com vários rótulos | Sete rótulos públicos; produto oculto excluído; busca por produtor funcionando |
| Login do cliente | Formulário, verificação bcrypt e criação da sessão passaram |
| Benefício VIP | Desconto de 3% sobre R$ 119,00 gerou R$ 115,43 por unidade |
| Pedido | Duas unidades, total de R$ 230,86, itens e valores coerentes entre navegador e API |
| WhatsApp | Link gerado com os dados confirmados pela API, sem envio de mensagem |
| Painel | Pedido registrado apareceu na fila e nos detalhes |
| Novo pedido | Aviso apresentado uma única vez após atualização do resumo |
| Status | Alteração para Confirmado persistiu e apareceu no histórico do cliente |
| E-mails | Eventos de pedido novo e status foram gerados; entrega real não testada |
| Edição do cliente | CPF vazio salvo como NULL; CPF duplicado retornou mensagem e preservou o formulário |
| Sair | Sessão revogada, armazenamentos limpos, retorno ao site e token anterior recusado com HTTP 401 |

Suíte automatizada: **275 testes passaram**, incluindo seis regressões para imagens e duas para exclusão de pedidos cancelados do total gasto.

## Problema encontrado e corrigido localmente

As URLs de imagem acumulavam transformações de 400 px ao serem reeditadas. Uma foto solicitada para a ficha com transformação de 800 px ainda passava por reduções de 400 px.

A otimização agora substitui somente os tamanhos conhecidos da aplicação e preserva transformações personalizadas e URLs assinadas. O editor usa a URL de origem. URLs antigas acumuladas são tratadas durante a exibição, sem migração do banco.

Verificação no navegador: duas edições consecutivas mantiveram a URL de origem no banco simulado e a ficha carregou imagem de **800 × 800 px**, sem transformações de 400 px acumuladas. A correção está publicada; o carregamento em 800 px também foi confirmado em produção.

## Produção: validação autenticada concluída

A conta administrativa de teste foi criada pelo responsável via SQL no Neon. As credenciais permanecem somente no arquivo local ignorado pelo Git.

- Login pelo formulário público e validação da permissão administrativa passaram.
- As APIs de usuário autenticado, resumo e fila de pedidos responderam HTTP 200 com a conta de teste.
- O formulário de Clientes salvou temporariamente nome, CPF vazio como NULL e benefício VIP nessa própria conta. A leitura da API confirmou os valores persistidos no Neon.
- O catálogo atualizou o benefício da sessão. Com o benefício percentual vigente de 4%, o produto de R$ 119,00 passou a R$ 114,24; duas unidades totalizaram R$ 228,48 no carrinho.
- A foto da ficha foi carregada e decodificada em 800 px, sem redimensionamentos de 400 px acumulados.
- A API recusou pedido com produto inexistente, com HTTP 409. O histórico da conta continuou sem pedidos gravados.
- Nome e configuração VIP da conta foram restaurados e conferidos na API ao terminar.
- O botão Sair retornou ao site, removeu as credenciais do navegador e revogou a sessão. O token encerrado recebeu HTTP 401 em nova consulta a `/api/auth/me`.
- A sessão da tentativa inicial também foi encerrada, sem deixar sessões abertas pelos testes.
- Nenhuma exceção da aplicação apareceu na verificação autenticada pelo navegador.

Somente o cadastro da conta de teste foi alterado e restaurado. Não foram criados pedidos reais nem enviados avisos por e-mail nessa etapa.

## Produção: pedido real autorizado

O responsável autorizou explicitamente criar um pedido de teste e cancelá-lo, incluindo os avisos automáticos por e-mail.

- Foi criado um único pedido, **#4**, de **R$ 119,00**, pela API autenticada da conta de teste.
- A observação começa com `TESTE AUTOMATIZADO AUTORIZADO` e informa para não preparar, faturar ou entregar.
- A atualização automática do painel detectou o pedido e exibiu o aviso. Outra consulta ao resumo não duplicou o aviso.
- O pedido foi cancelado pela API administrativa. A conferência posterior confirmou `cancelado` no Neon.
- O painel exibiu o status cancelado e o histórico do cliente mostrou o mesmo pedido cancelado.
- Salvar novamente o status já selecionado exibiu a orientação de que ele já estava salvo, sem nova alteração.
- As sessões usadas para essa verificação foram encerradas.

Os fluxos de e-mail associados à criação e ao cancelamento foram acionados. As consultas aos logs com o filtro `[email]` não retornaram falhas no intervalo examinado. O responsável confirmou nesta conversa o recebimento dos e-mails do teste. Essa confirmação é manual; a caixa de entrada não foi inspecionada automaticamente pelas ferramentas.

## Ajuste encontrado no teste real

O indicador Total gasto do cliente incluía o pedido cancelado de R$ 119,00. A correção local exclui pedidos cancelados da soma, preservando o pedido no histórico e mantendo o tratamento dos demais status.

Dois testes de regressão passaram. A conferência no navegador com dados simulados mostrou **R$ 0,00** para um cliente com apenas um pedido cancelado, mantendo esse pedido visível no histórico. Esse ajuste ainda precisa de commit e deploy; a versão inspecionada em produção ainda apresentava a soma anterior.

## Limites da validação

O pedido autorizado permanece no histórico como cancelado, para preservar o registro do teste. Nenhuma compra de cliente real foi modificada.

Credenciais não devem ser incluídas em commits ou neste relatório.

## Repetir as verificações

```sh
npm test
npm run verificar:producao
```

`verificar:producao` consulta somente páginas e APIs públicas e confirma a exigência de autenticação nas rotas privadas. Não faz login nem grava dados. Outro domínio pode ser definido pela variável `VALIDACAO_URL`.
