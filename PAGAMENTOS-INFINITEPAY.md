# Pedidos assistidos e venda rápida — InfinitePay

Implementação local. A publicação continua pelo commit/push no GitHub e deploy da Vercel.

## Ativação

1. No SQL Editor do Neon do catálogo, execute **database/migrations/20261120_pagamentos_infinitepay.sql**. A migração é aditiva e pode ser reaplicada. Pedidos antigos preservam o total e ficam com frete ainda não definido.
2. Na conta InfinitePay **davini-vinhos-finos**, ative **Checkout Integrado** nas configurações do checkout e gere uma API Key. Guarde a chave diretamente no ambiente **Production** do projeto Vercel; nunca envie pelo chat nem versione em arquivos.
3. Configure na Vercel:

   | Variável | Valor |
   |---|---|
   | `INFINITEPAY_HANDLE` | `davini-vinhos-finos` |
   | `INFINITEPAY_API_KEY` | Chave secreta `inchk_...` da própria conta da loja |
   | `APP_URL` | `https://catalogointerativo.vercel.app` ou domínio definitivo HTTPS |

4. Faça o commit/push. As variáveis precisam estar presentes no novo deployment. Mudanças de variável após o deploy exigem redeploy.
5. Confira `GET /api/pagamentos/config` com login administrativo: `checkout: true` e `tap: true`. A rota não retorna a chave. Uma credencial presente ainda precisa ser validada pelo provedor na emissão real.

Não configure credenciais de produção em previews públicos para testes. O provedor **não possui sandbox de checkout**: emitir link cria uma cobrança real e pagar movimenta dinheiro. A suíte local substitui somente o transporte da InfinitePay e usa PostgreSQL em memória. Não houve emissão nem pagamento real durante a implementação.

## Pedido do catálogo

O carrinho continua registrando o pedido e abrindo a conversa no WhatsApp. A mensagem diferencia o subtotal dos produtos do frete ainda a combinar.

No painel **Pedidos → Ver pedido → Entrega e pagamento**:

1. Combine com o cliente endereço/local, prazo e frete.
2. Informe entrega ou retirada, valor do frete e detalhes. Na retirada, salve frete zero explicitamente.
3. Use **Salvar entrega e recalcular total**. O servidor soma os itens originalmente vendidos ao frete, sem recalcular preços atuais nem somar o frete duas vezes.
4. Confira o total e selecione **Gerar link de pagamento**.
5. Use **Enviar link pelo WhatsApp** ou **Copiar link**. O envio pelo WhatsApp depende da ação do operador; não é disparado automaticamente.

O link é de uso único, válido por 24 horas. Os itens enviados incluem o frete e os preços efetivamente vendidos. Parcelamento e taxas seguem as condições da conta InfinitePay: confira as configurações comerciais antes de operar.

Depois de iniciar uma cobrança, os detalhes de entrega e o total ficam bloqueados. Reenviar o link utiliza a mesma cobrança. Erros de comunicação preservam seu identificador e payload; aguarde 30 segundos e use **Recuperar cobrança**. Não crie outro pedido apenas porque uma requisição demorou.

O webhook é informado por cobrança, sem cadastro manual de uma URL global. O backend consulta `payment_check` antes de registrar o pagamento, valida o valor original e a associação ao pedido. Parâmetros do navegador e webhook sem assinatura não comprovam pagamento. O status do pagamento é separado do status operacional do pedido.

O cliente que retorna da InfinitePay vê a consulta da confirmação. O histórico mostra frete e detalhes combinados. A loja acompanha a confirmação abrindo o pedido no painel; os detalhes não fazem consulta automática em tempo real, então reabra o pedido se a tela já estava aberta no momento do pagamento.

## Venda rápida no painel

Abra **Venda rápida**, busque um cliente ou faça o pré-cadastro com nome, telefone e e-mail. Adicione vinhos e quantidades e registre a venda para conferir o total antes de cobrar.

