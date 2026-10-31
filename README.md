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

O sistema suporta duas formas de adicionar imagens:

1. **Upload via Cloudinary**: Configure as variáveis Cloudinary no ambiente para armazenar as imagens de forma persistente. O disco local de funções Vercel não deve ser usado como armazenamento permanente.

2. **URL Externa**: Cole uma URL de imagem hospedada externamente

## 🔒 Segurança

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
