#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Setup script for Ollama with Llama 3.1 model for Synapticon LLM Express
.DESCRIPTION
    This script installs Ollama, pulls the required model, and configures the environment
.NOTES
    Requires PowerShell 5.1 or higher and administrator privileges for installation
#>

param(
    [Parameter(HelpMessage="Skip Ollama installation if already installed")]
    [switch]$SkipInstall,
    
    [Parameter(HelpMessage="Model to download (default: llama3.1:8b)")]
    [string]$Model = "llama3.1:8b"
)

$ErrorActionPreference = "Stop"

# Color output functions
function Write-Success { param($Message) Write-Host "✓ $Message" -ForegroundColor Green }
function Write-Info { param($Message) Write-Host "ℹ $Message" -ForegroundColor Cyan }
function Write-Warning { param($Message) Write-Host "⚠ $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "✗ $Message" -ForegroundColor Red }

Write-Host "`n================================================" -ForegroundColor Magenta
Write-Host "   Ollama Setup for Synapticon LLM Express" -ForegroundColor Magenta
Write-Host "================================================`n" -ForegroundColor Magenta

# Check if running as administrator for installation
if (-not $SkipInstall) {
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Warning "This script requires administrator privileges to install Ollama."
        Write-Info "Please run this script as administrator or use -SkipInstall flag if Ollama is already installed."
        exit 1
    }
}

# Step 1: Check if Ollama is already installed
Write-Info "Checking for existing Ollama installation..."
$ollamaInstalled = $false

try {
    $ollamaVersion = & ollama --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        $ollamaInstalled = $true
        Write-Success "Ollama is already installed: $ollamaVersion"
    }
} catch {
    Write-Info "Ollama not found in PATH"
}

# Step 2: Install Ollama if not installed
if (-not $ollamaInstalled -and -not $SkipInstall) {
    Write-Info "Installing Ollama using winget..."
    
    try {
        # Check if winget is available
        $wingetVersion = & winget --version 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "winget is not available. Please install it from Microsoft Store (App Installer)"
            Write-Info "Alternative: Download Ollama manually from https://ollama.ai/download/windows"
            exit 1
        }
        
        Write-Info "Running: winget install Ollama.Ollama --silent --accept-source-agreements --accept-package-agreements"
        & winget install Ollama.Ollama --silent --accept-source-agreements --accept-package-agreements
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Ollama installed successfully!"
            
            # Refresh environment variables
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            
            # Wait a moment for installation to complete
            Start-Sleep -Seconds 3
        } else {
            Write-Error "Ollama installation failed with exit code $LASTEXITCODE"
            exit 1
        }
    } catch {
        Write-Error "Failed to install Ollama: $_"
        exit 1
    }
} elseif ($SkipInstall) {
    Write-Info "Skipping Ollama installation (--SkipInstall flag)"
}

# Step 3: Check if Ollama service is running
Write-Info "Checking Ollama service status..."
Start-Sleep -Seconds 2

try {
    $ollamaProcess = Get-Process -Name "ollama" -ErrorAction SilentlyContinue
    if ($null -eq $ollamaProcess) {
        Write-Info "Starting Ollama service..."
        Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden
        Start-Sleep -Seconds 5
        Write-Success "Ollama service started"
    } else {
        Write-Success "Ollama service is already running"
    }
} catch {
    Write-Warning "Could not verify Ollama service status: $_"
}

# Step 4: Test Ollama API
Write-Info "Testing Ollama API connection..."
$maxRetries = 5
$retryCount = 0
$apiAvailable = $false

while ($retryCount -lt $maxRetries -and -not $apiAvailable) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -Method GET -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $apiAvailable = $true
            Write-Success "Ollama API is responding on http://localhost:11434"
        }
    } catch {
        $retryCount++
        if ($retryCount -lt $maxRetries) {
            Write-Info "Waiting for Ollama API... (attempt $retryCount/$maxRetries)"
            Start-Sleep -Seconds 3
        }
    }
}

if (-not $apiAvailable) {
    Write-Error "Ollama API is not responding after $maxRetries attempts"
    Write-Info "Try running manually: ollama serve"
    exit 1
}

