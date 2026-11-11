# Catálogo Interativo - Davini Vinhos Finos

Sistema web completo de catálogo interativo para exibição de vinhos da vinícola com backend Node.js, banco de dados PostgreSQL (Neon) e upload de imagens.

## 📋 Sobre o Projeto

Este é um catálogo interativo moderno desenvolvido para a Davini Vinhos Finos, permitindo a exibição organizada dos vinhos disponíveis com informações detalhadas e um sistema de administração completo para gerenciamento dos produtos e configurações do site.

## ✨ Funcionalidades

### Página Principal
- **Catálogo de Vinhos**: Exibição em cards com foto, tipo, uva, safra e preço
- **Filtros por Tipo**: Todos, Tintos, Brancos, Rosés e Espumantes
- **Modal de Detalhes**: Informações completas ao clicar em um vinho
- **Seção de Contato**: Telefone, e-mail, endereço e links para redes sociais
- **Design Responsivo**: Adaptável a diferentes tamanhos de tela

### Painel Administrativo
- **Cadastro de Vinhos**: Formulário completo para adicionar novos vinhos
- **Edição**: Modificar informações de vinhos existentes
- **Exclusão**: Remover vinhos com confirmação
- **Campos do Vinho**:
  - Nome
  - Tipo (Tinto, Branco, Rosé, Espumante)
  - Tipo de Uva
  - Ano de Safra
  - Tempo de Guarda
  - Harmonização
  - Descrição
  - Preço
  - URL da Imagem

## 🎨 Características do Design

- **Cores**: Paleta inspirada em vinhos com tons de borgonha, dourado e marrom
- **Tipografia**: Moderna e legível
- **Animações**: Transições suaves e efeitos hover
- **Layout**: Grid responsivo para os cards de vinhos

## 🚀 Como Instalar e Executar

### Pré-requisitos
- **Node.js** (versão 20 ou superior)
- **PostgreSQL** (ou um projeto Neon)
- **npm** (gerenciador de pacotes do Node.js)

### Passo 1: Clonar o Repositório
```bash
git clone https://github.com/SEU_USUARIO/CatalogoInterativoDaviniVinhosFinos.git
cd CatalogoInterativoDaviniVinhosFinos
```

### Passo 2: Instalar Dependências
```bash
npm install
```

### Passo 3: Configurar Banco de Dados
1. Crie um banco PostgreSQL no Neon.
2. Execute `database/schema.postgresql.sql` no SQL Editor do Neon.
3. Copie a connection string pooled do Neon para `DATABASE_URL`.

Para executar localmente, use `.env` com:
```bash
DATABASE_URL=postgresql://usuario:senha@host-neon/nome_do_banco?sslmode=require
```

### Passo 4: Configurar Variáveis de Ambiente
1. Copie o arquivo `.env.example` para `.env`:
```bash
cp .env.example .env
```

2. Edite o arquivo `.env` com suas configurações:
```env
DATABASE_URL=postgresql://usuario:senha@host-neon/nome_do_banco?sslmode=require
JWT_SECRET=gere-uma-chave-aleatoria-forte
PORT=3000
```

### Passo 5: Iniciar o Servidor
```bash
npm start
```

Ou para desenvolvimento com auto-reload:
```bash
npm run dev
```

### Passo 6: Acessar o Sistema
- **Site Principal**: http://localhost:3000
- **Painel Admin**: http://localhost:3000/admin.html
- **API Status**: http://localhost:3000/api/status

### Testes de pedidos

Execute `npm test` para verificar a criação de pedidos, autenticação, descontos VIP,
validação de produtos, rollback e os valores enviados ao WhatsApp. Os testes usam
um banco simulado, sem acessar o Neon ou enviar mensagens.

