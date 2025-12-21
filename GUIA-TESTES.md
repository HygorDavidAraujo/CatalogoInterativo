# GUIA DE TESTES - VALIDAR IMPLEMENTAÇÃO

## 🧪 Teste 1: Verificar Que Credenciais Foram Removidas

### ✅ Verificar config/cloudinary.js
```bash
grep -n "cloud_name.*=" config/cloudinary.js | grep -v process.env
# Resultado esperado: NENHUMA linha com valor hardcoded
```

### ✅ Verificar config/database.js
```bash
grep -n "79461382" config/database.js
# Resultado esperado: NENHUMA correspondência
```

### ✅ Verificar server.js
```bash
grep -n "79461382" server.js
# Resultado esperado: NENHUMA correspondência
```

---

## 🔐 Teste 2: Validar JWT Authentication

### ✅ 2.1 - Teste de Login (Sem Token)
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hygordavidaraujo@gmail.com","senha":"sua-senha"}'

# Resposta esperada:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id": 1,
    "nome": "Hygor David Araujo",
    "email": "hygordavidaraujo@gmail.com",
    "isAdmin": true
  }
}
```

### ✅ 2.2 - Teste de GET Sem Token (Deve Falhar)
```bash
curl -X GET http://localhost:3000/api/auth/usuarios

# Resposta esperada: 401 Unauthorized
{
  "error": "Token não fornecido"
}
```

### ✅ 2.3 - Teste de GET Com Token (Deve Funcionar)
```bash
# Primeiro pega o token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hygordavidaraujo@gmail.com","senha":"sua-senha"}' | \
  jq -r '.token')

# Depois usa o token
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Resposta esperada: 200 OK
{
  "id": 1,
  "nome": "Hygor David Araujo",
  "email": "hygordavidaraujo@gmail.com",
  "isAdmin": true
}
```

### ✅ 2.4 - Teste de POST Vinhos Sem Ser Admin (Deve Falhar)
```bash
# Criar usuário não-admin para teste (se não tiver)
# Depois faz login com ele

TOKEN_USER=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@teste.com","senha":"senha123"}' | \
  jq -r '.token')

# Tentar criar vinho (sem ser admin)
curl -X POST http://localhost:3000/api/vinhos \
  -H "Authorization: Bearer $TOKEN_USER" \
  -H "Content-Type: application/json" \
  -d '{"nome":"Vinho Teste","tipo":"tinto","uva":"Merlot","ano":2020,"preco":50}'

# Resposta esperada: 403 Forbidden
{
  "error": "Acesso negado: apenas administradores podem criar vinhos"
}
```

### ✅ 2.5 - Teste de POST Vinhos Como Admin (Deve Funcionar)
```bash
TOKEN_ADMIN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hygordavidaraujo@gmail.com","senha":"sua-senha"}' | \
  jq -r '.token')

curl -X POST http://localhost:3000/api/vinhos \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"nome":"Vinho Teste","tipo":"tinto","uva":"Merlot","ano":2020,"preco":50}'

# Resposta esperada: 201 Created
{
  "id": 123,
  "nome": "Vinho Teste",
  "tipo": "tinto",
  ...
}
```

---

## 📊 Teste 3: Validar Schema do Banco

### ✅ 3.1 - Verificar Coluna `ativo` em `vinhos`
```sql
DESCRIBE catalogo_vinhos.vinhos;

# Procurar por linha com 'ativo'
# Esperado:
# | ativo | tinyint(1) | YES | | 1 | |
```

### ✅ 3.2 - Verificar Colunas em `configuracoes`
```sql
DESCRIBE catalogo_vinhos.configuracoes;

# Esperado (colunas específicas, não genéricas):
# | nome_site    | varchar(255) |
# | titulo       | varchar(255) |
# | descricao    | text         |
# | telefone     | varchar(20)  |
# | email        | varchar(255) |
# | endereco     | text         |
# | whatsapp     | varchar(20)  |
# | instagram    | varchar(500) |
# | facebook     | varchar(500) |
```

### ✅ 3.3 - Verificar Campos em `usuarios`
```sql
DESCRIBE catalogo_vinhos.usuarios;

# Esperado:
# | cpf           | varchar(14)  |
# | logradouro    | varchar(255) |
# | numero        | varchar(10)  |
# | complemento   | varchar(255) |
# | bairro        | varchar(100) |
# | cep           | varchar(10)  |
# | cidade        | varchar(100) |
# | estado        | varchar(2)   |
```

### ✅ 3.4 - Verificar Tabela `pedidos` Existe
```sql
DESCRIBE catalogo_vinhos.pedidos;

