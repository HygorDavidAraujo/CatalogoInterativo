# GUIA DE TESTE - SUCO INTEGRAL

## 🧪 Teste 1: Verificar Banco de Dados

### ✅ 1.1 Conectar ao MySQL
```bash
mysql -u root -p
USE catalogo_vinhos;
SHOW CREATE TABLE vinhos\G
```

### ✅ 1.2 Verificar ENUM de tipos
```sql
-- Procure por linha que mostra:
-- tipo enum('tinto','branco','rose','espumante','suco_integral_tinto','suco_integral_branco')

-- Se não tiver, execute:
ALTER TABLE vinhos MODIFY tipo ENUM(
    'tinto', 
    'branco', 
    'rose', 
    'espumante', 
    'suco_integral_tinto', 
    'suco_integral_branco'
);

-- Validar:
SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME='vinhos' AND COLUMN_NAME='tipo';
```

---

## 🌐 Teste 2: Interface Frontend (index.html)

### ✅ 2.1 Verificar Filtros
1. Abrir http://localhost:3000
2. Procurar pela seção "Nosso Catálogo"
3. **Verificar que aparecem 6 botões:**
   - [Todos]
   - [Tintos]
   - [Brancos]
   - [Rosés]
   - [Espumantes]
   - **[Suco Integral]** ← NOVO!

### ✅ 2.2 Testar Clique no Filtro "Suco Integral"
1. Clicar no botão "Suco Integral"
2. Página deve filtrar e exibir somente produtos de suco integral
3. Se não houver produtos de suco integral, deve exibir: "Nenhum vinho encontrado nesta categoria"

### ✅ 2.3 Testar com DevTools
```javascript
// Abrir console (F12) e executar:
vinhoManager.getVinhos('suco_integral')
// Deve retornar array com produtos tipo 'suco_integral_tinto' e 'suco_integral_branco'
```

---

## 🔧 Teste 3: Painel Admin - Cadastro (admin.html)

### ✅ 3.1 Acessar Painel Admin
1. Fazer login como admin
2. Ir para Admin → Painel Administrativo
3. Procurar seção "Adicionar Vinho"

### ✅ 3.2 Verificar Select de Tipo
1. No formulário, clicar no campo "Tipo *"
2. **Deve exibir optgroup:**
   ```
   ─ Vinhos
      Tinto
      Branco
      Rosé
      Espumante
   ─ Suco Integral
      Suco Integral - Tinto ← NOVO
      Suco Integral - Branco ← NOVO
   ```

### ✅ 3.3 Criar Novo Produto de Suco Integral
1. Preencher formulário:
   - Nome: "Suco Integral de Uva Tinto"
   - Tipo: **"Suco Integral - Tinto"** (novo)
   - Uva: "Blend de tintas"
   - Ano de Safra: 2024
   - Preço: 25.90
   - Upload imagem (ou deixar em branco)
   - Descrição: "Suco natural 100% uva tinto"

2. Clicar "Adicionar Vinho"

3. **Verificar sucesso:**
   - Produto deve aparecer na lista
   - Produto deve ter tag "Suco Integral - Tinto"
   - Produto deve ser exibível na página inicial

---

## 👁️ Teste 4: Verificar Cores CSS