Na criação do pedido, o navegador envia os IDs dos produtos e suas quantidades.
A API consulta preços, nomes, disponibilidade e benefícios VIP no PostgreSQL e
calcula os valores em centavos. Campos financeiros enviados por versões anteriores
do carrinho são ignorados. A resposta mantém `pedidoId` e inclui `total` e `itens`
confirmados, usados na mensagem do WhatsApp. A regra VIP atual de preços terminados
em `,90` foi preservada. Não é necessária migração de banco para essa mudança.

## 📖 Como Usar

### Visualizar o Catálogo
1. Acesse http://localhost:3000
2. Navegue pelos vinhos usando os filtros por tipo
3. Clique em um vinho para ver detalhes completos

### Gerenciar Vinhos (Painel Admin)
1. Acesse http://localhost:3000/admin.html
2. **Configurar Site**: Edite informações de contato e redes sociais
3. **Cadastrar Vinho**: Preencha o formulário com:
   - Nome, tipo, uva, safra, preço
   - Upload de imagem do computador OU URL externa
   - Informações adicionais (guarda, harmonização, descrição)
4. **Editar/Excluir**: Use os botões na lista de vinhos

## 📁 Estrutura de Arquivos

Para migrar os dados da instância MySQL antiga para o Neon e publicar na Vercel, siga [DEPLOY-VERCEL-NEON.md](./DEPLOY-VERCEL-NEON.md).

```
CatalogoInterativo/
├── api/index.js                    # Entrada da função Vercel
├── config/                         # PostgreSQL, logs e serviços
├── database/schema.postgresql.sql  # Schema do Neon
├── middleware/                     # Autenticação, erros e validação
├── routes/                         # Endpoints Express
├── scripts/                        # Migração MySQL → Neon e testes de e-mail
├── services/                       # Cache e serviços compartilhados
├── css/                            # Estilos do catálogo e do painel
├── images/                         # Ícones e imagens estáticas
├── js/                             # Código do frontend
├── server.js                       # Aplicação Express
└── vercel.json                     # Rotas da implantação Vercel
```

## 💾 Banco de Dados

### Estrutura
O sistema utiliza **PostgreSQL no Neon**. O schema completo das tabelas de catálogo, usuários, pedidos, configurações, benefícios VIP e recuperação de senha está em `database/schema.postgresql.sql`.

### API Endpoints

**Vinhos:**
- `GET /api/vinhos` - Listar todos os vinhos
- `GET /api/vinhos/:id` - Buscar vinho específico
- `POST /api/vinhos` - Criar novo vinho (com upload)
- `PUT /api/vinhos/:id` - Atualizar vinho
- `DELETE /api/vinhos/:id` - Excluir vinho
- `GET /api/vinhos/tipo/:tipo` - Filtrar por tipo

**Configurações:**
- `GET /api/configuracoes` - Buscar todas configurações
- `POST /api/configuracoes` - Atualizar configurações
- `GET /api/configuracoes/:chave` - Buscar configuração específica
- `PUT /api/configuracoes/:chave` - Atualizar configuração específica

## 🔧 Tecnologias Utilizadas

### Frontend
- **HTML5**: Estrutura das páginas
- **CSS3**: Estilização e design responsivo
- **JavaScript**: Funcionalidades e interatividade
- **Font Awesome**: Ícones

### Backend
- **Node.js**: Servidor backend
- **Express**: Framework web
- **PostgreSQL (Neon)**: Banco de dados relacional
- **Vercel**: Hospedagem do site e das rotas Express
- **Multer**: Upload de arquivos
- **CORS**: Comunicação entre frontend e backend

## 📱 Redes Sociais

O site inclui links para:
- Instagram
- Facebook
- WhatsApp

(Os links devem ser atualizados no arquivo `index.html` com os perfis reais da vinícola)

## 📤 Upload de Imagens

Na Vercel, configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e
`CLOUDINARY_API_SECRET` para o ambiente **Production**, com os dados da conta
Cloudinary. Depois gere um novo deployment pelo fluxo GitHub já configurado;
variáveis adicionadas não atualizam um deployment existente. Não coloque os
valores no código ou em arquivos versionados.