# Step 5: Check if model is already downloaded
Write-Info "Checking for existing models..."
try {
    $response = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method GET
    $existingModels = $response.models | ForEach-Object { $_.name }
    
    if ($existingModels -contains $Model) {
        Write-Success "Model '$Model' is already downloaded"
        $pullModel = $false
    } else {
        Write-Info "Model '$Model' not found locally"
        $pullModel = $true
    }
} catch {
    Write-Warning "Could not check existing models: $_"
    $pullModel = $true
}

# Step 6: Pull the model
if ($pullModel) {
    Write-Info "Downloading model '$Model' (this may take several minutes)..."
    Write-Info "Model size: ~4.7GB for llama3.1:8b"
    
    try {
        & ollama pull $Model
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Model '$Model' downloaded successfully!"
        } else {
            Write-Error "Failed to download model '$Model'"
            exit 1
        }
    } catch {
        Write-Error "Error downloading model: $_"
        exit 1
    }
}

# Step 7: Verify model is working
Write-Info "Testing model '$Model'..."
try {
    $testPrompt = '{"model": "' + $Model + '", "prompt": "Say hello in one word", "stream": false}'
    $response = Invoke-RestMethod -Uri "http://localhost:11434/api/generate" -Method POST -Body $testPrompt -ContentType "application/json" -TimeoutSec 30
    
    if ($response.response) {
        Write-Success "Model test successful! Response: $($response.response.Trim())"
    }
} catch {
    Write-Warning "Model test failed: $_"
}

# Step 8: Configure environment variables
Write-Info "`nConfiguring environment variables..."

$envFile = Join-Path $PSScriptRoot ".env"
$envContent = @"
# LLM Configuration
# Choose one: LM Studio or Ollama

# === LM Studio Configuration (Default) ===
# LMSTUDIO_BASE_URL=http://localhost:1234/v1
# LMSTUDIO_API_KEY=lm-studio
# LMSTUDIO_MODEL=meta-llama-3.1-8b-instruct

# === Ollama Configuration (Recommended for Production) ===
LMSTUDIO_BASE_URL=http://localhost:11434/v1
LMSTUDIO_API_KEY=ollama
LMSTUDIO_MODEL=$Model

# MCP Server Configuration
MCP_SERVER_URL=http://localhost:8036
"@

if (Test-Path $envFile) {
    Write-Warning ".env file already exists"
    $backup = "$envFile.backup." + (Get-Date -Format "yyyyMMdd-HHmmss")
    Copy-Item $envFile $backup
    Write-Info "Created backup: $backup"
}

Set-Content -Path $envFile -Value $envContent -Force
Write-Success "Environment configuration updated in .env"

# Step 9: Display next steps
Write-Host "`n================================================" -ForegroundColor Green
Write-Host "   Setup Complete! " -ForegroundColor Green
Write-Host "================================================`n" -ForegroundColor Green

Write-Host "✓ Ollama is installed and running" -ForegroundColor Green
Write-Host "✓ Model '$Model' is ready" -ForegroundColor Green
Write-Host "✓ Environment configured`n" -ForegroundColor Green

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Install dependencies:" -ForegroundColor White
Write-Host "   npm install`n" -ForegroundColor Gray

Write-Host "2. Start the server:" -ForegroundColor White
Write-Host "   npm run dev`n" -ForegroundColor Gray

Write-Host "3. Test the API:" -ForegroundColor White
Write-Host "   http://localhost:3000/api/mcp-tools/mcp-status`n" -ForegroundColor Gray

Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  • Ollama API: http://localhost:11434" -ForegroundColor Gray
Write-Host "  • Model: $Model" -ForegroundColor Gray
Write-Host "  • Environment: .env file`n" -ForegroundColor Gray

Write-Host "Available Models:" -ForegroundColor Cyan
Write-Host "  • llama3.1:8b (default, 4.7GB)" -ForegroundColor Gray
Write-Host "  • llama3.1:7b (4.1GB)" -ForegroundColor Gray
Write-Host "  • qwen2.5:7b (4.7GB)" -ForegroundColor Gray
Write-Host "  • mistral:7b (4.1GB)`n" -ForegroundColor Gray

Write-Host "To switch models: ollama pull <model-name>`n" -ForegroundColor Gray

Write-Info "For more information, see OLLAMA_SETUP.md"