### ✅ 4.1 Cores no Index
1. Ir para http://localhost:3000
2. Filtrar por cada tipo:
   - Tintos → Tags vermelhas (#8B1538)
   - Brancos → Tags bege (#F4E4C1)
   - Rosés → Tags rosa (#F8B4D9)
   - Espumantes → Tags douradas (#FFD700)
   - **Suco Integral Tinto** → Tags marrom escuro (#6B3B2C) ← NOVO
   - **Suco Integral Branco** → Tags bege dourado (#D4AF85) ← NOVO

### ✅ 4.2 Cores no Admin
1. Ir para Admin
2. Ver lista de vinhos
3. Verificar que "Suco Integral - Tinto" tem cor marrom
4. Verificar que "Suco Integral - Branco" tem cor bege

### Validar com DevTools
```css
/* Abrir DevTools → Elements */
/* Procurar por elementos com classe .tipo-suco_integral_tinto */
/* Deve ter background-color: #6B3B2C */

/* E .tipo-suco_integral_branco */
/* Deve ter background-color: #D4AF85 */
```

---

## 🔍 Teste 5: Filtro Admin

### ✅ 5.1 Verificar Dropdown de Filtro no Admin
1. Ir para Admin
2. Na lista de vinhos, procurar "Filtro Tipo"
3. Abrir dropdown
4. **Deve ter opções:**
   - Todos os tipos
   - Tintos
   - Brancos
   - Rosés
   - Espumantes
   - **Suco Integral** ← NOVO

### ✅ 5.2 Testar Filtro "Suco Integral" no Admin
1. Selecionar "Suco Integral" no dropdown
2. Lista deve mostrar somente produtos de suco integral
3. Se houver múltiplos sucos, deve mostrar todos (tinto e branco juntos)

---

## 🧬 Teste 6: Código JavaScript

### ✅ 6.1 Verificar função getVinhos()
```javascript
// Abrir console e testar:
vinhoManager.getVinhos('suco_integral')
// Deve retornar somente produtos com tipo === 'suco_integral_tinto' ou 'suco_integral_branco'

vinhoManager.getVinhos('todos')
// Deve retornar todos os produtos

vinhoManager.getVinhos('tinto')
// Deve retornar somente tintos (vinhos, NOT suco)
```

### ✅ 6.2 Verificar função capitalizar()
```javascript
// Console:
capitalizar('suco_integral_tinto')
// Deve retornar: "Suco Integral - Tinto"

capitalizar('suco_integral_branco')
// Deve retornar: "Suco Integral - Branco"

capitalizar('tinto')
// Deve retornar: "Tinto"
```

---

## 📊 Teste 7: Fluxo Completo

### ✅ Cenário: Criar e Visualizar Suco Integral

1. **Login Admin:**
   - Acessar /admin.html
   - Login com credenciais

2. **Criar Produto:**
   - Seção "Adicionar Vinho"
   - Tipo: "Suco Integral - Tinto"
   - Nome: "Suco de Uva Tinta Integral"
   - Preço: R$ 29.90
   - Enviar formulário

3. **Verificar Listagem Admin:**
   - Deve aparecer na lista com tag "Suco Integral - Tinto" (marrom)
   - Filtro "Suco Integral" mostra o produto

4. **Verificar Página Inicial:**
   - Ir para http://localhost:3000
   - Clicar em "Suco Integral"
   - Deve aparecer o novo produto
   - Card deve ter cor de fundo correspondente

5. **Teste de Busca:**
   - Digitar "Suco de Uva Tinta Integral" na busca
   - Deve encontrar o produto

---

## ✅ Checklist de Testes

- [ ] Banco de dados tem ENUM com novo tipo
- [ ] Index.html mostra 6 botões de filtro (incluindo Suco Integral)
- [ ] Clicar "Suco Integral" filtra corretamente
- [ ] Admin pode selecionar "Suco Integral - Tinto" ao cadastrar
- [ ] Admin pode selecionar "Suco Integral - Branco" ao cadastrar
- [ ] Select tipo mostra optgroup (Vinhos e Suco Integral)
- [ ] Novo produto aparece na página inicial
- [ ] Cores CSS estão corretas (marrom para tinto, bege para branco)
- [ ] Filtro dropdown admin tem "Suco Integral"
- [ ] Filtro admin por "Suco Integral" funciona
- [ ] Função capitalizar() retorna strings corretas
- [ ] Função getVinhos('suco_integral') retorna ambos os tipos
- [ ] Produto novo é listado corretamente na busca

---

## 🐛 Troubleshooting

### Problema: ENUM não reconhece novo tipo
**Solução:**
```sql
ALTER TABLE vinhos MODIFY tipo ENUM(
    'tinto', 'branco', 'rose', 'espumante', 
    'suco_integral_tinto', 'suco_integral_branco'
);
```

### Problema: Botão "Suco Integral" não aparece
**Verificar:**
- [ ] index.html foi salvo corretamente
- [ ] Cache do navegador foi limpo (Ctrl+F5)
- [ ] Servidor foi reiniciado (npm start)

### Problema: Cores não aparecem
**Verificar:**
- [ ] css/styles.css foi salvo
- [ ] Classes .tipo-suco_integral_tinto e .tipo-suco_integral_branco existem
- [ ] Cache limpo (Ctrl+F5)

### Problema: Filtro retorna vazio
**Verificar:**
- [ ] Banco tem produtos com tipo='suco_integral_tinto' ou 'suco_integral_branco'
- [ ] Função getVinhos('suco_integral') no console funciona
- [ ] JavaScript não tem erros (ver console F12)

---

## 📹 Teste Visual

### Screenshot esperado - index.html
```
┌─────────────────────────────────────────────────────────────┐
│  Nosso Catálogo                                             │
│                                                              │
│  [Todos] [Tintos] [Brancos] [Rosés] [Espumantes] [Suco...] │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ Vinho 1  │  │ Vinho 2  │  │ SUCO     │ ← Novo!          │
│  │[Tinto]   │  │[Branco]  │  │[MARROM]  │                 │
│  │R$ 89.90  │  │R$ 65.00  │  │R$ 25.90  │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
│                                                              │
│       Suco Integral - Tinto                                │
│       R$ 25.90                                             │
│       [Adicionar ao Carrinho]                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

**Testes implementados com sucesso! 🎉**
