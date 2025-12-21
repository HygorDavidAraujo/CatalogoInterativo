# ============================================
# SCRIPT: Atualizar Banco Railway via Variáveis
# ============================================

# PASSO 1: Copie as credenciais do Railway
# Vá em: Railway Dashboard → MySQL → Variables
# E cole os valores abaixo:

$MYSQL_HOST = "SEU_HOST_AQUI.railway.app"
$MYSQL_PORT = "3306"
$MYSQL_USER = "root"
$MYSQL_PASSWORD = "SUA_SENHA_AQUI"
$MYSQL_DATABASE = "railway"

# PASSO 2: SQL que será executado
$SQL_COMMAND = @"
ALTER TABLE vinhos 
MODIFY COLUMN tipo ENUM(
    'tinto',
    'branco',
    'rose',
    'espumante',
    'suco_integral_tinto',
    'suco_integral_branco'
) NOT NULL;

SELECT 'Migração concluída com sucesso!' as status;
"@

# PASSO 3: Executar via mysql client
Write-Host "Conectando ao Railway MySQL..." -ForegroundColor Cyan

# Salvar SQL em arquivo temporário
$SQL_COMMAND | Out-File -FilePath ".\temp_migration.sql" -Encoding UTF8

# Executar
mysql -h $MYSQL_HOST -P $MYSQL_PORT -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE < .\temp_migration.sql

# Limpar arquivo temporário
Remove-Item .\temp_migration.sql

Write-Host "Concluído!" -ForegroundColor Green
