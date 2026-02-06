# 🎨 Guia: Configuração de Cores VIP

## 📝 Visão Geral

O sistema de benefícios VIP agora suporta **cores personalizadas** para cada tipo de VIP. As cores são configuráveis pelo painel administrativo e aplicadas automaticamente em todos os badges VIP do site.

---

## 🗄️ Banco de Dados

### Coluna Adicionada: `cor`

```sql
ALTER TABLE beneficios_vip 
ADD COLUMN cor VARCHAR(7) DEFAULT '#6B1C40' AFTER valor_desconto;
```

**Formato:** Código hexadecimal de cor (#RRGGBB)
**Padrão:** `#6B1C40` (cor vinho do tema)

### Cores Padrão Configuradas:

| VIP | Cor | Código Hex |
|-----|-----|------------|
| **Prata** | 🩶 Prata | `#C0C0C0` |
| **Ouro** | 💛 Dourado | `#FFD700` |
| **Diamante** | 💎 Azul Diamante | `#B9F2FF` |

---

## 👨‍💼 Como Configurar Cores no Painel Admin

### **Passo 1:** Acessar o Painel
1. Faça login como **administrador**
2. Acesse: **admin.html**
3. Vá em: **Configurações do Site** > **Benefícios VIP**

### **Passo 2:** Adicionar Novo Benefício com Cor
1. Preencha os campos do formulário:
   - **Nome do Benefício**: Ex: "VIP Platina"
   - **Identificador (slug)**: Ex: "platina"
   - **Tipo de Desconto**: Percentual ou Valor Fixo
   - **Valor do Desconto**: Ex: 15
   - **Cor do Badge**: 🎨 **Clique no seletor de cor** e escolha
   - **Ordem de Exibição**: Ex: 4
2. Clique em **Adicionar Benefício**

### **Passo 3:** Editar Cor de Benefício Existente
1. Na lista de benefícios cadastrados, localize o benefício
2. Clique no botão **Editar** (ícone de lápis)
3. Informe a nova cor quando solicitado (formato: `#RRGGBB`)
4. Confirme as alterações

---

## 🔧 Como Funciona Tecnicamente

### 1. **Armazenamento**
- Cor armazenada na tabela `beneficios_vip` como VARCHAR(7)
- Formato hexadecimal: `#RRGGBB` (ex: `#FFD700`)

### 2. **API**
- GET `/api/beneficios` retorna cor junto com outros dados
- POST/PUT `/api/beneficios` aceita campo `cor`
- Validação: cor opcional, padrão `#6B1C40`

### 3. **VipManager (Frontend)**
```javascript
// Nova função para obter cor
window.vipManager.getCorBeneficio('ouro'); // Retorna: "#FFD700"

// Nova função para gerar badge HTML completo
window.vipManager.getBadgeHtml('ouro'); 
// Retorna: <span class="badge-vip badge-ouro" style="background-color: #FFD700; color: #000;">VIP Ouro</span>
```

### 4. **Contraste Automático**
O sistema calcula automaticamente a luminosidade da cor de fundo para decidir se usa texto **preto** ou **branco**:

```javascript
// Cores claras (luminosidade > 0.5) → texto preto
// Ex: #FFD700 (Ouro) → texto preto

// Cores escuras (luminosidade ≤ 0.5) → texto branco
// Ex: #6B1C40 (Vinho) → texto branco
```

**Benefício:** Garante legibilidade em qualquer cor escolhida!

---

## 🎨 Interface do Usuário

### Onde as Cores Aparecem:

#### 1. **Painel Admin - Lista de Benefícios**
- Badge colorido com o nome do VIP
- Código hex exibido ao lado (ex: `#FFD700`)

#### 2. **Perfil do Cliente - Histórico de Pedidos**
- Badge VIP com cor personalizada
- Exibido ao lado do preço com desconto

#### 3. **Gerenciar Clientes (Admin)**
- Select dropdown com descrição do benefício
- Cor não exibida no dropdown (apenas nome e desconto)

---

## 🎯 Exemplos de Uso

### **Exemplo 1: Criar VIP Platina Roxo**
```
Nome: VIP Platina
Slug: platina
Desconto: 15%
Cor: #9B59B6 (Roxo)
Ordem: 4
```

Resultado:
- Badge roxo com texto branco
- 15% de desconto nos produtos
- Exibido após Diamante na ordem

### **Exemplo 2: Alterar Prata para Azul Claro**
1. Editar benefício "VIP Prata"
2. Mudar cor de `#C0C0C0` para `#87CEEB`
3. **Todos os badges Prata** ficam azul claro automaticamente

### **Exemplo 3: Tema Corporativo**
Usar cores da marca da empresa:
- VIP Bronze: `#CD7F32`
- VIP Prata: `#C0C0C0`
- VIP Ouro: `#FFD700`
- VIP Platina: `#E5E4E2`

---

## 💡 Dicas e Boas Práticas

### ✅ **Recomendações:**
- Use cores **contrastantes** entre os tipos VIP
- Prefira cores **vibrantes** para destaque
- Teste a legibilidade em dispositivos móveis
- Mantenha consistência com a identidade visual

### ❌ **Evite:**
- Cores muito claras (ex: `#FFFFFF` - dificulta leitura)
- Cores muito escuras sem contraste (ex: `#000000`)
- Cores similares entre VIPs diferentes
- Mudar cores frequentemente (confunde usuários)

### 🎨 **Sugestões de Paleta:**

**Metais Preciosos:**
- Prata: `#C0C0C0`
- Ouro: `#FFD700`
- Platina: `#E5E4E2`
- Titânio: `#878681`

**Pedras Preciosas:**
- Rubi: `#E0115F`
- Esmeralda: `#50C878`
- Safira: `#0F52BA`
- Diamante: `#B9F2FF`

**Cores Corporativas:**
- Azul Corporativo: `#1976D2`
- Verde Sucesso: `#4CAF50`
- Laranja Vibrante: `#FF9800`
- Roxo Premium: `#9C27B0`

---

## 🔄 Migração Aplicada

### Script: `add-cor-beneficios.js`

**O que fez:**
1. ✅ Adicionou coluna `cor VARCHAR(7)` na tabela `beneficios_vip`
2. ✅ Configurou cor padrão `#6B1C40`
3. ✅ Atualizou VIPs existentes com cores apropriadas:
   - Prata: `#C0C0C0`
   - Ouro: `#FFD700`
   - Diamante: `#B9F2FF`

**Status:** Executado com sucesso ✅

---

## 📦 Arquivos Modificados

### Criado:
- ✅ `add-cor-beneficios.js` - Script de migração

### Modificados:
- ✅ `admin.html` - Input type="color" no formulário
- ✅ `js/api-admin.js` - CRUD com suporte a cor
- ✅ `js/vip-manager.js` - Funções getCorBeneficio() e getBadgeHtml()
- ✅ `js/perfil.js` - Uso de getBadgeHtml() com cores

---

## 🧪 Testando o Sistema

### **Teste 1: Verificar Cores Atuais**
1. Abra o painel admin
2. Acesse Configurações > Benefícios VIP
3. Veja os badges coloridos na lista

### **Teste 2: Alterar Cor**
1. Edite um benefício existente
2. Mude a cor (ex: `#FF0000` para vermelho)
3. Salve e verifique o badge atualizado

### **Teste 3: Criar Novo VIP com Cor**
1. Adicione "VIP Platina"
2. Escolha cor roxa (`#9B59B6`)
3. Atribua a um cliente de teste
4. Faça login como esse cliente
5. Veja o badge roxo no perfil

### **Teste 4: Contraste de Texto**
1. Teste cor clara (ex: `#FFFF00` - amarelo)
   - Esperado: texto preto
2. Teste cor escura (ex: `#000080` - azul marinho)
   - Esperado: texto branco

---

## 🔐 Segurança

- ✅ Apenas **admins** podem criar/editar benefícios
- ✅ Validação de formato hex no backend (opcional)
- ✅ Valor padrão seguro (`#6B1C40`)
- ✅ Sanitização de entrada (trim, lowercase no slug)

---

## 🚀 Próximas Melhorias (Opcional)

1. **Validador de Cor no Frontend:**
   - Verificar formato `#RRGGBB` antes de enviar

2. **Paleta de Cores Sugeridas:**
   - Dropdown com cores predefinidas

3. **Preview em Tempo Real:**
   - Mostrar badge de exemplo ao escolher cor

4. **Gradiente de Cores:**
   - Suporte a gradientes CSS (ex: `linear-gradient()`)

5. **Tema Escuro:**
   - Ajustar cores automaticamente para modo escuro

---

## ❓ Perguntas Frequentes

### **P: Posso usar nomes de cores ao invés de hex?**
R: Não. O sistema aceita apenas códigos hexadecimais (#RRGGBB). Use um seletor de cor online para converter.

### **P: O que acontece se eu não definir uma cor?**
R: A cor padrão `#6B1C40` (vinho) será aplicada automaticamente.

### **P: As cores funcionam em todos os navegadores?**
R: Sim! Cores hexadecimais são suportadas por todos os navegadores modernos.

### **P: Posso usar transparência?**
R: Não. O campo aceita apenas 7 caracteres (#RRGGBB). Para transparência, seria necessário usar RGBA.

### **P: Como voltar às cores padrão?**
R: Execute novamente o script `add-cor-beneficios.js` ou edite manualmente no banco/admin.

---

## 📊 Status da Funcionalidade

| Componente | Status | Observações |
|------------|--------|-------------|
| Coluna `cor` no DB | ✅ Criada | VARCHAR(7) com padrão |
| Cores padrão | ✅ Configuradas | Prata, Ouro, Diamante |
| API GET | ✅ Funcional | Retorna cor |
| API POST/PUT | ✅ Funcional | Aceita cor |
| Admin Panel | ✅ Funcional | Input color picker |
| VipManager | ✅ Atualizado | getCorBeneficio(), getBadgeHtml() |
| Perfil Cliente | ✅ Funcional | Badges coloridos |
| Contraste Auto | ✅ Implementado | Texto preto/branco |

---

## 💡 Conclusão

O sistema de cores VIP está **100% funcional** e pronto para uso! Administradores podem personalizar as cores de cada tipo VIP diretamente pelo painel, sem necessidade de editar código. As cores são aplicadas automaticamente em todos os badges do site, com contraste de texto ajustado para garantir legibilidade.

**Data de implementação:** Fevereiro 2026  
**Status:** ✅ **PRODUÇÃO - OPERACIONAL**

---

## 🔗 Documentos Relacionados

- [SISTEMA-VIP-DINAMICO.md](SISTEMA-VIP-DINAMICO.md) - Sistema completo de benefícios VIP
- Script: `add-cor-beneficios.js` - Migração de cores
- Script: `add-beneficios-table.js` - Criação da tabela original
