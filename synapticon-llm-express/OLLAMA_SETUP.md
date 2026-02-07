# Ollama Setup Guide for Synapticon LLM Express

This guide helps you set up **Ollama** as a local LLM provider for the Synapticon LLM Express server, eliminating the need for LM Studio or cloud-based services.

## Why Ollama?

✅ **Easy Installation** - Simple CLI-based setup  
✅ **No GUI Required** - Runs as a background service  
✅ **OpenAI-Compatible API** - Works with existing code  
✅ **Cross-Platform** - Windows, macOS, and Linux  
✅ **Production-Ready** - Reliable and performant  
✅ **Free & Open Source** - No licensing concerns

---

## Quick Start (Automated)

### Windows

Run the automated setup script from PowerShell (as Administrator):

```powershell
cd synapticon-llm-express
.\setup-ollama.ps1
```

This script will:

1. Install Ollama via winget
2. Download the Llama 3.1 8B model (~4.7GB)
3. Configure your `.env` file
4. Verify the installation

### Manual Setup

If you prefer manual installation or the script doesn't work:

#### Step 1: Install Ollama

**Windows:**

```powershell
winget install Ollama.Ollama
```

**macOS:**

```bash
brew install ollama
```

**Linux:**

```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

#### Step 2: Start Ollama Service

Ollama usually starts automatically after installation. If not:

```bash
ollama serve
```

This runs Ollama as a background service on `http://localhost:11434`.

#### Step 3: Download the Model

```bash
ollama pull llama3.1:8b
```

**Note:** This downloads ~4.7GB. First run may take several minutes.

#### Step 4: Verify Installation

Test the model:

```bash
ollama run llama3.1:8b "Say hello in one word"
```

Expected output: `Hello` or similar.

---

## Configuration

### Update Environment Variables

Edit your `.env` file in the `synapticon-llm-express` directory:

```env
# Ollama Configuration (Recommended)
LMSTUDIO_BASE_URL=http://localhost:11434/v1
LMSTUDIO_API_KEY=ollama
LMSTUDIO_MODEL=llama3.1:8b

# MCP Server Configuration
MCP_SERVER_URL=http://localhost:8036
```

**Note:** The variable names still use `LMSTUDIO_*` prefix for backward compatibility, but they work with Ollama.

### Alternative Models

Ollama supports various models. Choose based on your needs:

| Model          | Size  | Best For                                                   | Download Command           |
| -------------- | ----- | ---------------------------------------------------------- | -------------------------- |
| `llama3.1:8b`  | 4.7GB | **Recommended** - Best balance of performance and accuracy | `ollama pull llama3.1:8b`  |
| `llama3.1:7b`  | 4.1GB | Slightly smaller, faster responses                         | `ollama pull llama3.1:7b`  |
| `qwen2.5:7b`   | 4.7GB | Strong tool-calling capabilities                           | `ollama pull qwen2.5:7b`   |
| `mistral:7b`   | 4.1GB | Good for general tasks                                     | `ollama pull mistral:7b`   |
| `llama3.1:70b` | 40GB  | Best accuracy (requires high-end GPU)                      | `ollama pull llama3.1:70b` |

To switch models:

1. Download the new model: `ollama pull <model-name>`
2. Update `LMSTUDIO_MODEL` in `.env`
3. Restart your server

---

## Starting the Application

### 1. Start the MCP Server

```powershell
# From the SE.IA.Lexium38i.MotionMasterClient directory
npm run start:mcp
```

### 2. Start Synapticon LLM Express

```powershell
# From the synapticon-llm-express directory
npm run dev
```

### 3. Verify Everything Works

Open your browser and navigate to:

```
http://localhost:3000/api/mcp-tools/mcp-status
```

You should see:

```json
{
  "mcpServerAvailable": true,
  "baseUrl": "http://localhost:8036",
  "toolsAvailable": 15,
  "tools": [...]
}
```

---

## Testing the Setup

### Test 1: Check Ollama is Running

```bash
curl http://localhost:11434/api/tags
```

Expected: JSON response with list of models.

### Test 2: List Available Tools

```bash
curl http://localhost:3001/api/mcp/list-tools
```

### Test 3: Ask a Question

```bash
curl -X POST http://localhost:3001/api/mcp/chat-with-mcp-tools \
   -H "Content-Type: application/json" \
   -d '{"question": "What tools are available?"}'


```

powershell:
Invoke-RestMethod -Uri http://localhost:3001/api/mcp/chat-with-mcp-tools `  -Method POST`
-ContentType "application/json" `
-Body '{"question": "What tools are available?"}'

---

## Troubleshooting

### Ollama Not Responding

**Issue:** `LLM server is not available at http://localhost:11434`

**Solutions:**

1. Check if Ollama is running:
   ```bash
   ollama list
   ```
