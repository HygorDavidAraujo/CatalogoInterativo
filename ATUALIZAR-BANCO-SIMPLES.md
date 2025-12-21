# ATUALIZAÇÃO DO BANCO - GUIA SIMPLIFICADO

## 🎯 MÉTODO 1: Via Interface Railway (SEM INSTALAR NADA)

### Passo a Passo:

1. **Acesse Railway:** https://railway.app
2. **Vá em:** Seu Projeto → MySQL → Aba "Variables"
3. **Copie:** As variáveis `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`
4. **Baixe MySQL Workbench:** https://dev.mysql.com/downloads/workbench/
5. **Conecte** com as credenciais copiadas
6. **Execute este SQL:**

```sql
ALTER TABLE vinhos 
MODIFY COLUMN tipo ENUM(
    'tinto',
    'branco',
    'rose',
    'espumante',
    'suco_integral_tinto',
    'suco_integral_branco'
) NOT NULL;
```

---

## 🎯 MÉTODO 2: Via Script PowerShell (SE TIVER MYSQL INSTALADO)

1. **Abra o arquivo:** `update-railway-db.ps1`
2. **Edite as credenciais** (linha 8-12) com os valores do Railway
3. **Execute no PowerShell:**
   ```powershell
   .\update-railway-db.ps1
   ```

---

## 🎯 MÉTODO 3: Via URL Connection String

Railway fornece uma "Connection String" pronta. Veja como usar:

1. **Railway Dashboard → MySQL → Connect → "MySQL Connection URL"**
2. **Copie a URL** (formato: `mysql://user:pass@host:port/database`)
3. **Use em qualquer cliente MySQL** (DBeaver, HeidiSQL, TablePlus, etc.)

---

## ⚠️ SE RAILWAY CLI NÃO FUNCIONAR:

O erro do `railway login` pode ser por:
- Firewall bloqueando
- Railway CLI não instalado: `npm install -g @railway/cli`
- Versão antiga: `npm update -g @railway/cli`

**SOLUÇÃO ALTERNATIVA:** Use o Método 1 (MySQL Workbench) que é 100% visual e funciona sempre!

---

## 📊 SQL COMPLETO PARA COPY/PASTE:

```sql
-- Use o banco correto (pode ser 'railway' ou 'catalogo_vinhos')
USE railway;

-- Verificar nome do banco disponível
SHOW DATABASES;

-- Verificar tabelas
SHOW TABLES;

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

-- Validar
SELECT COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME='vinhos' AND COLUMN_NAME='tipo';
```

---

## ✅ VALIDAR QUE FUNCIONOU:

Depois de executar, rode:
```sql
SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME='vinhos' AND COLUMN_NAME='tipo';
```

Deve retornar:
```
enum('tinto','branco','rose','espumante','suco_integral_tinto','suco_integral_branco')
```

---

## 🚀 RECOMENDAÇÃO:

**Use MySQL Workbench** (Método 1) - É visual, simples e funciona 100%!

Download: https://dev.mysql.com/downloads/workbench/

---

## 🐬 DBeaver: Conexão Railway (SSL/Proxy)

### Quando aparece "Communications link failure / Connect timed out"

- **Verifique Host/Port:** No Railway → serviço MySQL → aba Connect/Variables. Se não houver "Public Host"/"Public Port", seu banco não está exposto publicamente e você deve usar o **TCP Proxy** do Railway CLI.
- **Firewall/VPN:** Certifique-se de que firewall corporativo/VPN não bloqueia a porta 3306 (MySQL).

### Opção A — Host público direto (sem proxy)

1. Em DBeaver, aba "Principal": preencha **Host**, **Port**, **Database**, **User**, **Password** exatamente como nas credenciais do Railway.
2. Aba "SSL":
    - **Exigir SSL:** marcado.
    - **Verificar certificado do servidor:** desmarcado.
    - **Certificados (CA/cliente/chave):** deixe em branco.
3. Clique em "Testar conexão".
4. Se aparecer "Public Key Retrieval is not allowed", marque "Permitir recuperar chave pública" na aba SSL e teste novamente.

### Opção B — Sem host público: usar Railway TCP Proxy

1. Instale/atualize o CLI:
    ```powershell
    npm i -g @railway/cli
    ```
