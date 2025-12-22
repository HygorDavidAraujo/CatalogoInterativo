# Melhorias Aplicadas - Sistema Catálogo Interativo

## ✅ ETAPA 4: Validação de Entrada e Rate Limiting (CONCLUÍDA)

### 1. Dependências Instaladas
```bash
npm install express-rate-limit express-validator
```

### 2. Middlewares Criados

#### Rate Limiters (`middleware/rateLimiter.js`)
- **loginLimiter**: 5 tentativas / 15 minutos
- **cadastroLimiter**: 3 tentativas / hora  
- **apiLimiter**: 100 requisições / minuto (global)
- **uploadLimiter**: 20 uploads / 15 minutos

#### Validators (`middleware/validators.js`)
Validações usando express-validator para:
- Login (email e senha obrigatórios)
- Cadastro (nome, email, senha com requisitos de segurança)
- Vinho (nome, tipo ENUM, preço decimal, ano numérico)
- Pedido (usuario_id, total, itens array)
- Status de Pedido (valores permitidos)
- Perfil (campos opcionais com sanitização)
- ID numérico em params

### 3. Rotas Protegidas

#### `routes/auth.js`
✅ POST `/login` → loginLimiter + validateLogin
✅ POST `/cadastro` → cadastroLimiter + validateCadastro
✅ PUT `/perfil` → verificarAutenticacao + validatePerfil

#### `routes/vinhos.js`
✅ POST `/` → verificarAdminAuth + uploadLimiter + validateVinho
✅ PUT `/:id` → verificarAdminAuth + uploadLimiter + validateId + validateVinho
✅ DELETE `/:id` → verificarAdminAuth + validateId

#### `routes/pedidos.js`
✅ GET `/cliente/:clienteId` → verificarAutenticacao + validateId
✅ POST `/` → verificarAutenticacao + validatePedido
✅ PUT `/:id/status` → verificarAdminAuth + validateId + validatePedidoStatus

#### `server.js`
✅ Rate limiter global aplicado a todas as rotas `/api/*`

---

## 📋 PRÓXIMAS ETAPAS

### ETAPA 5: Melhorar Gerenciamento de Token e UX

#### 5.1 Migrar para HttpOnly Cookies (Segurança)
**Problema Atual**: Token JWT armazenado em localStorage/sessionStorage é vulnerável a XSS
**Solução**:
- Enviar token em cookie HttpOnly + Secure + SameSite
- Backend define cookie na resposta de login
- Frontend não manipula token diretamente
- Adicionar middleware CSRF para proteção contra CSRF

**Arquivos a modificar**:
- `routes/auth.js` → res.cookie() no login
- `middleware/auth.js` → ler token de req.cookies
- `js/auth.js` → remover obterToken(), login não salva em storage
- Instalar `cookie-parser` no server.js

#### 5.2 Adicionar UX para Sessão Expirada
**Problema Atual**: Usuário recebe 401 sem feedback claro
**Solução**:
- Interceptor global que detecta 401
- Modal/banner informando "Sessão expirada. Faça login novamente"
- Botão para redirecionar ao login preservando página atual
- Opcional: Refresh token automático antes de expirar

**Arquivos a modificar**:
- `js/api.js` → adicionar interceptor de resposta
- `css/styles.css` → estilos do modal de sessão
- `index.html`, `admin.html` → modal HTML

#### 5.3 Implementar Refresh Token (Opcional)
**Benefício**: Sessões longas sem comprometer segurança
**Como funciona**:
- Login retorna accessToken (curto, 15min) + refreshToken (longo, 7d)
- AccessToken usado em requisições
- Quando expira, frontend pede novo usando refreshToken
- RefreshToken rotaciona a cada uso

---

## 🚨 AÇÕES OBRIGATÓRIAS NO RAILWAY

### 1. Aplicar Migrações do Banco de Dados
**CRÍTICO**: Banco de produção ainda não tem as novas tabelas/tipos

#### Usar o guia: `MIGRATIONS-RAILWAY.md`

