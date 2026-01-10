# 🏆 Sistema de Graduação Automática de VIP

**Data da Análise:** 10 de Janeiro de 2026  
**Status:** Planejamento - Não implementado  
**Complexidade:** Alta  
**Tempo Estimado:** 3-5 dias de desenvolvimento + 1-2 dias de testes

---

## 📋 RESUMO DO SISTEMA

Sistema automático de graduação de clientes VIP baseado na quantidade de vinhos comprados mensalmente.

### Regras de Graduação:

| Unidades/Mês | Nível VIP | Próximo Mês |
|--------------|-----------|-------------|
| 1 unidade    | Nenhum    | Sem VIP     |
| 2-3 unidades | Prata     | VIP Prata   |
| 4-5 unidades | Ouro      | VIP Ouro    |
| 6+ unidades  | Diamante  | VIP Diamante|

### Comportamento:
- ✅ **Manutenção**: Comprar mesma faixa → mantém nível
- ⬆️ **Upgrade**: Comprar mais → sobe automaticamente
- ⬇️ **Downgrade**: Comprar menos → desce automaticamente
- 📅 **Aplicação**: Compras do mês N → Nível aplicado em 1º dia do mês N+1

---

## 🗄️ 1. ALTERAÇÕES NO BANCO DE DADOS

### 1.1 Tabela `usuarios` (JÁ EXISTE)
```sql
-- Colunas VIP já existentes:
is_vip BOOLEAN DEFAULT FALSE
vip_tipo ENUM('prata', 'ouro', 'diamante') DEFAULT NULL
```

