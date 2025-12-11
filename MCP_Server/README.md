
# Servo MCP Bridge (TypeScript) — Ready to Run

This project is a **Model Context Protocol (MCP)** server using the **Streamable HTTP** transport, designed to connect **LM Studio** to your **Node.js servo drive APIs**. It implements session management (initialize → SSE → tools) per the MCP spec and SDK.

## Features
- Streamable HTTP endpoint (`/mcp`) supporting **POST (JSON)**, **GET (SSE)**, **DELETE (session end)**. \[Spec\] \[SDK\]
- Stateful session management via `Mcp-Session-Id` header. \[Spec\] \[SDK\]
- Tools for servo control + a **`ping`** tool for instant verification.
- Fetch helper that **extracts JSON from HTML `<pre>`** responses (some device APIs wrap JSON in HTML).

**References**:
- LM Studio Docs — *Use MCP Servers* (remote `url`, session flow): https://lmstudio.ai/docs/app/mcp
- MCP TypeScript SDK — Streamable HTTP server patterns & examples: https://www.npmjs.com/package/@modelcontextprotocol/sdk
- MCP Spec — Streamable HTTP transport (single endpoint, Accept headers, sessions): https://modelcontextprotocol.io/specification/2025-03-26/basic/transports

## Quick Start
```bash
npm install
cp .env.example .env
# edit .env as needed (API_BASE_URL, PORT)

# Development (HTTP transport)
npm run dev:http
# → Servo MCP Bridge (HTTP) at http://localhost:3000/mcp
```

## LM Studio configuration
Open LM Studio → **Program** → **Install → Edit mcp.json** and add:
```json
{
  "mcpServers": {
    "servo-mcp-bridge": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```
LM Studio (MCP host) will perform `initialize` (POST) → SSE (GET) → `tools/list` (POST) automatically. \[LM Studio Docs\]

## Sanity checks (optional, Windows PowerShell)
```powershell
# 1) Initialize
$body = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"clientInfo":{"name":"curl","version":"1.0"}}}'
curl.exe -i -H "Accept: application/json, text/event-stream" -H "Content-Type: application/json" -X POST "http://localhost:3000/mcp" --data-binary $body

# 2) SSE stream (use the mcp-session-id from initialize)
curl.exe -i -H "Accept: text/event-stream" -H "Mcp-Session-Id: <SID>" "http://localhost:3000/mcp"

# 3) List tools
curl.exe -i -H "Accept: application/json, text/event-stream" -H "Content-Type: application/json" -H "Mcp-Session-Id: <SID>" -X POST "http://localhost:3000/mcp" --data-binary "{"jsonrpc":"2.0","id":2,"method":"tools/list"}"
```
The Accept headers and session reuse are required by the **Streamable HTTP** transport. \[Spec\]

## Troubleshooting “Loading tools”
- Ensure the server logs show: `POST initialize` → `GET (SSE)` → `POST tools/list` for the **same session ID**. \[Spec\]
- Confirm tools are registered **before** any `server.connect(transport)` call (see `src/server.ts`). \[SDK\]
- If SSE/WebSocket closes (corporate VPN/AV), switch to **stdio** transport in `mcp.json`:
```json
{
  "mcpServers": {
    "servo-mcp-bridge-stdio": {
      "command": "node",
      "args": ["C:/absolute/path/to/dist/server-stdio.js"]
    }
  }
}
```
LM Studio supports both remote HTTP and local stdio. \[LM Studio Docs\]