2. Autentique e vincule ao projeto:
    ```powershell
    railway login
    railway link
    ```
3. Liste serviços e anote o nome/ID do MySQL:
    ```powershell
    railway services
    ```
4. Inicie o proxy local (ex.: porta 3307):
    ```powershell
    railway connect --service <nome-ou-id-do-mysql> -p 3307
    ```
    Deixe esta sessão aberta; ela cria um túnel TCP local.
5. Em DBeaver:
    - **Host:** 127.0.0.1
    - **Port:** 3307 (ou a que você escolheu)
    - **Database/User/Password:** os do Railway.
    - **SSL:** pode ficar **desmarcado** quando usando proxy local.
6. Teste a conexão.

### Diagnóstico rápido do "Connect timed out"

- **Testar reachability (sem proxy):**
  ```powershell
  Test-NetConnection -ComputerName <host-publico> -Port <porta>
  ```
  Se falhar, o host/porta não estão acessíveis da sua rede.
- **Aumentar timeout no DBeaver:** na aba "Advanced", defina **connectTimeout** para 15000 ms.
- **Confirmar credenciais:** database costuma ser `railway` (ou o nome exibido), usuário/senha exatamente como nas Variables do serviço MySQL.

### Depois de conectar

Execute:
```sql
ALTER TABLE vinhos 
MODIFY COLUMN tipo ENUM(
     'tinto',
     'branco',
     'rose',
     'espumante',
     'suco_integral_tinto',
     'suco_integral_branco'
) NOT NULL;

SELECT COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME='vinhos' AND COLUMN_NAME='tipo';
```

---

## 🐳 MÉTODO 4: Cliente MySQL via Docker (sem instalar MySQL)

Pré-requisito: **Docker Desktop** instalado e em execução.

### A. Com host público (SSL obrigatório)

1. Pegue no Railway: `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`.
2. Rode o ALTER usando o cliente `mysql` dentro do container:
    ```powershell
    docker run --rm -v "%CD%\database:/work" mysql:8 bash -lc "mysql -h <MYSQLHOST> -P <MYSQLPORT> -u <MYSQLUSER> -p<MYSQLPASSWORD> --ssl-mode=REQUIRED -D <MYSQLDATABASE> < /work/migration-suco-integral.sql"
    ```
3. Valide:
    ```powershell
    docker run --rm mysql:8 bash -lc "mysql -h <MYSQLHOST> -P <MYSQLPORT> -u <MYSQLUSER> -p<MYSQLPASSWORD> --ssl-mode=REQUIRED -D <MYSQLDATABASE> -e \"SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='vinhos' AND COLUMN_NAME='tipo';\""
    ```

### B. Sem host público: usar TCP Proxy do Railway

1. Inicie o proxy local na porta 3307:
    ```powershell
    railway connect --service <nome-ou-id-do-mysql> -p 3307
    ```
    Deixe esta janela aberta.
2. Execute o ALTER via Docker apontando para o proxy:
    ```powershell
    docker run --rm -v "%CD%\database:/work" mysql:8 bash -lc "mysql -h 127.0.0.1 -P 3307 -u <MYSQLUSER> -p<MYSQLPASSWORD> -D <MYSQLDATABASE> < /work/migration-suco-integral.sql"
    ```
3. Valide:
    ```powershell
    docker run --rm mysql:8 bash -lc "mysql -h 127.0.0.1 -P 3307 -u <MYSQLUSER> -p<MYSQLPASSWORD> -D <MYSQLDATABASE> -e \"SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='vinhos' AND COLUMN_NAME='tipo';\""
    ```

Observações importantes:

- No PowerShell, evite o operador `<` fora do container (não é suportado). Por isso o redirecionamento é feito dentro do `bash` do container.
- Substitua `<MYSQLHOST>`, `<MYSQLPORT>`, `<MYSQLUSER>`, `<MYSQLPASSWORD>`, `<MYSQLDATABASE>` pelos valores das credenciais do Railway.
- Se aparecer erro de "Public Key Retrieval is not allowed" ao usar host público, no DBeaver marque a opção de recuperar chave pública; no cliente Docker não é necessário porque usamos `--ssl-mode=REQUIRED`.