2. Start Ollama service:
   ```bash
   ollama serve
   ```
3. Verify port 11434 is not blocked:
   ```powershell
   Test-NetConnection -ComputerName localhost -Port 11434
   ```

### Model Not Found

**Issue:** `Model 'llama3.1:8b' is not available`

**Solutions:**

1. Check downloaded models:
   ```bash
   ollama list
   ```
2. Download the model:
   ```bash
   ollama pull llama3.1:8b
   ```
3. Verify model name matches exactly in `.env`

### Slow Performance

**Solutions:**

1. Use a smaller model: `llama3.1:7b` or `mistral:7b`
2. Ensure you have at least 8GB RAM available
3. Close other memory-intensive applications
4. Check GPU utilization:
   ```bash
   ollama ps
   ```

### Port Conflict

**Issue:** Port 11434 is already in use

**Solutions:**

1. Find the process using the port:
   ```powershell
   Get-NetTCPConnection -LocalPort 11434
   ```
2. Kill the conflicting process or change Ollama's port:
   ```bash
   OLLAMA_HOST=0.0.0.0:11435 ollama serve
   ```
3. Update `.env`:
   ```env
   LMSTUDIO_BASE_URL=http://localhost:11435/v1
   ```

### Connection Timeout

**Issue:** Requests timeout when calling the LLM

**Solutions:**

1. Increase timeout in your code (already set to 30s for model tests)
2. Use a smaller model for faster responses
3. Check system resources (CPU/RAM/GPU)

---

## Advanced Configuration

### GPU Acceleration

Ollama automatically uses your GPU if available. To verify:

```bash
ollama ps
```

You should see GPU utilization if a GPU is detected.

### Memory Management

Control memory usage:

```bash
# Set maximum GPU memory (in MB)
OLLAMA_GPU_MEMORY_FRACTION=0.8 ollama serve

# Limit concurrent requests
OLLAMA_NUM_PARALLEL=1 ollama serve
```

### Custom Model Parameters

Create a `Modelfile` to customize model behavior:

```modelfile
FROM llama3.1:8b

PARAMETER temperature 0.2
PARAMETER top_p 0.9
PARAMETER top_k 40
```

Create the custom model:

```bash
ollama create my-custom-llama -f Modelfile
```

Update `.env`:

```env
LMSTUDIO_MODEL=my-custom-llama
```

---

## Comparison: Ollama vs LM Studio

| Feature                | Ollama        | LM Studio            |
| ---------------------- | ------------- | -------------------- |
| **Installation**       | CLI (winget)  | GUI installer        |
| **Interface**          | Command-line  | Desktop GUI          |
| **Model Management**   | `ollama pull` | GUI download         |
| **Background Service** | ✅ Yes        | ❌ Requires app open |
| **Production Ready**   | ✅ Yes        | ⚠️ Development tool  |
| **Scripting**          | ✅ Easy       | ❌ Limited           |
| **Memory Efficient**   | ✅ Yes        | ⚠️ Higher overhead   |
| **API Compatibility**  | OpenAI        | OpenAI               |

---

## Uninstalling

If you need to remove Ollama:

**Windows:**

```powershell
winget uninstall Ollama.Ollama
```

**macOS:**

```bash
brew uninstall ollama
```

**Linux:**

```bash
sudo systemctl stop ollama
sudo rm /usr/local/bin/ollama
sudo rm -rf ~/.ollama
```

To remove downloaded models only:

```bash
ollama rm llama3.1:8b
```

---

## Support & Resources

- **Ollama Documentation:** https://ollama.ai/docs
- **Model Library:** https://ollama.ai/library
- **GitHub Issues:** https://github.com/ollama/ollama/issues
- **Discord Community:** https://discord.gg/ollama

---

## Frequently Asked Questions

### Can I use both Ollama and LM Studio?

Yes! Simply change the environment variables in `.env` to switch between them.

### Which model should I use?

For most users, `llama3.1:8b` is the best choice. It's the same model you were using in LM Studio.

### How much disk space do I need?

- Ollama: ~150MB
- Llama 3.1 8B Model: ~4.7GB
- **Total:** ~5GB

### Does this work offline?

Yes! Once the model is downloaded, everything runs locally without internet.

### Can I use multiple models simultaneously?

Yes, Ollama can load multiple models. Just download them with `ollama pull` and switch by changing the `LMSTUDIO_MODEL` variable.

### Is my data sent to external servers?

No. Everything runs locally on your machine. No data leaves your system.

---

## Next Steps

Once Ollama is set up:

1. ✅ Verify the setup with test commands above
2. 📖 Read the [README.md](README.md) for application usage
3. 🧪 Test tool execution with your servo devices
4. 🚀 Deploy your application without dependencies on GUI tools

---

**Need Help?** Check the troubleshooting section or create an issue in the project repository.
