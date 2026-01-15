# MCP Server Integration - Quick Start Guide

## One-Time Setup

### 1. Install Dependencies

```bash
# Install MCP Server dependencies
cd SE.IA.Lexium38i.MotionMasterClient
npm install

# Install Express backend dependencies
cd ../synapticon-llm-express
npm install

# Install Angular frontend dependencies
cd ../LLM_UI
npm install
```

### 2. Build Projects

```bash
# Build MCP Server
cd SE.IA.Lexium38i.MotionMasterClient
npm run build

# Build Express backend
cd ../synapticon-llm-express
npm run build

# Build Angular frontend
cd ../LLM_UI
npm run build
```

## Startup Checklist

Before running, ensure:

- [ ] Node.js v18+ installed
- [ ] LM Studio downloaded and installed
- [ ] Motion Master Client backend available (port 8036)
- [ ] Model `meta-llama-3.1-8b-instruct` downloaded in LM Studio

## Running the Integration

### Terminal 1: MCP Server

```bash
cd SE.IA.Lexium38i.MotionMasterClient
npm run start
# Logs: "Server is running on http://localhost:8036"
# Logs: "MCP HTTP endpoint available at http://localhost:8036/mcp"
```

### Terminal 2: Express Backend

```bash
cd synapticon-llm-express
npm run start
# Logs: "LLM API on http://localhost:3001"
```

### Terminal 3: Angular Frontend

```bash
cd LLM_UI
ng serve
# Logs: "Application bundle generation complete"
# Navigate to http://localhost:4200/mcp-chat
```

### Terminal 4: LM Studio

```
1. Launch LM Studio application
2. Load model: meta-llama-3.1-8b-instruct
3. Start local server (default port 1234)
4. Verify: http://localhost:1234/v1/models should return list of models
```

## Verify All Services

Open a new terminal and run:

```bash
# Check MCP Server
curl http://localhost:8036/health

# Check Express Backend
curl http://localhost:3001/health

# Check LM Studio
curl http://localhost:1234/v1/models

# Check MCP Status via Express
curl http://localhost:3001/api/mcp/mcp-status
```

Expected responses:

- MCP: `{"ok":true}`
- Express: `{"ok":true}`
- LM Studio: List of models with meta-llama-3.1-8b-instruct included
- MCP Status: Tools list with availability info

## Access the Chat UI

1. Open browser: `http://localhost:4200/mcp-chat`
2. Wait for MCP server status to show "✓ MCP Server Connected"
3. Try example prompts:
   - "Discover devices on network with MAC address 00:11:22:33:44:55"
   - "Get the current state of device-1"
   - "Move device-1 to position 5000 with acceleration 1000"

## Troubleshooting Quick Links

### Services Won't Start

- Check Node.js version: `node --version` (need v18+)
- Check ports in use: `netstat -ano` (Windows) or `lsof -i` (Mac/Linux)
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`

### MCP Server Error

- Ensure port 8036 is available
- Check logs for permission errors
- Verify backend service is running (if required)

### LM Studio Not Found

- Check LM Studio is running
- Verify model is loaded
- Check server port (default 1234)
- Restart LM Studio

### Chat Not Working

- Check MCP Status shows green indicator
- Check browser console for errors
- Verify all three services are running
- Check network tab in browser dev tools

## Environment Variables

Create `.env` files if you need different ports:

**synapticon-llm-express/.env:**

```
PORT=3001
LMSTUDIO_BASE_URL=http://localhost:1234/v1
LMSTUDIO_API_KEY=lm-studio
LMSTUDIO_MODEL=meta-llama-3.1-8b-instruct
```

## Stopping Services

Press `Ctrl+C` in each terminal to stop the service.

## Logs and Debugging

Each service logs to console. For more detailed logging:

```bash
# Enable debug mode
DEBUG=* npm run start

# Or set in .env
DEBUG=mcp*,express*,llm*
```

## Common Commands

```bash
# Build and run MCP Server
cd SE.IA.Lexium38i.MotionMasterClient && npm run build && npm run start

# Build and run Express backend
cd synapticon-llm-express && npm run build && npm run start

# Development mode for Angular (auto-reload)
cd LLM_UI && ng serve --open

# Production build for Angular
cd LLM_UI && ng build --configuration production
```

## Next Steps

1. ✅ All services running
2. ✅ Chat UI accessible
3. ✅ MCP tools available
4. Try some example queries
5. Configure servo devices (if available)
6. Integrate with your workflow

For detailed documentation, see `MCP_INTEGRATION_README.md`
