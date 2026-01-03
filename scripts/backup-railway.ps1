param(
    [string]$OutputDir = "./backups",
    [switch]$Gzip
)

# Fail fast on errors
$ErrorActionPreference = 'Stop'

function Require-Env($name) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Variável de ambiente '$name' não definida. Configure antes de rodar."
    }
    return $value
}

# Carrega variáveis do ambiente (use as do Railway)
$MYSQLHOST = Require-Env 'MYSQLHOST'
$MYSQLPORT = Require-Env 'MYSQLPORT'
$MYSQLUSER = Require-Env 'MYSQLUSER'
$MYSQLPASSWORD = Require-Env 'MYSQLPASSWORD'
$MYSQLDATABASE = Require-Env 'MYSQLDATABASE'

# Garante diretório de saída
$fullOutputDir = Resolve-Path -LiteralPath $OutputDir -ErrorAction SilentlyContinue
if (-not $fullOutputDir) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
    $fullOutputDir = Resolve-Path -LiteralPath $OutputDir
}

$timestamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
$baseName = "${MYSQLDATABASE}-${timestamp}.sql"
$outFile = Join-Path $fullOutputDir $baseName

# Usa Docker para evitar dependência local de mysqldump
# Observação: exige Docker instalado e em execução
$dockerCmd = @(
    "docker", "run", "--rm",
    "-e", "MYSQL_PWD=$MYSQLPASSWORD",
    "mysql:8.0",
    "mysqldump", "--no-tablespaces",
    "-h", $MYSQLHOST,
    "-P", $MYSQLPORT,
    "-u", $MYSQLUSER,
    $MYSQLDATABASE
)

Write-Host "Criando backup em $outFile ..."
$processInfo = New-Object System.Diagnostics.ProcessStartInfo
$processInfo.FileName = $dockerCmd[0]
foreach ($arg in $dockerCmd[1..($dockerCmd.Count-1)]) {
    $processInfo.ArgumentList.Add($arg)
}
$processInfo.RedirectStandardOutput = $true
$processInfo.RedirectStandardError = $true
$processInfo.UseShellExecute = $false

$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $processInfo
$null = $proc.Start()

$stdOut = $proc.StandardOutput.ReadToEndAsync()
$stdErr = $proc.StandardError.ReadToEndAsync()
$proc.WaitForExit()

if ($proc.ExitCode -ne 0) {
    Write-Error "mysqldump falhou. STDERR: $($stdErr.Result)"
    exit $proc.ExitCode
}

[IO.File]::WriteAllText($outFile, $stdOut.Result)

if ($Gzip) {
    $gzFile = "$outFile.gz"
    Write-Host "Comprimindo para $gzFile ..."
    $fs = [IO.File]::OpenRead($outFile)
    $gz = New-Object System.IO.Compression.GzipStream([IO.File]::Create($gzFile), [IO.Compression.CompressionLevel]::Optimal)
    $fs.CopyTo($gz)
    $gz.Dispose(); $fs.Dispose()
    Remove-Item $outFile
    $outFile = $gzFile
}

Write-Host "Backup concluído: $outFile"