### 1.2 NOVA TABELA: `historico_vip`
```sql
CREATE TABLE IF NOT EXISTS historico_vip (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    nivel_anterior ENUM('prata', 'ouro', 'diamante') DEFAULT NULL,
    nivel_novo ENUM('prata', 'ouro', 'diamante') DEFAULT NULL,
    periodo_referencia VARCHAR(7) NOT NULL COMMENT 'Formato YYYY-MM',
    quantidade_unidades INT NOT NULL,
    motivo ENUM('upgrade', 'downgrade', 'manutencao', 'perda_vip', 'primeiro_vip') NOT NULL,
    data_mudanca TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    observacoes TEXT,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_usuario_id (usuario_id),
    INDEX idx_periodo (periodo_referencia),
    INDEX idx_data_mudanca (data_mudanca)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Objetivo:** Rastrear todas as mudanças de nível VIP para auditoria e histórico.

### 1.3 NOVA TABELA: `metricas_mensais_usuario`
```sql
CREATE TABLE IF NOT EXISTS metricas_mensais_usuario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    mes_referencia VARCHAR(7) NOT NULL COMMENT 'Formato YYYY-MM',
    quantidade_unidades_compradas INT DEFAULT 0,
    total_pedidos INT DEFAULT 0,
    total_gasto DECIMAL(10, 2) DEFAULT 0.00,
    vip_atual_no_periodo ENUM('prata', 'ouro', 'diamante') DEFAULT NULL,
    proximo_nivel_calculado ENUM('prata', 'ouro', 'diamante') DEFAULT NULL,
    processado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    UNIQUE KEY unique_usuario_mes (usuario_id, mes_referencia),
    INDEX idx_mes_referencia (mes_referencia),
    INDEX idx_processado (processado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Objetivo:** Armazenar métricas mensais de compras e calcular o próximo nível VIP.

---

## 🔧 2. LÓGICA DE NEGÓCIO - COMPONENTES

### 2.1 Service Layer: `services/VipCalculationService.js`

```javascript
// FUNÇÕES PRINCIPAIS:

/**
 * Calcula o nível VIP baseado na quantidade de unidades
 * @param {number} quantidade - Total de unidades compradas
 * @returns {string|null} 'prata' | 'ouro' | 'diamante' | null
 */
calcularNivelVipPorCompras(quantidade)

/**
 * Processa as mudanças de VIP para todos os usuários
 * Executa no 1º dia de cada mês
 */
processarMudancasVipMensal()

/**
 * Atualiza o nível VIP de um usuário específico
 * @param {number} usuarioId
 * @param {string|null} novoNivel
 * @param {string} motivo
 */
atualizarNivelVipUsuario(usuarioId, novoNivel, motivo)

/**
 * Obtém métricas de compras de um usuário em um período
 * @param {number} usuarioId
 * @param {string} mesAno - Formato 'YYYY-MM'
 */
obterMetricasMensaisUsuario(usuarioId, mesAno)

/**
 * Registra métrica mensal quando pedido é criado
 * @param {number} usuarioId
 * @param {number} quantidadeItens
 * @param {number} totalPedido
 */
registrarCompraNaMetrica(usuarioId, quantidadeItens, totalPedido)
```

### 2.2 Service Layer: `services/MetricasService.js`

```javascript
// FUNÇÕES AUXILIARES:

/**
 * Calcula total de unidades compradas no mês
 */
calcularTotalUnidadesMes(usuarioId, mesAno)

/**
 * Busca todos usuários com compras no mês anterior
 */
buscarUsuariosComComprasMesAnterior()

/**
 * Gera relatório de mudanças VIP do mês
 */
gerarRelatorioMudancasVip(mesAno)
```

### 2.3 Cron Job: `jobs/vip-monthly-processor.js`

```javascript
const cron = require('node-cron');
const VipCalculationService = require('../services/VipCalculationService');

// Executa todo dia 1º do mês às 00:05
cron.schedule('5 0 1 * *', async () => {
    console.log('🔄 Iniciando processamento mensal de VIP...');
    await VipCalculationService.processarMudancasVipMensal();
    console.log('✅ Processamento concluído!');
});
```

---

## 🛣️ 3. ROTAS API NECESSÁRIAS

### 3.1 Rotas Admin: `routes/vip.js`

```javascript
// Dashboard e gestão VIP (Admin apenas)
GET    /api/vip/metricas
       → Estatísticas gerais de VIPs
       
GET    /api/vip/processar-mes
       → Forçar processamento manual (emergência)
       
GET    /api/vip/historico/:userId
       → Ver histórico de mudanças de um usuário
       
GET    /api/vip/relatorio/:mesAno
       → Relatório de mudanças do mês específico
       
PUT    /api/vip/ajustar/:userId
       → Ajuste manual de nível VIP (admin override)
```

### 3.2 Rotas Cliente: (adicionar em `routes/auth.js` ou criar `routes/perfil.js`)

```javascript
// Status VIP do cliente logado
GET    /api/vip/meu-status
       → Ver status VIP atual e histórico pessoal
       
GET    /api/vip/proximo-nivel
       → Progresso para próximo nível
       → Ex: "Faltam 2 unidades para VIP Ouro"
       
GET    /api/vip/meu-historico
       → Histórico pessoal de mudanças VIP
```

---

## 📐 4. REGRAS DE NEGÓCIO DETALHADAS

### 4.1 Contagem de Unidades

**O QUE CONTA:**
- ✅ Somar campo `quantidade` da tabela `pedidos_itens`
- ✅ Apenas pedidos com `status` = 'entregue' ou 'enviado'
- ✅ Período: 1º dia do mês 00:00:00 até último dia 23:59:59

**O QUE NÃO CONTA:**
- ❌ Pedidos `status` = 'cancelado'
- ❌ Pedidos `status` = 'pendente' (ainda não confirmados)

### 4.2 Cálculo de Nível

```javascript
function calcularNivel(quantidade) {
    if (quantidade <= 1) return null;        // Sem VIP
    if (quantidade >= 2 && quantidade <= 3) return 'prata';
    if (quantidade >= 4 && quantidade <= 5) return 'ouro';
    if (quantidade >= 6) return 'diamante';
}
```

### 4.3 Aplicação do Nível

**Exemplo Timeline:**
```
Janeiro/2026:
  - Cliente compra 5 unidades (dias 10 e 25)
  - Sistema registra na tabela metricas_mensais_usuario
  - mes_referencia: '2026-01'
  - quantidade_unidades_compradas: 5
  - proximo_nivel_calculado: 'ouro'

1º de Fevereiro/2026 às 00:05:
  - Cron executa processamento
  - Busca métricas de Janeiro
  - Aplica: usuarios.vip_tipo = 'ouro', is_vip = TRUE
  - Registra em historico_vip
  
Fevereiro/2026:
  - Cliente usa descontos VIP Ouro
```

### 4.4 Exceções e Casos Especiais

**Caso 1: Cliente nunca foi VIP**
- Compra 1 unidade → Continua sem VIP
- Compra 2+ unidades → Torna-se VIP no mês seguinte

**Caso 2: Cliente VIP que não compra nada**
- **Opção A (Recomendada):** Perde VIP no mês seguinte
- **Opção B:** Mantém por 1 mês de carência
- **A DEFINIR PELA EQUIPE**

**Caso 3: Múltiplos pedidos no mesmo mês**
- Pedido #1: 2 unidades (dia 5)
- Pedido #2: 3 unidades (dia 20)
- Total: 5 unidades → VIP Ouro

**Caso 4: Admin ajuste manual**
- Admin pode forçar nível VIP manualmente
- Registrar em historico_vip com motivo 'ajuste_manual'
- Não sobrescrever no processamento automático do mês

---

## 🏗️ 5. IMPLEMENTAÇÃO TÉCNICA

### 5.1 Estrutura de Arquivos

```
services/
  ├── VipCalculationService.js     (lógica principal)
  ├── MetricasService.js            (cálculos auxiliares)
  ├── NotificationService.js        (notificar mudanças - opcional)
  
jobs/
  ├── vip-monthly-processor.js      (cron mensal)
  
routes/
  ├── vip.js                        (rotas API VIP)
  
middleware/
  ├── vipPricing.js                 (aplicar descontos VIP - futuro)
  
database/
  ├── migration-vip-automation.sql  (criar tabelas)
  
tests/
  ├── vip-calculation.test.js       (testes unitários)
  ├── vip-integration.test.js       (testes integração)
```

### 5.2 Dependências NPM

```json
{
  "node-cron": "^3.0.3",     // Agendamento automático
  "moment": "^2.30.1"        // Manipulação de datas/meses
}
```

**Instalar:**
```bash
npm install node-cron moment
```

### 5.3 Modificações em Arquivos Existentes

#### `routes/pedidos.js`
```javascript
// Após criar pedido com sucesso, registrar métrica:
const VipCalculationService = require('../services/VipCalculationService');

// Dentro do router.post('/')
const quantidadeTotal = itens.reduce((sum, item) => sum + item.quantidade, 0);
await VipCalculationService.registrarCompraNaMetrica(
    usuario_id, 
    quantidadeTotal, 
    total
);
```

#### `server.js`
```javascript
// Adicionar inicialização do cron
if (process.env.NODE_ENV === 'production') {
    require('./jobs/vip-monthly-processor');
    console.log('✅ Cron de processamento VIP iniciado');
}
```

---

## 🔄 6. FLUXO DE EXECUÇÃO COMPLETO

### Cenário Real: Cliente João

**Timeline Detalhada:**

```
📅 15/Jan/2026 - 14:30
  └─ João faz Pedido #1
     ├─ 3 garrafas de Château Margaux
     └─ Sistema registra: metricas_mensais_usuario
        ├─ usuario_id: 123
        ├─ mes_referencia: '2026-01'
        ├─ quantidade_unidades_compradas: 3
        └─ total_gasto: R$ 1.350,00

📅 28/Jan/2026 - 19:45
  └─ João faz Pedido #2
     ├─ 2 garrafas de Domaine Leflaive
     └─ Sistema ATUALIZA: metricas_mensais_usuario
        ├─ quantidade_unidades_compradas: 3 + 2 = 5
        ├─ total_pedidos: 2
        ├─ total_gasto: R$ 2.150,00
        └─ proximo_nivel_calculado: 'ouro' (4-5 unidades)

📅 31/Jan/2026 - 23:59
  └─ Mês termina com João tendo comprado 5 unidades

📅 01/Fev/2026 - 00:05 ⏰ CRON EXECUTA
  └─ VipCalculationService.processarMudancasVipMensal()
     ├─ Busca metricas_mensais_usuario de Janeiro
     ├─ Encontra João com 5 unidades
     ├─ Calcula: 5 unidades → VIP Ouro
     ├─ UPDATE usuarios:
     │  ├─ is_vip = TRUE
     │  └─ vip_tipo = 'ouro'
     ├─ INSERT historico_vip:
     │  ├─ nivel_anterior: NULL
     │  ├─ nivel_novo: 'ouro'
     │  ├─ motivo: 'primeiro_vip'
     │  ├─ periodo_referencia: '2026-01'
     │  └─ quantidade_unidades: 5
     └─ [OPCIONAL] Enviar email: "Parabéns! Você é VIP Ouro!"

📅 15/Fev/2026
  └─ João faz compras com DESCONTO VIP Ouro ativo

📅 28/Fev/2026
  └─ João compra apenas 2 unidades em Fevereiro
     └─ proximo_nivel_calculado: 'prata' (downgrade)

📅 01/Mar/2026 - 00:05 ⏰ CRON EXECUTA
  └─ Aplica DOWNGRADE
     ├─ vip_tipo: 'ouro' → 'prata'
     ├─ historico_vip:
     │  ├─ nivel_anterior: 'ouro'
     │  ├─ nivel_novo: 'prata'
     │  ├─ motivo: 'downgrade'
     │  └─ quantidade_unidades: 2
     └─ Email: "Seu nível VIP mudou para Prata"
```

---

## 🔒 7. CONSIDERAÇÕES DE SEGURANÇA E PERFORMANCE

### 7.1 Segurança

✅ **Transações**: Update de nível deve usar transações SQL  
✅ **Autorização**: Apenas admin pode forçar processamento manual  
✅ **Validação**: Verificar integridade dos dados antes de aplicar mudanças  
✅ **Auditoria**: Todo evento registrado em `historico_vip`  
✅ **Logs**: Sistema de logs para debugar problemas  

### 7.2 Performance

✅ **Índices**: 
```sql
-- Já existentes:
INDEX idx_usuario_id ON pedidos(usuario_id)
INDEX idx_created_at ON pedidos(created_at)

-- Novos necessários:
INDEX idx_status_created ON pedidos(status, created_at)
INDEX idx_pedido_quantidade ON pedidos_itens(pedido_id, quantidade)
```

✅ **Batch Processing**: 
- Processar usuários em lotes de 100
- Evitar timeout em grandes volumes

✅ **Cache**: 
- Cachear métricas do mês atual
- Invalidar cache quando novo pedido for criado

✅ **Query Otimization**:
```sql
-- Buscar apenas necessário
SELECT usuario_id, SUM(quantidade) as total
FROM pedidos_itens pi
JOIN pedidos p ON pi.pedido_id = p.id
WHERE YEAR(p.created_at) = ? 
  AND MONTH(p.created_at) = ?
  AND p.status IN ('enviado', 'entregue')
GROUP BY usuario_id
```

---

## 🧪 8. TESTES NECESSÁRIOS

### 8.1 Testes Unitários

```javascript
describe('VipCalculationService', () => {
    test('Deve retornar null para 1 unidade', () => {
        expect(calcularNivelVipPorCompras(1)).toBe(null);
    });
    
    test('Deve retornar prata para 2 unidades', () => {
        expect(calcularNivelVipPorCompras(2)).toBe('prata');
    });
    
    test('Deve retornar ouro para 4 unidades', () => {
        expect(calcularNivelVipPorCompras(4)).toBe('ouro');
    });
    
    test('Deve retornar diamante para 6+ unidades', () => {
        expect(calcularNivelVipPorCompras(6)).toBe('diamante');
    });
});
```

### 8.2 Testes de Integração

**Cenários a testar:**

1. ✅ **Upgrade**: Cliente compra mais → nível sobe
2. ✅ **Downgrade**: Cliente compra menos → nível desce
3. ✅ **Manutenção**: Cliente mantém compras → nível mantém
4. ✅ **Primeiro VIP**: Cliente nunca VIP vira VIP
5. ✅ **Perda VIP**: Cliente VIP não compra → perde VIP
6. ✅ **Múltiplos pedidos**: Somatória correta no mês
7. ✅ **Pedidos cancelados**: Não contam
8. ✅ **Pedidos pendentes**: Não contam
9. ✅ **Virada de mês**: Processar corretamente
10. ✅ **Ajuste manual**: Admin pode forçar nível

### 8.3 Testes Manuais

**Checklist de Homologação:**

- [ ] Criar usuário teste
- [ ] Fazer compras de 2 unidades
- [ ] Forçar processamento manual
- [ ] Verificar se virou VIP Prata
- [ ] Comprar mais 3 unidades (total 5)
- [ ] Forçar processamento
- [ ] Verificar upgrade para Ouro
- [ ] Comprar apenas 1 unidade
- [ ] Verificar downgrade para sem VIP
- [ ] Verificar histórico completo

---

## 🚀 9. MELHORIAS FUTURAS (Opcional)

### Fase 2 - Gamificação
- Sistema de pontos acumulados
- Badges por conquistas (ex: "3 meses VIP Diamante")
- Ranking de clientes VIP
- Desafios mensais

### Fase 3 - Benefícios VIP
- Descontos progressivos por nível
- Frete grátis para VIP Ouro+
- Acesso antecipado a lançamentos
- Eventos exclusivos

### Fase 4 - Retenção
- Programa de resgate (voltar ao VIP com bônus)
- Notificações quando próximo de perder nível
- Sugestões de compra para manter/subir nível
- Histórico visual de evolução (gráficos)

### Fase 5 - Analytics
- Dashboard de retenção VIP
- Previsão de churn
- Análise de lifetime value por nível
- Segmentação de campanhas por nível VIP

---

## 📊 10. MÉTRICAS DE SUCESSO

### KPIs para monitorar:

1. **Taxa de Conversão VIP**
   - % de clientes que viram VIP
   - Meta: 25% dos clientes ativos

2. **Retenção VIP**
   - % que mantém nível por 3+ meses
   - Meta: 60% de retenção

3. **Upgrade Rate**
   - % que sobem de nível
   - Meta: 15% dos VIPs

4. **Ticket Médio VIP vs Não-VIP**
   - Comparar gastos médios
   - Meta: VIP gasta 2.5x mais

5. **Lifetime Value (LTV)**
   - Valor total por cliente VIP
   - Meta: LTV 3x maior que não-VIP

---

## 📝 11. CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Banco de Dados
- [ ] Criar migration `migration-vip-automation.sql`
- [ ] Criar tabela `historico_vip`
- [ ] Criar tabela `metricas_mensais_usuario`
- [ ] Criar índices necessários
- [ ] Testar em ambiente local

### Fase 2: Services
- [ ] Criar `VipCalculationService.js`
- [ ] Criar `MetricasService.js`
- [ ] Implementar função `calcularNivelVipPorCompras()`
- [ ] Implementar função `processarMudancasVipMensal()`
- [ ] Implementar função `registrarCompraNaMetrica()`

### Fase 3: Rotas API
- [ ] Criar `routes/vip.js`
- [ ] Implementar rotas admin
- [ ] Implementar rotas cliente
- [ ] Adicionar middlewares de autenticação

### Fase 4: Cron Job
- [ ] Criar `jobs/vip-monthly-processor.js`
- [ ] Configurar schedule (1º do mês)
- [ ] Adicionar logs
- [ ] Testar execução manual

### Fase 5: Integração
- [ ] Modificar `routes/pedidos.js` para registrar métricas
- [ ] Modificar `server.js` para iniciar cron
- [ ] Instalar dependências (node-cron, moment)

### Fase 6: Testes
- [ ] Criar testes unitários
- [ ] Criar testes de integração
- [ ] Executar testes manuais
- [ ] Validar com dados reais

### Fase 7: Documentação
- [ ] Documentar API endpoints
- [ ] Criar guia de uso para admin
- [ ] Criar FAQ para clientes
- [ ] Atualizar README.md

### Fase 8: Deploy
- [ ] Testar em staging
- [ ] Fazer backup do banco
- [ ] Executar migrations em produção
- [ ] Deploy do código
- [ ] Monitorar logs

---

## ⚠️ 12. RISCOS E MITIGAÇÕES

### Risco 1: Processamento falhar no 1º do mês
**Mitigação**: 
- Implementar retry automático
- Notificar admin por email se falhar
- Permitir processamento manual via API

### Risco 2: Cálculo errado de unidades
**Mitigação**:
- Testes extensivos
- Logs detalhados
- Histórico completo para auditoria
- Função de reverter mudanças (rollback)

### Risco 3: Performance em grande volume
**Mitigação**:
- Processamento em batches
- Índices otimizados
- Query optimization
- Monitoramento de performance

### Risco 4: Conflito de status de pedidos
**Mitigação**:
- Definir claramente quais status contam
- Documentar regras
- Considerar apenas pedidos finalizados

---

## 📞 13. CONTATOS E RESPONSÁVEIS

**Desenvolvedor:** Hygor David Araujo  
**Email:** hygordavidaraujo@gmail.com  
**Telefone:** (62) 98183-1483  

**Aprovação Necessária:**
- [ ] Gerente de Produto
- [ ] Gerente Comercial  
- [ ] Diretor Financeiro (regras de desconto)

---

## 📅 14. CRONOGRAMA SUGERIDO

**Semana 1:**
- Dias 1-2: Criar tabelas e migrations
- Dias 3-5: Implementar services básicos

**Semana 2:**
- Dias 1-2: Criar rotas API
- Dias 3-4: Implementar cron job
- Dia 5: Integração com pedidos

**Semana 3:**
- Dias 1-3: Testes unitários e integração
- Dias 4-5: Testes manuais e ajustes

**Semana 4:**
- Dias 1-2: Documentação
- Dias 3-4: Staging e homologação
- Dia 5: Deploy produção

---

## 🎯 PRÓXIMOS PASSOS

Quando decidir implementar:

1. Revisar e aprovar este documento com stakeholders
2. Definir regra para "cliente VIP que não compra" (perde ou mantém?)
3. Definir se haverá descontos por nível VIP (e quais valores)
4. Criar branch git: `feature/vip-automatic-graduation`
5. Iniciar pela Fase 1 (Banco de Dados)
6. Seguir checklist de implementação

---

**Documento criado em:** 10/01/2026  
**Última atualização:** 10/01/2026  
**Versão:** 1.0  
**Status:** 📋 Aguardando Aprovação