- O backend calcula os preços com os benefícios do **cliente selecionado**, sem usar o VIP do administrador.
- A venda aparece nos pedidos e no histórico do cliente, com identificação do vendedor.
- O pré-cadastro gera uma senha aleatória protegida por bcrypt, que não é entregue ao vendedor. O cliente pode definir sua senha por **Esqueci minha senha**, usando seu próprio e-mail.
- Não há disparo de convite ou boas-vindas pelo pré-cadastro. Confirmações de status seguem as notificações de pedido existentes.
- A venda começa como retirada presencial, com frete zero. É possível ajustar a entrega antes da cobrança.
- Reenvios com a mesma chave não duplicam cliente nem pedido. Após registrar, use **Nova venda** para o próximo atendimento.

## InfiniteTap no Galaxy S24 FE

Na venda presencial registrada, escolha crédito/débito e parcelas, selecione **Preparar cobrança por aproximação** e depois **Abrir InfiniteTap para cobrar**. Esse segundo toque é intencional: o navegador precisa de uma ação do usuário para abrir outro aplicativo.

A comunicação usa o deeplink oficial `infinitepaydash://infinitetap-app`, com valor em centavos, modalidade, parcelas, conta esperada e identificador da cobrança. O NFC é processado pelo aplicativo InfinitePay. O retorno tenta abrir a página HTTPS da loja.

**Limite da validação:** a documentação exemplifica retorno para aplicativos por esquema próprio; não garante o retorno HTTPS em todos os navegadores/PWAs. O acionamento e a volta precisam ser testados no aparelho real, com o aplicativo InfinitePay atualizado e a conta da loja habilitada para InfiniteTap. Se o retorno HTTPS não funcionar, volte manualmente ao painel; pode ser necessário um aplicativo auxiliar para um retorno automático.

**Aprovação presencial não é automática nesta versão.** A documentação pública consultada não estabelece uma confirmação autenticada servidor a servidor para esse retorno do Tap, e `payment_check` do checkout não deve ser presumido como compatível com o Tap. O retorno não muda o pedido para pago.

Depois da cobrança, reabra o pedido, confira **na conta InfinitePay** a aprovação, o valor e o cliente, informe o NSU UUID da transação e marque a confirmação. O banco registra **manual_admin**, administrador e horário. Não confunda o NSU UUID com o código de autorização do cartão.

Se o aplicativo não abriu ou a transação falhou, existe **Reabrir tentativa sem pagamento aprovado**, com confirmação explícita de que o operador verificou a ausência de pagamento na InfinitePay. A modalidade e as parcelas originais são preservadas. O deeplink do Tap não oferece garantia documentada de idempotência: reabrir sem conferir pode duplicar uma cobrança. Nunca reabra se já houver pagamento aprovado.

## Cancelamento, expiração e estorno

Cancelar o pedido no catálogo **não cancela o link ou a transação na InfinitePay**. Confira a cobrança no aplicativo/conta web e trate os cancelamentos/estornos lá. A integração atual não solicita estorno automaticamente.

Um pagamento recebido após cancelar o pedido fica registrado como pago, mas mantém o pedido cancelado e exibe aviso para revisão. Não reabre a entrega. Estornos feitos posteriormente na InfinitePay ainda precisam ser conciliados manualmente no atendimento; esta versão recebe somente a confirmação de pagamento do checkout.

Links expirados não são regenerados automaticamente. A cobrança existente permanece registrada para conferência e recebimento de eventual confirmação tardia. A validade de 24 horas é do checkout; não representa uma expiração garantida de uma tentativa no aplicativo InfiniteTap.

## Validação

`npm test` inclui testes com PostgreSQL em memória e transporte InfinitePay simulado para: autorização, migração reaplicável, frete, centavos, uso único, reenvio, falha de emissão, retorno adulterado, confirmação idempotente, pedido cancelado, pré-cadastro, VIP e conferência do Tap.

O roteiro local `.local/verificar-pagamentos-browser.cjs` também percorre navegador real → Express → PostgreSQL em memória → provedor simulado → interface. Os testes de layout cobrem 320, 390, 768 e 1440 pixels. Não comprovam NFC, aprovação financeira nem compatibilidade de retorno no celular.

Documentação oficial consultada: [Checkout](https://www.infinitepay.io/checkout-documentacao) e [InfiniteTap](https://www.infinitepay.io/checkout-tap).
