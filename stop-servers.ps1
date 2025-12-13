# Stop all MCP System servers
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Stopping MCP Servo Control System" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ports = @(3000, 4000, 4200)
$stoppedAny = $false

foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "🛑 Stopping $($proc.ProcessName) on port $port (PID: $($proc.Id))..." -ForegroundColor Yellow
            Stop-Process -Id $proc.Id -Force
            $stoppedAny = $true
        }
    }
}

if (-not $stoppedAny) {
    Write-Host "ℹ️  No servers were running." -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "✅ All servers stopped successfully!" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
