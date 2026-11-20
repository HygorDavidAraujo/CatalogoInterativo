# Validação do catálogo e da operação

Data: 19/11/2026, fuso America/Sao_Paulo.

Site: https://catalogointerativo.vercel.app/

Deployment inspecionado: `dpl_52XLMZjtQ35Dy51oi8fuRADBWfNC`, estado `READY`.
Commit publicado: `265f9ec7f4847f07f896d3fa58196b16c815cfca`.

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

Suíte automatizada: **273 testes passaram**, incluindo seis regressões novas para imagens.

## Problema encontrado e corrigido localmente

As URLs de imagem acumulavam transformações de 400 px ao serem reeditadas. Uma foto solicitada para a ficha com transformação de 800 px ainda passava por reduções de 400 px.

A otimização agora substitui somente os tamanhos conhecidos da aplicação e preserva transformações personalizadas e URLs assinadas. O editor usa a URL de origem. URLs antigas acumuladas são tratadas durante a exibição, sem migração do banco.

Verificação no navegador: duas edições consecutivas mantiveram a URL de origem no banco simulado e a ficha carregou imagem de **800 × 800 px**, sem transformações de 400 px acumuladas. A correção ainda precisa de commit e deploy.

## Limites e pendência de produção

A validação autenticada no ambiente publicado permanece pendente: não há credenciais de uma conta de testes disponíveis no ambiente local. Cadastro/edição real de clientes, pedido real no Neon, status e logout em produção não foram declarados aprovados com base nos testes simulados.

Para concluir essa parte, é necessária uma conta de teste e a execução do mesmo fluxo contra a aplicação publicada. Credenciais não devem ser incluídas em commits ou neste relatório.

## Repetir as verificações

```sh
npm test
npm run verificar:producao
```

`verificar:producao` consulta somente páginas e APIs públicas e confirma a exigência de autenticação nas rotas privadas. Não faz login nem grava dados. Outro domínio pode ser definido pela variável `VALIDACAO_URL`.
