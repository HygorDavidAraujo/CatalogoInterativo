# 🚀 GUIA: ATUALIZAR BANCO DE DADOS NO RAILWAY

## 📋 O QUE PRECISA SER FEITO

Adicionar os novos tipos de produto "Suco Integral" ao ENUM da coluna `tipo` na tabela `vinhos`.

---

## 🔧 MÉTODO 1: VIA RAILWAY WEB (RECOMENDADO)

### Passo 1: Acessar Railway
1. Ir para https://railway.app
2. Fazer login
3. Selecionar projeto "CatalogoInterativo" (ou nome do seu projeto)
4. Clicar no serviço do MySQL/PostgreSQL

### Passo 2: Abrir Console SQL
1. Na página do banco de dados, procurar aba "**Query**" ou "**Data**"
2. Ou clicar em "**Connect**" e escolher "**Query**"
3. Vai abrir um editor SQL

### Passo 3: Executar Migração
Copie e cole este SQL no editor:

```sql
-- Atualizar ENUM da tabela vinhos
ALTER TABLE vinhos 
MODIFY COLUMN tipo ENUM(
    'tinto',
    'branco', 
    'rose',
    'espumante',
    'suco_integral_tinto',
    'suco_integral_branco'
) NOT NULL;

-- Verificar se funcionou
SELECT COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME='vinhos' AND COLUMN_NAME='tipo';

-- Verificar produtos existentes
SELECT tipo, COUNT(*) as total FROM vinhos GROUP BY tipo;
```

### Passo 4: Executar
- Clicar em "**Run**" ou "**Execute**"
- Aguardar confirmação de sucesso ✅

### Passo 5: Validar
Verificar se a resposta mostra:
```
enum('tinto','branco','rose','espumante','suco_integral_tinto','suco_integral_branco')
```

---

## 🔧 MÉTODO 2: VIA RAILWAY CLI

### Passo 1: Instalar Railway CLI (se não tiver)
```bash
npm i -g @railway/cli
# ou
brew install railway
```

### Passo 2: Fazer Login
```bash
railway login
```

### Passo 3: Conectar ao Projeto
```bash
cd "C:\Users\hygor\Documentos\Vinicola Jolimont\CatalogoInterativo"
railway link
# Escolher o projeto correto
```

### Passo 4: Conectar ao Banco
```bash
railway connect
# Escolher o serviço de banco de dados (MySQL/PostgreSQL)
```

### Passo 5: Executar Script
```bash
# Se tiver mysql client instalado:
railway run mysql -u root -p < database/migration-suco-integral.sql

# Ou conectar manualmente:
railway run mysql -u root -p
# Depois colar o SQL manualmente
```

---

## 🔧 MÉTODO 3: VIA MYSQL WORKBENCH/DBeaver (EXTERNO)

### Passo 1: Obter Credenciais do Railway
1. Railway Dashboard → Seu Projeto
2. Clicar no serviço MySQL
3. Aba "**Variables**" ou "**Connect**"
4. Copiar:
   - `MYSQL_HOST` (ex: containers-us-west-123.railway.app)
   - `MYSQL_PORT` (ex: 6543)
   - `MYSQL_USER` (ex: root)
   - `MYSQLPASSWORD` (ex: senha-gerada)
   - `MYSQL_DATABASE` (ex: railway ou catalogo_vinhos)

### Passo 2: Conectar com MySQL Workbench
1. Abrir MySQL Workbench
2. Criar nova conexão:
   - Hostname: `[MYSQL_HOST do Railway]`
   - Port: `[MYSQL_PORT]`
   - Username: `[MYSQL_USER]`
   - Password: `[MYSQLPASSWORD]`
3. Clicar "Test Connection"
4. Se funcionar, clicar "OK"

### Passo 3: Executar Script
1. Abrir arquivo `database/migration-suco-integral.sql`
2. Selecionar todo conteúdo
3. Clicar em "Execute" (⚡ ícone de raio)
4. Verificar resultado

---

## 🔧 MÉTODO 4: VIA TERMINAL LOCAL (MYSQL CLIENT)

### Se tiver mysql instalado localmente:

```bash
# Obter variáveis do Railway
railway variables

# Conectar diretamente
mysql -h [MYSQL_HOST] -P [MYSQL_PORT] -u [MYSQL_USER] -p[MYSQLPASSWORD] [MYSQL_DATABASE]

# Executar comandos
USE catalogo_vinhos;

ALTER TABLE vinhos 
MODIFY COLUMN tipo ENUM(
    'tinto', 'branco', 'rose', 'espumante',
    'suco_integral_tinto', 'suco_integral_branco'
) NOT NULL;

-- Validar
SHOW CREATE TABLE vinhos\G

-- Sair
EXIT;
```

---

## ✅ VALIDAÇÃO PÓS-MIGRAÇÃO

### Após executar, validar que funcionou:

**1. Verificar ENUM:**
```sql
SELECT COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME='vinhos' AND COLUMN_NAME='tipo';
```

**Resultado esperado:**
```
enum('tinto','branco','rose','espumante','suco_integral_tinto','suco_integral_branco')
```

**2. Verificar produtos:**
```sql
SELECT tipo, COUNT(*) FROM vinhos GROUP BY tipo;
```

**Resultado esperado:**
```
+-------------+----------+
| tipo        | COUNT(*) |
+-------------+----------+
| tinto       | 5        |
| branco      | 3        |
| rose        | 2        |
| espumante   | 1        |
+-------------+----------+
```

**3. Testar inserção:**
```sql
INSERT INTO vinhos (nome, tipo, uva, ano, preco, ativo) 
VALUES ('Teste Suco', 'suco_integral_tinto', 'Teste', 2024, 25.90, TRUE);

SELECT * FROM vinhos WHERE tipo LIKE 'suco%';

-- Remover teste se não quiser manter:
DELETE FROM vinhos WHERE nome = 'Teste Suco';
```

---

## 🎯 OPÇÃO RÁPIDA (COPY/PASTE)

Se quiser apenas copiar e colar no Railway Query Editor:

```sql
ALTER TABLE vinhos MODIFY COLUMN tipo ENUM('tinto','branco','rose','espumante','suco_integral_tinto','suco_integral_branco') NOT NULL;
```

---

## 🚨 TROUBLESHOOTING

### Erro: "Access denied"
- Verificar credenciais do Railway
- Verificar se serviço MySQL está rodando no Railway

### Erro: "Unknown database"
- Executar `USE catalogo_vinhos;` antes do ALTER TABLE
- Ou usar nome correto do banco (verificar no Railway)

### Erro: "Table doesn't exist"
- Verificar se tabela `vinhos` existe: `SHOW TABLES;`
- Se não existir, executar `database/schema-updated.sql` completo

### Erro: "Cannot change column type"
- Pode ter produtos com valores inválidos
- Verificar: `SELECT DISTINCT tipo FROM vinhos;`
- Limpar dados problemáticos antes de alterar

---

## 📊 BACKUP (OPCIONAL MAS RECOMENDADO)

### Antes de fazer qualquer alteração:

```bash
# Via Railway CLI
railway run mysqldump --databases catalogo_vinhos > backup-$(date +%Y%m%d).sql

# Ou via MySQL client
mysqldump -h [HOST] -P [PORT] -u [USER] -p[PASS] catalogo_vinhos > backup.sql
```

---

## ✅ CHECKLIST

- [ ] Backup do banco (opcional mas recomendado)
- [ ] Conectar ao Railway
- [ ] Executar ALTER TABLE
- [ ] Validar ENUM atualizado
- [ ] Testar inserção de novo tipo
- [ ] Verificar que produtos existentes não foram afetados
- [ ] Reiniciar aplicação (se necessário)
- [ ] Testar cadastro de "Suco Integral" no admin
- [ ] Verificar filtro "Suco Integral" no site

---

## 🚀 PRÓXIMO PASSO APÓS MIGRAÇÃO

1. **Reiniciar serviço no Railway** (se necessário)
2. **Testar aplicação:**
   - Acessar site em produção
   - Fazer login como admin
   - Tentar criar produto "Suco Integral - Tinto"
   - Verificar filtro "Suco Integral" funcionando

---

## 📞 SUPORTE

Se algo der errado:
1. Verificar logs do Railway: `railway logs`
2. Verificar se banco está online: Railway Dashboard
3. Reverter com: `ALTER TABLE vinhos MODIFY COLUMN tipo ENUM('tinto','branco','rose','espumante') NOT NULL;`

---

**Status:** Pronto para executar
**Tempo estimado:** 2-5 minutos
**Risco:** Baixo (apenas adiciona novos valores ao ENUM)
