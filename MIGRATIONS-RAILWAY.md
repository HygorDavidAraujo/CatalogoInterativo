# MIGRAÇÕES PENDENTES NO RAILWAY - GUIA COMPLETO

## 🎯 O QUE PRECISA SER FEITO

Aplicar 2 migrações no banco MySQL do Railway:
1. **Adicionar tipos de Suco Integral** ao ENUM da coluna `tipo`
2. **Criar tabela `pedidos_itens`** para normalizar pedidos

---

## ⚠️ IMPORTANTE: ANTES DE COMEÇAR

1. **Faça BACKUP dos dados** (Railway → MySQL → Deploy → "Download Backup" ou export via DBeaver)
2. **Confirme que o serviço MySQL está rodando** (não o app Node.js)
3. **Use um dos métodos abaixo** (DBeaver é o mais simples)

---

## 📋 MÉTODO 1: Via DBeaver (RECOMENDADO)

### Passo 1: Conectar ao Railway

1. No Railway Dashboard → MySQL → Variables/Connect
2. Copie as credenciais:
   - Host: `<valor de MYSQLHOST>`
   - Port: `<valor de MYSQLPORT>` (geralmente 3306)
   - Database: `railway` ou `catalogo_vinhos`
   - User: `root`
   - Password: `<valor de MYSQLPASSWORD>`

3. No DBeaver:
   - Novo → MySQL
   - Cole as credenciais
   - **Aba SSL**: marque "Exigir SSL", desmarque "Verificar certificado"
   - Teste conexão → OK → Concluir

### Passo 2: Executar as Migrações

1. Abra nova SQL Console (F3 ou botão SQL)
2. Cole e execute **BLOCO 1** (Suco Integral):

```sql
USE catalogo_vinhos;

-- Verificar ENUM atual
SELECT COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME='vinhos' AND COLUMN_NAME='tipo';

-- Atualizar ENUM
ALTER TABLE vinhos 
MODIFY COLUMN tipo ENUM(
    'tinto',
    'branco',
    'rose',
    'espumante',
    'suco_integral_tinto',
    'suco_integral_branco'
) NOT NULL;

-- Validar mudança
SELECT COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME='vinhos' AND COLUMN_NAME='tipo';
```

3. Cole e execute **BLOCO 2** (Tabela pedidos_itens):

```sql
-- Criar tabela pedidos_itens
CREATE TABLE IF NOT EXISTS pedidos_itens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    vinho_id INT NOT NULL,
    vinho_nome VARCHAR(255) NOT NULL,
    quantidade INT NOT NULL,
    preco_unitario DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
    INDEX idx_pedido_id (pedido_id),
    INDEX idx_vinho_id (vinho_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verificar estrutura
SHOW CREATE TABLE pedidos_itens;

-- Confirmar que está vazia
SELECT COUNT(*) as total_itens FROM pedidos_itens;
```

### Passo 3: Validar

```sql
-- 1. Confirmar ENUM tem os 6 tipos
SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME='vinhos' AND COLUMN_NAME='tipo';

-- Resultado esperado:
-- enum('tinto','branco','rose','espumante','suco_integral_tinto','suco_integral_branco')

-- 2. Confirmar tabela pedidos_itens existe
SHOW TABLES LIKE 'pedidos_itens';

-- 3. Confirmar foreign keys
SELECT 
    CONSTRAINT_NAME, 
    TABLE_NAME, 
    REFERENCED_TABLE_NAME 
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE TABLE_NAME = 'pedidos_itens';
```

---

## 📋 MÉTODO 2: Via Railway CLI + Docker

Se não tiver DBeaver e tiver Docker:

### Passo 1: Iniciar TCP Proxy

```powershell
railway link
railway connect -p 3307
```

Deixe esta janela aberta.

### Passo 2: Executar Migrações via Docker

Em outra janela:

```powershell
# Migração 1: Suco Integral
docker run --rm -v "%CD%\database:/work" mysql:8 bash -lc "mysql -h 127.0.0.1 -P 3307 -u root -p<MYSQLPASSWORD> -D catalogo_vinhos < /work/migration-suco-integral.sql"

# Migração 2: Tabela pedidos_itens
docker run --rm -v "%CD%\database:/work" mysql:8 bash -lc "mysql -h 127.0.0.1 -P 3307 -u root -p<MYSQLPASSWORD> -D catalogo_vinhos < /work/migration-pedidos-itens.sql"
```

Substitua `<MYSQLPASSWORD>` pelo valor correto.

### Validar:

```powershell
docker run --rm mysql:8 bash -lc "mysql -h 127.0.0.1 -P 3307 -u root -p<MYSQLPASSWORD> -D catalogo_vinhos -e 'SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME=\"vinhos\" AND COLUMN_NAME=\"tipo\";'"

docker run --rm mysql:8 bash -lc "mysql -h 127.0.0.1 -P 3307 -u root -p<MYSQLPASSWORD> -D catalogo_vinhos -e 'SHOW TABLES LIKE \"pedidos_itens\";'"
```

---

## 📋 MÉTODO 3: Via MySQL Workbench

1. Download: https://dev.mysql.com/downloads/workbench/
2. Nova Conexão:
   - Hostname: `<MYSQLHOST do Railway>`
   - Port: `<MYSQLPORT>`
   - Username: `root`
   - Password: `<MYSQLPASSWORD>`
   - **SSL**: Use SSL if available → **Require**
3. Teste conexão → OK
4. Query Editor → Cole e execute os SQL dos BLOCOS 1 e 2 acima
5. Valide com as queries de validação

---

## ✅ CHECKLIST PÓS-MIGRAÇÃO

- [ ] ENUM `vinhos.tipo` tem 6 valores (incluindo suco_integral_*)
- [ ] Tabela `pedidos_itens` existe e está vazia
- [ ] Foreign keys `pedidos_itens.pedido_id` → `pedidos.id` criada
- [ ] App funciona (teste criar vinho tipo suco_integral no admin)
- [ ] Checkout do carrinho cria pedido e itens corretamente

---

## 🚨 SOLUÇÃO DE PROBLEMAS

### Erro: "Communications link failure"
- Verifique firewall/VPN não bloqueiam porta 3306
- Use TCP Proxy local (railway connect) se host público não responder

### Erro: "Can't connect to MySQL server"
- Confirme que copiou host/port/password corretamente
- Verifique se o serviço MySQL está UP no Railway (não em crash loop)

### Erro: "Unknown database 'catalogo_vinhos'"
- O nome do banco pode ser `railway` em vez de `catalogo_vinhos`
- Rode `SHOW DATABASES;` e ajuste o `USE <nome_correto>;`

### Erro: "Duplicate column name" ou "Table already exists"
- Migração já foi aplicada; valide com queries de verificação
- Se precisar recriar, DROP TABLE pedidos_itens; e reexecute

---

## 📝 NOTAS

- Migrações são **idempotentes** (podem rodar múltiplas vezes com `IF NOT EXISTS`)
- O ALTER ENUM é **atômico** e não afeta linhas existentes
- A tabela `pedidos_itens` é criada vazia; pedidos futuros populam ela automaticamente
