# MCP System Startup Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   MCP Servo Control System Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if ports are already in use
$ports = @(3000, 4000, 4200)
$portsInUse = @()

foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $portsInUse += $port
    }
}

if ($portsInUse.Count -gt 0) {
    Write-Host "⚠️  The following ports are already in use: $($portsInUse -join ', ')" -ForegroundColor Yellow
    $response = Read-Host "Do you want to stop these processes and continue? (y/n)"
    
    if ($response -eq 'y' -or $response -eq 'Y') {
        foreach ($port in $portsInUse) {
            $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
            if ($conn) {
                $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
                if ($proc) {
                    Write-Host "  Stopping process on port $port (PID: $($proc.Id))..." -ForegroundColor Yellow
                    Stop-Process -Id $proc.Id -Force
                }
            }
        }
        Start-Sleep -Seconds 1
    } else {
        Write-Host "❌ Startup cancelled." -ForegroundColor Red
        exit
    }
}

# Navigate to project root
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

Write-Host ""
Write-Host "🚀 Starting Mock Backend API (Port 4000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptPath\MCP_Server'; Write-Host 'Mock Backend API' -ForegroundColor Cyan; npm run dev:mock" -WindowStyle Normal

Write-Host "   Waiting for backend to initialize..." -ForegroundColor Gray
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "🚀 Starting MCP Server (Port 3000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptPath\MCP_Server'; Write-Host 'MCP Server' -ForegroundColor Cyan; npm run dev:http" -WindowStyle Normal

Write-Host "   Waiting for MCP server to initialize..." -ForegroundColor Gray
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "🚀 Starting Angular Frontend (Port 4200)..." -ForegroundColor Green
Write-Host "   This will open in this window..." -ForegroundColor Gray
Start-Sleep -Seconds 1

# Change to LLM_UI directory and start Angular
Set-Location "$scriptPath\LLM_UI"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ All servers are starting!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📱 Once the Angular dev server starts, open:" -ForegroundColor Yellow
Write-Host "   http://localhost:4200" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔍 You can check server status with:" -ForegroundColor Yellow
Write-Host "   netstat -ano | findstr `":3000 :4000 :4200`"" -ForegroundColor Gray
Write-Host ""
Write-Host "🛑 To stop all servers, run:" -ForegroundColor Yellow
Write-Host "   .\stop-servers.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Start Angular in this window
npm start
