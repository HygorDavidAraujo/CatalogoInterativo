# Notificações persistentes, push e revisão visual

## Ativação

1. Executar `database/migrations/20261119_notificacoes_push.sql` no SQL Editor do Neon, no banco do catálogo. O responsável confirmou nesta conversa a execução.
2. Manter `WEBPUSH_PUBLIC_KEY`, `WEBPUSH_PRIVATE_KEY` e `WEBPUSH_SUBJECT` no ambiente Production da Vercel. As três variáveis já foram criadas após autorização explícita do responsável. A cópia local está em `.env.push.local`, ignorada pelo Git. Não gerar novas chaves a cada deploy.
3. Fazer commit e deploy pela integração GitHub → Vercel.
4. Entrar no painel como administrador, abrir **Avisos** e clicar em **Ativar neste dispositivo**. Cada dispositivo precisa dessa adesão e da permissão do navegador.

No iPhone/iPad, a ativação exige abrir o aplicativo adicionado à Tela de Início, conforme o [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/). A entrega também depende das permissões, da conectividade e das políticas do navegador e do sistema operacional.

## Operação

- **Pedidos:** contador de pedidos em aberto.
- **Avisos:** contador de notificações não lidas do administrador, persistido no Neon.
- A central exibe somente avisos não lidos e permite carregar os anteriores ainda pendentes. Abrir um aviso mostra o pedido, registra a leitura e remove o aviso da central. Abrir o pedido por push ou outro link também registra a leitura e retira o aviso da lista. O registro de leitura permanece no banco e não altera a central de outro administrador.
- **Marcar todas como lidas** considera até a notificação mais recente já carregada; um novo pedido recebido durante a operação continua não lido.
- Cada administrador tem suas próprias leituras. Recarregar ou fazer novo login preserva esse histórico.
- Novos pedidos passam a gerar avisos após a migração. Os pedidos antigos não são reenviados como notificações novas.
- **Desativar neste dispositivo** remove a inscrição e grava a preferência de não receber avisos. Ela permanece desativada após novo login até ser ativada explicitamente.
- Sair encerra a sessão, remove suas inscrições no banco e suspende a recepção local, mas preserva a preferência e a inscrição do navegador. Ao retornar ao painel com a mesma conta, a inscrição é vinculada à nova sessão e os avisos voltam automaticamente, sem nova solicitação de permissão. A preferência não é reaproveitada automaticamente para outro administrador no mesmo dispositivo.
- O aviso na tela bloqueada contém apenas texto genérico. Nome, contato, produtos e valores ficam no painel autenticado.
- Inscrições expiradas, identificadas pelo serviço de push com HTTP 404/410, são removidas. Falhas de push não desfazem um pedido já confirmado.

## Implementação

O gatilho `pedidos_registrar_notificacao` insere `notificacoes_pedidos` na mesma transação que cria o pedido. `notificacoes_leituras` registra o administrador e a data da leitura. `push_inscricoes` é vinculada à sessão por chave estrangeira com exclusão em cascata.

A API `/api/notificacoes` exige sessão administrativa atual e usa `private, no-store`. Ela oferece resumo, paginação por cursor, leituras e inscrição/desinscrição de dispositivos. O envio usa o protocolo Web Push com VAPID e payload cifrado, pelo pacote [web-push](https://github.com/web-push-libs/web-push). A chave privada permanece no backend.

A aplicação envia push apenas para provedores conhecidos, limita inscrições por administrador e não aceita destinos HTTP, endereços locais ou hosts arbitrários. O Service Worker abre somente páginas do próprio site e não guarda tokens de login.

## Revisão visual

- Cards com área de imagem padronizada, bordas e fundos suaves, informações de uva/safra compactas, etiquetas de perfil e ações com área de toque adequada.
- Nomes completos e preços alinhados entre cards, mantendo duas colunas no celular, três em telas intermediárias e quatro/cinco no desktop.
- Destaque com apresentação vinho/dourado, fixação manual de sete dias e seleção automática semanal no fuso de Brasília. Datas futuras não são aceitas como fixação válida; produtos ocultos nunca são escolhidos.
- Central de notificações com diferenciação entre lidas e não lidas. Cabeçalho administrativo compacto em duas colunas no celular.

## Validação

Os testes usam PostgreSQL em memória com [PGlite](https://pglite.dev/docs/), executando o schema e as consultas SQL reais. Cobrem transação/rollback do aviso, migração idempotente, ausência de avisos retroativos, isolamento das leituras por administrador, paginação, destinos e chaves inválidas, remoção de inscrições por expiração e logout, cifras/assinatura VAPID e comportamento do Service Worker.

A verificação no Edge usou frontend e Express reais com PostgreSQL em memória e transporte de push simulado. Passaram leitura persistida após recarga, adesão/desativação, novo pedido, leitura em lote, isolamento entre administradores, abertura com token sem sessionStorage e logout. O push foi emulado no Service Worker real e gerou uma notificação nativa do navegador.

O catálogo com vários rótulos e o painel foram conferidos em 320, 390, 768, 1024 e 1440 px, sem rolagem horizontal nem exceções JavaScript. Essa verificação isolada não comprova a entrega pelo provedor de push em produção: após o deploy, deve-se ativar um dispositivo real e conferir a chegada de um aviso.
