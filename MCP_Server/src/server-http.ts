import "dotenv/config";
import express from "express";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";

const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);
const app = express();

// Enable CORS and JSON parsing
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

const mcpServer = createServer();
const sessions = new Map<string, StreamableHTTPServerTransport>();

// Main MCP endpoint
app.all("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  try {
    let transport = sessionId ? sessions.get(sessionId) : undefined;

    // Create new session on initialize
    if (!transport && req.method === "POST" && req.body?.method === "initialize") {
      transport = new StreamableHTTPServerTransport({
        enableJsonResponse: true,
        sessionIdGenerator: () => randomUUID(),
      });

      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);

      if (transport.sessionId) {
        sessions.set(transport.sessionId, transport);
        console.log(`Session created: ${transport.sessionId}`);
      }
      return;
    }

    // Handle existing session
    if (transport) {
      if (req.method === "DELETE") {
        await transport.handleRequest(req, res, undefined);
        transport.close();
        sessions.delete(sessionId!);
        console.log(`Session closed: ${sessionId}`);
      } else if (req.method === "GET") {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        await transport.handleRequest(req, res, undefined);
      } else {
        await transport.handleRequest(req, res, req.body);
      }
      return;
    }

    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Session not found" },
      id: null,
    });
  } catch (err) {
    console.error("Error:", err);
    if (!res.headersSent) res.status(500).end();
  }
});

app.listen(PORT, () => {
  console.log(`MCP Server running at http://localhost:${PORT}/mcp`);
});
