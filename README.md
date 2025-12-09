# Catálogo Interativo - Davini Vinhos Finos

Sistema web de catálogo interativo para exibição de vinhos da vinícola.

## 📋 Sobre o Projeto

Este é um catálogo interativo moderno desenvolvido para a Davini Vinhos Finos, permitindo a exibição organizada dos vinhos disponíveis com informações detalhadas e um sistema de administração para gerenciamento dos produtos.

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

## 🚀 Como Usar

### Visualizar o Catálogo
1. Abra o arquivo `index.html` em um navegador
2. Navegue pelos vinhos usando os filtros
3. Clique em um vinho para ver detalhes completos

### Acessar o Painel Administrativo
1. Abra o arquivo `admin.html` em um navegador
2. Cadastre novos vinhos usando o formulário
3. Gerencie os vinhos existentes (editar/excluir)

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

## 💾 Armazenamento de Dados

Os dados dos vinhos são armazenados no **localStorage** do navegador, permitindo que as informações persistam entre sessões sem necessidade de banco de dados ou servidor.

## 🔧 Tecnologias Utilizadas

- **HTML5**: Estrutura das páginas
- **CSS3**: Estilização e design responsivo
- **JavaScript**: Funcionalidades e interatividade
- **Font Awesome**: Ícones
- **LocalStorage**: Persistência de dados

## 📱 Redes Sociais

O site inclui links para:
- Instagram
- Facebook
- WhatsApp

(Os links devem ser atualizados no arquivo `index.html` com os perfis reais da vinícola)

## 🎯 Próximos Passos

- Adicionar autenticação para o painel administrativo
- Implementar upload de imagens
- Adicionar sistema de busca por nome
- Criar exportação de catálogo em PDF
- Integrar com backend e banco de dados

## 📝 Licença

© 2025 Davini Vinhos Finos. Todos os direitos reservados.

---

Desenvolvido para a Vinícola Jolimont
