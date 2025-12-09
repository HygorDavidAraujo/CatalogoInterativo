# 🚀 Guia de Instalação Rápida

## Passo a Passo para Iniciar o Sistema

### 1. Instalar Node.js
Se ainda não tiver, baixe e instale o Node.js:
- https://nodejs.org/ (versão LTS recomendada)

### 2. Instalar MySQL
Se ainda não tiver, baixe e instale o MySQL:
- Windows: https://dev.mysql.com/downloads/installer/
- Durante a instalação, defina uma senha para o usuário `root`

### 3. Abrir Terminal no Diretório do Projeto
```powershell
cd "c:\Users\hygor\Documentos\Vinicola Jolimont\CatalogoInterativo"
```

### 4. Instalar Dependências do Node.js
```powershell
npm install
```

### 5. Configurar o Banco de Dados

#### Opção A: Usando MySQL Workbench ou phpMyAdmin
1. Abra o MySQL Workbench ou phpMyAdmin
2. Execute o conteúdo do arquivo `database/schema.sql`

#### Opção B: Linha de Comando
```powershell
# Se o MySQL está no PATH:
mysql -u root -p < database/schema.sql

# Digite a senha do MySQL quando solicitado
```

#### Opção C: Manualmente
```powershell
# Conectar ao MySQL
mysql -u root -p

# Executar comandos:
source database/schema.sql
# Ou no Windows:
\. database/schema.sql
```

### 6. Configurar Arquivo .env
O arquivo `.env` já existe. Edite-o se necessário:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=SUA_SENHA_MYSQL_AQUI
DB_NAME=catalogo_vinhos
DB_PORT=3306
PORT=3000
```

### 7. Iniciar o Servidor
```powershell
npm start
```

Você verá uma mensagem assim:
```
============================================================
🍷  Servidor do Catálogo de Vinhos iniciado!
============================================================
🌐  URL: http://localhost:3000
📊  Admin: http://localhost:3000/admin.html
🔌  API: http://localhost:3000/api/status
============================================================
```

### 8. Acessar o Sistema
- **Site**: Abra o navegador e vá para http://localhost:3000
- **Admin**: Abra http://localhost:3000/admin.html

## ⚠️ Problemas Comuns

### Erro: "Cannot find module"
```powershell
npm install
```

### Erro: "ECONNREFUSED" ou "Access denied for user"
- Verifique se o MySQL está rodando
- Confirme usuário e senha no arquivo `.env`
- Teste a conexão: `mysql -u root -p`

### Erro: "Port 3000 already in use"
- Altere a porta no arquivo `.env`: `PORT=3001`
- Ou pare o processo usando a porta 3000

### Banco de dados não foi criado
```powershell
# Conectar ao MySQL
mysql -u root -p

# Criar banco manualmente
CREATE DATABASE catalogo_vinhos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE catalogo_vinhos;

# Executar script
source database/schema.sql;
```

## 🔄 Para Desenvolvimento

Use este comando para auto-reload ao editar arquivos:
```powershell
npm run dev
```

## 🛑 Para Parar o Servidor

Pressione `Ctrl + C` no terminal

## 📞 Suporte

Se encontrar problemas, verifique:
1. Node.js instalado: `node --version`
2. MySQL rodando: `mysql -u root -p`
3. Dependências instaladas: `npm install`
4. Arquivo `.env` configurado corretamente