Executar em ordem:
```sql
-- 1. Adicionar novos tipos ENUM para Suco Integral
ALTER TABLE vinhos 
MODIFY COLUMN tipo ENUM(
  'tinto', 'branco', 'rose', 'espumante', 'fortificado',
  'suco_integral_tinto', 'suco_integral_branco'
) NOT NULL;

-- 2. Criar tabela pedidos_itens (normalização)
CREATE TABLE IF NOT EXISTS pedidos_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL,
  vinho_id INT NOT NULL,
  quantidade INT NOT NULL DEFAULT 1,
  preco_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
  FOREIGN KEY (vinho_id) REFERENCES vinhos(id)
);

-- 3. Validar
SELECT tipo, COUNT(*) FROM vinhos GROUP BY tipo;
DESCRIBE pedidos_itens;
```

**Métodos disponíveis no guia**:
- DBeaver (GUI, recomendado)
- Docker + MySQL CLI
- MySQL Workbench

### 2. Migrar Senha do Admin para Bcrypt
**CRÍTICO**: Sistema não aceita mais senhas em plaintext

#### Usar o utilitário: `gerar-hash-senha.js`

```bash
node gerar-hash-senha.js
# Digite a senha quando solicitado
# Copie o hash gerado
```

Executar no banco Railway:
```sql
UPDATE usuarios 
SET senha = '$2b$10$...' -- Cole o hash aqui
WHERE email = 'hygordavidaraujo@gmail.com';
```

#### Remover variável de ambiente obsoleta:
No Railway Dashboard > Variables:
- Remover `ALLOW_PLAINTEXT_PASSWORDS` (se existir)

---

## 🔒 Melhorias de Segurança Aplicadas

### Resumo Geral
1. ✅ **Credenciais hardcoded removidas** (Etapa anterior)
2. ✅ **JWT em todas as rotas protegidas** (Etapa anterior)
3. ✅ **Schema normalizado** - pedidos_itens criado
4. ✅ **Rate limiting** - proteção contra brute force
5. ✅ **Validação de entrada** - prevenção de SQL injection/XSS
6. ✅ **Bcrypt obrigatório** - plaintext passwords desabilitado
7. ⏳ **HttpOnly cookies** - próxima etapa
8. ⏳ **UX sessão expirada** - próxima etapa

---

## 🧪 Testes Recomendados

### Testar Rate Limiting
```bash
# Tentar logar 6 vezes com senha errada
# Deve bloquear na 6ª tentativa por 15 minutos
```

### Testar Validações
```bash
# POST /api/auth/cadastro com senha fraca
# Deve retornar erro: "Senha deve ter no mínimo 8 caracteres"

# POST /api/vinhos com preço inválido
# Deve retornar erro: "Preço deve ser um número válido"
```

### Testar Pedidos Normalizados
```bash
# Criar pedido com 2 vinhos
# Verificar se cria 1 registro em pedidos + 2 em pedidos_itens
# GET /api/pedidos/cliente/:id deve retornar pedido.itens populado
```

---

## 📝 Notas Importantes

### Compatibilidade
- Sistema continua funcionando sem quebrar funcionalidades existentes
- Novos middlewares adicionam camadas de segurança sem alterar lógica de negócio
- Validações retornam mensagens claras para o frontend exibir

### Performance
- Rate limiting usa memória (ok para Railway Hobby)
- Para escalar: considerar Redis como store
- Validações são síncronas, impacto mínimo

### Monitoramento
- Logs de rate limit em console: "Too many requests from this IP"
- Validações logam erros detalhados
- Considerar integrar Sentry ou similar para produção

---

## 🔗 Arquivos de Referência
- `middleware/rateLimiter.js` - Rate limiters configurados
- `middleware/validators.js` - Validações express-validator
- `MIGRATIONS-RAILWAY.md` - Guia completo de migração DB
- `gerar-hash-senha.js` - Utilitário para bcrypt
- `database/schema-updated.sql` - Schema completo atualizado
