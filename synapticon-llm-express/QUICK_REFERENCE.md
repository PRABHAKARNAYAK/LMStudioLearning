# Quick Reference: Ollama vs LM Studio

## When to Use Each

### Use Ollama if:

- ✅ Deploying to production
- ✅ Need CLI automation
- ✅ Want background service
- ✅ Prefer lightweight setup
- ✅ Need scriptable installation

### Use LM Studio if:

- ✅ Developing/experimenting
- ✅ Prefer GUI interface
- ✅ Want to test different models quickly
- ✅ Need visual model management

## Quick Commands

### Ollama

```bash
# Install
winget install Ollama.Ollama

# Pull model
ollama pull llama3.1:8b

# List models
ollama list

# Run model interactively
ollama run llama3.1:8b

# Remove model
ollama rm llama3.1:8b

# Check status
curl http://localhost:11434/api/tags

# Start service
ollama serve
```

### LM Studio

```
1. Download from lmstudio.ai
2. Open application
3. Download model from UI
4. Start local server
5. Copy model name from UI
```

## Environment Configuration

### Ollama

```env
LMSTUDIO_BASE_URL=http://localhost:11434/v1
LMSTUDIO_API_KEY=ollama
LMSTUDIO_MODEL=llama3.1:8b
```

### LM Studio

```env
LMSTUDIO_BASE_URL=http://localhost:1234/v1
LMSTUDIO_API_KEY=lm-studio
LMSTUDIO_MODEL=meta-llama-3.1-8b-instruct
```

## Switching Between Them

Just update your `.env` file and restart the server:

```bash
# Stop server (Ctrl+C)

# Edit .env file with new values

# Start server
npm run dev
```

## Model Recommendations

| Use Case            | Ollama Model   | LM Studio Model              |
| ------------------- | -------------- | ---------------------------- |
| **Production**      | `llama3.1:8b`  | N/A                          |
| **Development**     | `llama3.1:8b`  | `meta-llama-3.1-8b-instruct` |
| **Faster Response** | `llama3.1:7b`  | `Llama-3.1-7B-Instruct`      |
| **Best Accuracy**   | `llama3.1:70b` | `Llama-3.1-70B-Instruct`     |
| **Tool Calling**    | `qwen2.5:7b`   | `Qwen2.5-7B-Instruct`        |

## Troubleshooting Quick Fixes

| Problem        | Ollama Fix                | LM Studio Fix      |
| -------------- | ------------------------- | ------------------ |
| Not responding | `ollama serve`            | Open LM Studio app |
| Model missing  | `ollama pull llama3.1:8b` | Download in UI     |
| Wrong port     | Check 11434               | Check 1234         |
| Out of memory  | Use smaller model         | Use smaller model  |

## Performance Comparison

| Metric             | Ollama      | LM Studio   |
| ------------------ | ----------- | ----------- |
| Startup Time       | < 2 seconds | ~10 seconds |
| Memory Usage       | Lower       | Higher      |
| Background Running | ✅ Yes      | ❌ No       |
| API Latency        | ~50-200ms   | ~50-200ms   |

## Common Issues

### "Connection refused"

```bash
# Ollama
ollama serve

# LM Studio
# Open the application and start local server
```

### "Model not found"

```bash
# Ollama
ollama pull llama3.1:8b

# LM Studio
# Download model in application
```

### "Port already in use"

```bash
# Find what's using the port
# Windows:
netstat -ano | findstr :11434
netstat -ano | findstr :1234

# Kill the process or change the port in .env
```

## Best Practices

### For Development

1. Use LM Studio for quick model testing
2. Switch to Ollama when you find the right model
3. Keep `.env.example` updated

### For Production

1. Always use Ollama
2. Pin specific model versions
3. Use `setup-ollama.ps1` for consistent deployment
4. Monitor memory usage
5. Set up health checks

## Resources

- **Ollama Docs:** https://ollama.ai/docs
- **LM Studio:** https://lmstudio.ai
- **Model Library:** https://ollama.ai/library
- **This Project:** [OLLAMA_SETUP.md](OLLAMA_SETUP.md)