# Esperado:
# | id         | int(11)              | NO  | PRI |
# | usuario_id | int(11)              | NO  | MUL |
# | total      | decimal(10,2)        | NO  |     |
# | status     | enum(...)            | YES |     |
# | itens      | json                 | YES |     |
```

---

## 🌐 Teste 4: Interface Frontend

### ✅ 4.1 - Teste de Login via HTML
1. Abrir http://localhost:3000
2. Clicar em "Login"
3. Entrar com: hygordavidaraujo@gmail.com / sua-senha
4. Verificar que aparece nome do usuário no header
5. Abrir DevTools → Application → Storage → sessionStorage
6. Procurar por `jwt_token` - DEVE ESTAR PRESENTE!

### ✅ 4.2 - Teste de Admin Panel
1. Fazer login como admin
2. Clicar em "Admin" no menu
3. Tentar criar um vinho
4. Verificar no DevTools > Network que request tem:
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
   ```
5. Deve receber 201 Created

### ✅ 4.3 - Teste Sem Token (Logout)
1. Abrir DevTools → Application → Storage
2. Deletar `jwt_token` do sessionStorage e localStorage
3. Tentar acessar admin panel
4. Deve ser redirecionado para login

---

## 🔧 Teste 5: Verificação de Rotas Protegidas

### Script de Teste Automatizado
```bash
#!/bin/bash

echo "=== TESTE DE AUTENTICAÇÃO JWT ==="

# 1. Obter token
echo "1️⃣ Fazendo login..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hygordavidaraujo@gmail.com","senha":"sua-senha"}')

TOKEN=$(echo $RESPONSE | jq -r '.token')
echo "✅ Token obtido: ${TOKEN:0:20}..."

# 2. Testar rota protegida SEM token
echo ""
echo "2️⃣ Testando GET /auth/usuarios SEM token..."
curl -X GET http://localhost:3000/api/auth/usuarios | jq '.'
echo "(Deve retornar 401)"

# 3. Testar rota protegida COM token
echo ""
echo "3️⃣ Testando GET /auth/me COM token..."
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo "(Deve retornar dados do usuário)"

# 4. Testar criação de vinho
echo ""
echo "4️⃣ Testando POST /vinhos COM token (admin)..."
curl -X POST http://localhost:3000/api/vinhos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nome":"Teste JWT",
    "tipo":"tinto",
    "uva":"Merlot",
    "ano":2020,
    "preco":50
  }' | jq '.'
echo "(Deve retornar 201 ou 200)"

echo ""
echo "✅ TESTES CONCLUÍDOS!"
```

---

## 📱 Teste 6: Verificar Headers Corretos

### ✅ Teste com Postman/Insomnia

**Request 1 - Login**
```
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "hygordavidaraujo@gmail.com",
  "senha": "sua-senha"
}

# Response esperada:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {...}
}
```

**Request 2 - Get Me (Com Token)**
```
GET http://localhost:3000/api/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Response esperada: 200 OK
{
  "id": 1,
  "nome": "Hygor David Araujo",
  ...
}
```

**Request 3 - Get Me (Sem Token)**
```
GET http://localhost:3000/api/auth/me
# (SEM Authorization header)

# Response esperada: 401 Unauthorized
{
  "error": "Token não fornecido"
}
```

---

## ✅ Checklist de Testes

- [ ] Credenciais removidas (grep não encontra valores hardcoded)
- [ ] Login retorna JWT token
- [ ] Rotas sem token retornam 401
- [ ] Rotas com token válido funcionam
- [ ] Admin pode criar/editar/deletar vinhos
- [ ] Usuário comum NÃO pode criar vinhos (403)
- [ ] Schema tem coluna `ativo` em vinhos
- [ ] Schema tem colunas específicas em configuracoes
- [ ] Tabela pedidos foi criada com FK
- [ ] Frontend salva token em sessionStorage
- [ ] Frontend envia Authorization header
- [ ] Logout deleta token e redireciona para login

---

## 🚨 Testes de Erro (Validar Segurança)

### ✅ Teste: Token Expirado
```bash
# Token válido por 7 dias
# Depois de 7 dias, deve retornar 401

curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer token-expirado"

# Esperado: 401 Token inválido
```

### ✅ Teste: Token Inválido
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer invalid-token-123"

# Esperado: 401 Token inválido
```

### ✅ Teste: Sem Header Authorization
```bash
curl -X GET http://localhost:3000/api/auth/usuarios

# Esperado: 401 Token não fornecido
```

### ✅ Teste: Admin Privileges
```bash
# Usuário não-admin tentando listar usuários
TOKEN_USER=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@teste.com","senha":"senha123"}' | \
  jq -r '.token')

curl -X GET http://localhost:3000/api/auth/usuarios \
  -H "Authorization: Bearer $TOKEN_USER"

# Esperado: 403 Acesso negado (apenas admin)
```

---

## 📊 Resultado Esperado Final

Se todos os testes passarem:
```
✅ Credenciais removidas
✅ JWT funcionando
✅ Rotas protegidas
✅ Schema sincronizado
✅ Frontend envia tokens
✅ Admin tem acesso
✅ Usuário comum bloqueado
✅ SEGURANÇA IMPLEMENTADA COM SUCESSO!
```

---

**Próximo passo:** Migração do banco e deploy em staging
