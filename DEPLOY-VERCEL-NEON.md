# Migração para Vercel e Neon

Este projeto usa PostgreSQL no Neon e pode ser implantado na Vercel. O schema e o código não migram os dados automaticamente durante o deploy.

## 1. Revogar credenciais expostas

Credenciais funcionais e dados de clientes foram encontrados em arquivos rastreados pelo Git e removidos do estado atual do projeto. Antes de continuar:

- Troque as credenciais do MySQL/Railway, Cloudinary e SMTP que estavam nos arquivos.
- Use somente os novos valores; não recupere credenciais de commits antigos.
- Não faça push supondo que apagar os arquivos removeu os segredos do histórico. Os commits existentes continuam contendo os valores; a limpeza do histórico exige reescrita coordenada do Git e atualização do remoto.
- Avalie os backups e dados pessoais expostos e limite o acesso às cópias restantes.

## 2. Criar e preparar o Neon

1. Crie um projeto PostgreSQL no Neon.
2. No SQL Editor do Neon, execute [`database/schema.postgresql.sql`](./database/schema.postgresql.sql).
3. Use a URL pooled do Neon para a aplicação na Vercel, com SSL habilitado (`sslmode=require`).
4. Não coloque a URL, senhas ou tokens em arquivos versionados.

## 3. Migrar os dados MySQL

### Atualização de um catálogo que já está no Neon

Para a versão que permite revogar sessões, execute
[`database/migrations/20261110_sessoes_usuario.sql`](./database/migrations/20261110_sessoes_usuario.sql)
no SQL Editor do banco usado pela Vercel **antes do push que publicará o novo código**.
Essa migração pode ser aplicada enquanto a versão anterior continua atendendo.
Ela cria a tabela de sessões e o trigger que as revoga quando senha ou permissão
administrativa mudam; não altera senhas, produtos ou pedidos existentes.
Não há novas variáveis de ambiente ou dependências para configurar.

Após publicar, faça login novamente (tokens da versão anterior serão recusados),
teste `/api/auth/me`, saia e confirme que o token anterior passa a receber HTTP 401.
Uma segunda sessão em outro dispositivo deve continuar válida após esse logout.
Teste também a recuperação de senha e a mudança de permissão com contas de teste:
ambas devem invalidar as sessões anteriores da conta alterada.

### Importação inicial de uma base MySQL

Faça um backup controlado da origem antes de migrar. Depois de revogar as credenciais vazadas, obtenha credenciais novas para a origem e configure-as em um `.env` local ignorado pelo Git, junto com a URL do Neon:

```env
MYSQLHOST=host-mysql
MYSQLPORT=3306
MYSQLUSER=usuario-de-migracao
MYSQLPASSWORD=senha-nova
MYSQLDATABASE=nome-do-banco
DATABASE_URL=postgresql://usuario:senha@host-neon/nome-do-banco?sslmode=require
```

O script copia `usuarios`, `vinhos`, `configuracoes`, `beneficios_vip`, `pedidos`, `pedidos_itens` e `password_resets` quando essa última tabela existir na origem. Ele exige que as tabelas de destino estejam vazias, aborta se encontrar colunas de origem que não existam no schema Neon e preserva os IDs. Execute uma única vez:

```powershell
npm run migrate:mysql-to-neon
```

O processo lê dados pessoais e hashes de senha para copiá-los, mas não os escreve nos logs. Mantenha o terminal e os arquivos de configuração protegidos. Verifique os totais por tabela antes de direcionar o tráfego para a nova hospedagem.

## 4. Configurar a Vercel

1. Importe o repositório no painel da Vercel e mantenha a raiz do projeto como diretório de implantação.
2. Configure as variáveis de ambiente de produção:
   - `DATABASE_URL`: URL pooled do Neon.
   - `JWT_SECRET`: valor aleatório forte e novo.
   - Credenciais atuais do Cloudinary e do provedor de e-mail.
   - `APP_URL`: URL pública final do site.
   - `NODE_ENV=production`.
3. Faça o deploy e teste a página principal, `/admin`, `/health`, catálogo, login, cadastro, pedidos, uploads e recuperação de senha.
4. Só então atualize o domínio/DNS e desligue a aplicação antiga. Mantenha o backup de origem protegido durante a validação.

Os arquivos estáticos continuam na raiz do projeto; `api/index.js` exporta a aplicação Express como função da Vercel. O servidor local continua iniciando com `npm start`.

## 5. Desenvolver localmente

Copie `.env.example` para `.env`, informe `DATABASE_URL` e os demais serviços necessários e execute:

```powershell
npm install
npm start
```

O endpoint de desenvolvimento `/api/setup/setup` apenas verifica se as tabelas esperadas existem. O schema deve ser aplicado pelo SQL Editor do Neon.