Sem essas variáveis, o upload responde HTTP 503 com `UPLOAD_NOT_CONFIGURED` e
não grava o produto. Cadastro sem foto e imagem por URL continuam disponíveis.
O formulário preserva os dados em caso de falha e impede envios simultâneos.

O sistema suporta duas formas de adicionar imagens:

1. **Upload via Cloudinary**: Configure as variáveis Cloudinary no ambiente para armazenar as imagens de forma persistente. O disco local de funções Vercel não deve ser usado como armazenamento permanente.

2. **URL Externa**: Cole uma URL de imagem hospedada externamente

## 🔒 Segurança

### Status dos pedidos

API, administração e perfil usam as definições de `js/pedido-status.js`:
Pendente, Aguardando Pagamento, Confirmado, Em Preparação, Em Rota de Entrega,
Finalizado e Cancelado. A seleção do administrador só confirma a mudança após
resposta da API; falhas restauram o status anterior. Apenas administradores
podem atualizar status, e pedidos inexistentes retornam HTTP 404.

Os registros antigos são preservados. Na leitura, `processando` é exibido como
`em_preparacao`, `enviado` como `em_rota_entrega` e `entregue` como `finalizado`.
A API também aceita esses nomes antigos ao atualizar e grava o valor padronizado.

Antes do push desta atualização, execute no Neon
`database/migrations/20261110_status_pedidos.sql`. A migração atualiza somente
a restrição de status, mantendo os nomes antigos aceitos no banco e sem regravar
pedidos. Para bancos novos, use o schema completo atualizado.

### Autenticação e sessões

Contas com senhas antigas devem usar **Esqueci minha senha**. O login encaminha
essas contas para a recuperação por e-mail; a nova senha só é gravada após a
confirmação de um token válido. A rota antiga `POST /api/auth/atualizar-senha`
responde com HTTP 410 e não consulta nem altera usuários. O login com bcrypt e
os links de recuperação existentes continuam funcionando.

As sessões são registradas no PostgreSQL e verificadas em cada chamada autenticada.
O logout encerra a sessão atual e limpa as credenciais das abas do navegador,
preservando o carrinho. Trocas de senha ou de permissão administrativa revogam
todas as sessões da conta por um trigger no banco; alterações comuns de perfil
ou de benefício VIP não encerram as sessões.

**Antes de publicar esta versão em um banco já existente**, execute no SQL Editor
do Neon o arquivo `database/migrations/20261110_sessoes_usuario.sql`. O arquivo é
aditivo e pode ser aplicado com a versão anterior ainda em uso. Após o deploy,
usuários com tokens anteriores precisarão entrar novamente uma vez. Para bancos
novos, o schema completo já contém a tabela e o trigger. Veja também
[DEPLOY-VERCEL-NEON.md](./DEPLOY-VERCEL-NEON.md).

Execute `npm test` para rodar os testes de pedidos e autenticação. Os testes usam
banco e envio de e-mail simulados, sem acessar o Neon ou enviar mensagens reais.

**Importante**:
- Defina um `JWT_SECRET` forte e exclusivo na Vercel.
- Armazene URLs e credenciais somente em variáveis de ambiente; não as versione.
- Faça backups protegidos e teste a restauração.
- Depois de remover segredos do diretório de trabalho, avalie também a limpeza coordenada do histórico Git.

## 🎯 Melhorias Futuras

- ✅ Sistema completo de backend com Node.js
- ✅ Banco de dados PostgreSQL (Neon)
- ✅ Upload de imagens
- ✅ API RESTful
- 🔲 Autenticação de administrador
- 🔲 Sistema de busca por nome
- 🔲 Exportação de catálogo em PDF
- 🔲 Relatórios e estatísticas
- 🔲 Sistema de categorias personalizadas
- 🔲 Integração com WhatsApp Business API

## 📝 Licença

© 2025 Davini Vinhos Finos. Todos os direitos reservados.

---

Desenvolvido para a Vinícola Jolimont
