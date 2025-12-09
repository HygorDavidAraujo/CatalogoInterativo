# Catálogo Interativo - Davini Vinhos Finos

Sistema web completo de catálogo interativo para exibição de vinhos da vinícola com backend Node.js, banco de dados MySQL e upload de imagens.

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
- **Node.js** (versão 14 ou superior)
- **MySQL** (versão 5.7 ou superior)
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
1. Certifique-se de que o MySQL está rodando
2. Crie o banco de dados executando o script:
```bash
mysql -u root -p < database/schema.sql
```

Ou execute manualmente no MySQL:
```sql
source database/schema.sql
```

### Passo 4: Configurar Variáveis de Ambiente
1. Copie o arquivo `.env.example` para `.env`:
```bash
cp .env.example .env
```

2. Edite o arquivo `.env` com suas configurações:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=catalogo_vinhos
DB_PORT=3306
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

```
CatalogoInterativo/
├── index.html          # Página principal do catálogo
├── admin.html          # Painel administrativo
├── css/
│   ├── styles.css      # Estilos da página principal
│   └── admin.css       # Estilos do painel admin
├── js/
│   ├── app.js          # JavaScript da página principal
│   └── admin.js        # JavaScript do painel admin
└── images/             # Pasta para imagens locais
```

## 💾 Banco de Dados

### Estrutura
O sistema utiliza **MySQL** com duas tabelas principais:

#### Tabela `vinhos`
- id, nome, tipo, uva, ano
- guarda, harmonizacao, descricao
- preco, imagem
- timestamps (created_at, updated_at)

#### Tabela `configuracoes`
- id, chave, valor
- timestamps (created_at, updated_at)

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
- **MySQL**: Banco de dados relacional
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

1. **Upload Local**: Faça upload de imagens do seu computador (JPG, PNG, GIF - máx 5MB)
   - As imagens são salvas em `/uploads/vinhos/`
   - Nomenclatura automática: `vinho-timestamp-random.ext`

2. **URL Externa**: Cole uma URL de imagem hospedada externamente

## 🔒 Segurança

**Importante**: Este projeto é uma versão básica. Para produção, recomenda-se:
- Adicionar autenticação JWT no painel admin
- Implementar validação e sanitização de dados
- Configurar HTTPS
- Usar variáveis de ambiente seguras
- Implementar rate limiting
- Adicionar backup automático do banco

## 🎯 Melhorias Futuras

- ✅ Sistema completo de backend com Node.js
- ✅ Banco de dados MySQL
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
