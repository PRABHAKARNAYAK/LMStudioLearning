# Synapticon LLM Express Server

Express.js server that integrates with MCP (Model Context Protocol) tools to provide LLM-powered servo drive control and automation.

## Features

- 🤖 **Local LLM Integration** - Works with Ollama or LM Studio
- 🔧 **MCP Tool Execution** - Direct access to Motion Master Client tools
- 💬 **Chat Interface** - Natural language interaction with servo drives
- 🎯 **Smart Parameter Extraction** - Automatic tool selection and parameter validation
- ✅ **Availability Checking** - Automatic validation of LLM and MCP servers

## Quick Start

### Prerequisites

- Node.js 18+
- Either:
  - **Ollama** (recommended for production) - See [OLLAMA_SETUP.md](OLLAMA_SETUP.md)
  - **LM Studio** (good for development)
- Motion Master Client MCP Server running on port 8036

### Installation

#### Option 1: Automated Setup with Ollama (Recommended)

```powershell
# Clone/navigate to the repository
cd synapticon-llm-express

# Run the automated setup (requires Administrator privileges)
.\setup-ollama.ps1

# Install dependencies
npm install

# Start the server
npm run dev
```

#### Option 2: Manual Setup

```powershell
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env to configure your LLM provider (Ollama or LM Studio)

# Start the server
npm run dev
```

## Configuration

The server uses environment variables for configuration. See [.env.example](.env.example) for all options.

### Using Ollama (Recommended)

```env
LMSTUDIO_BASE_URL=http://localhost:11434/v1
LMSTUDIO_API_KEY=ollama
LMSTUDIO_MODEL=llama3.1:8b
MCP_SERVER_URL=http://localhost:8036
PORT=3000
```

**Setup Guide:** See [OLLAMA_SETUP.md](OLLAMA_SETUP.md) for detailed instructions.

### Using LM Studio

```env
LMSTUDIO_BASE_URL=http://localhost:1234/v1
LMSTUDIO_API_KEY=lm-studio
LMSTUDIO_MODEL=meta-llama-3.1-8b-instruct
MCP_SERVER_URL=http://localhost:8036
PORT=3000
```

## API Endpoints

### Health Check

```http
GET /api/mcp-tools/mcp-status
```

Returns the status of MCP server connection and available tools.

**Response:**

```json
{
  "mcpServerAvailable": true,
  "baseUrl": "http://localhost:8036",
  "toolsAvailable": 15,
  "tools": [...]
}
```

### List Available Tools

```http
GET /api/mcp-tools/list-tools
```

Returns all available MCP tools with their descriptions and parameters.

### Analyze Question

```http
POST /api/mcp-tools/analyze-question
Content-Type: application/json

{
  "question": "Discover devices with MAC address 00:11:22:33:44:55"
}
```

Analyzes a user question to identify the appropriate tool and extract parameters.

**Response:**

```json
{
  "success": true,
  "toolSuggestion": {
    "toolName": "discoverDevices",
    "toolDescription": "Discover Synapticon devices on the network",
    "providedParameters": {
      "macAddress": "00:11:22:33:44:55"
    },
    "missingParameters": []
  }
}
```

### Chat with MCP Tools

```http
POST /api/mcp-tools/chat-with-mcp-tools
Content-Type: application/json

{
  "question": "What devices are available?",
  "conversationHistory": []
}
```

Main endpoint for natural language interaction. The LLM will:

1. Understand the user's intent
2. Select and execute the appropriate tool(s)
3. Return a natural language response with the results

**Response:**

```json
{
  "success": true,
  "answer": "I found 2 Synapticon devices on the network:\n1. Device 'Servo-01' (MAC: 00:11:22:33:44:55)\n2. Device 'Servo-02' (MAC: AA:BB:CC:DD:EE:FF)",
  "toolsUsed": ["discoverDevices"],
  "debug": {
    "requestModel": "llama3.1:8b",
    "toolsAvailable": 15,
    "toolsCalled": 1
  }
}
```

### Execute Tool Directly

```http
POST /api/mcp-tools/execute-tool
Content-Type: application/json

{
  "toolName": "discoverDevices",
  "args": {
    "macAddress": "00:11:22:33:44:55"
  }
}
```

Direct tool execution without LLM processing (for testing or programmatic access).

## Available Scripts

```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## Architecture

```
┌─────────────────┐
│   Client App    │
│  (Angular UI)   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Synapticon LLM Express Server  │
│  ┌───────────────────────────┐  │
│  │  /analyze-question        │  │
│  │  /chat-with-mcp-tools     │  │
│  │  /execute-tool            │  │
│  │  /list-tools              │  │
│  └───────────┬───────────────┘  │
└──────────────┼──────────────────┘
               │
      ┌────────┴────────┐
      ▼                 ▼
┌───────────┐    ┌──────────────┐
│  Ollama   │    │  MCP Bridge  │
│  (LLM)    │    │              │
└───────────┘    └──────┬───────┘
                        │
                        ▼
              ┌──────────────────┐
              │  MCP Server      │
              │  (Motion Master) │
              └──────────────────┘
```

## Error Handling

The server includes comprehensive error handling:

- **503 Service Unavailable** - LLM or MCP server not available
- **400 Bad Request** - Invalid parameters or malformed requests
- **500 Internal Server Error** - Unexpected errors

Each error response includes:

- Clear error message
- Helpful suggestions for resolution
- Debug information when applicable

## Troubleshooting

### LLM Server Not Available

**Error:** `LLM server is not available`

**Solution:**

- **Ollama:** Run `ollama serve` or check [OLLAMA_SETUP.md](OLLAMA_SETUP.md)
- **LM Studio:** Open LM Studio and ensure a model is loaded

### MCP Server Not Available

**Error:** `MCP server is not available`

**Solution:**

```bash
cd SE.IA.Lexium38i.MotionMasterClient
npm run start:mcp
```

### Model Not Found

**Error:** `Model 'llama3.1:8b' is not available`

**Solution:**

```bash
ollama pull llama3.1:8b
```

### Port Already in Use

**Error:** `Port 3000 is already in use`

**Solution:**
Change the port in `.env`:

```env
PORT=3001
```

## Development

### Project Structure

```
synapticon-llm-express/
├── src/
│   ├── server.ts              # Main Express server
│   ├── routes/
│   │   └── mcpToolsRoute.ts   # MCP tools endpoints
│   ├── services/
│   │   └── mcpBridge.ts       # MCP server communication
│   └── middleware/            # Express middleware
├── setup-ollama.ps1           # Automated Ollama setup
├── OLLAMA_SETUP.md            # Ollama installation guide
├── .env.example               # Environment template
└── package.json
```

### Adding New Endpoints

1. Create route handler in `src/routes/`
2. Register route in `src/server.ts`
3. Document in this README

### Testing

```bash
# Test MCP status
curl http://localhost:3000/api/mcp-tools/mcp-status

# Test tool listing
curl http://localhost:3000/api/mcp-tools/list-tools

# Test chat
curl -X POST http://localhost:3000/api/mcp-tools/chat-with-mcp-tools \
  -H "Content-Type: application/json" \
  -d '{"question": "What tools are available?"}'
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

[Your License Here]

## Support

For issues and questions:

- Check [OLLAMA_SETUP.md](OLLAMA_SETUP.md) for setup issues
- Review error messages and suggestions in API responses
- Check server logs for detailed debugging information

---

**Version:** 0.1.0  
**Last Updated:** February 2026
