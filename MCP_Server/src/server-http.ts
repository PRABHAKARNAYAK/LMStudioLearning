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
  res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

const mcpServer = createServer();
const sessions = new Map<string, StreamableHTTPServerTransport>();

// Main MCP endpoint
app.all("/mcp", async (req, res) => {
  // Patch res.send and res.end to log response bodies
  const originalSend = res.send.bind(res);
  res.send = function (body) {
    console.log("[MCP /mcp] res.send called with:", body);
    return originalSend(body);
  };
  const originalEnd = res.end.bind(res);
  res.end = function (...args: any[]) {
    if (args.length > 0 && args[0] !== undefined) {
      console.log("[MCP /mcp] res.end called with:", args[0]);
    }
    // @ts-ignore
    return originalEnd(...args);
  };
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  // Debug: log incoming request and session
  const logPrefix = `[MCP /mcp]`;
  console.log(`${logPrefix} Incoming request`, {
    method: req.method,
    headers: req.headers,
    body: req.body,
    sessionId,
  });

  // Capture response headers before sending
  const originalSetHeader = res.setHeader.bind(res);
  res.setHeader = function (name, value) {
    console.log(`${logPrefix} Response header set:`, name, value);
    return originalSetHeader(name, value);
  };

  try {
    let transport = sessionId ? sessions.get(sessionId) : undefined;

    // Create new session on initialize
    if (!transport && req.method === "POST" && req.body?.method === "initialize") {
      transport = new StreamableHTTPServerTransport({
        enableJsonResponse: true,
        sessionIdGenerator: () => randomUUID(),
      });

      await mcpServer.connect(transport);
      res.setHeader("Content-Type", "application/json");
      // Always set mcp-session-id header if available
      if (transport.sessionId) {
        res.setHeader("mcp-session-id", transport.sessionId);
      }

      // Capture the response body by monkey-patching res.json
      const originalJson = res.json.bind(res);
      res.json = function (body) {
        console.log("[MCP /mcp] Sending response body (initialize):", body);
        return originalJson(body);
      };

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
        res.setHeader("Content-Type", "application/json");
        await transport.handleRequest(req, res, undefined);
        transport.close();
        sessions.delete(sessionId!);
        console.log(`Session closed: ${sessionId}`);
      } else if (req.method === "GET") {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        await transport.handleRequest(req, res, undefined);
      } else {
        res.setHeader("Content-Type", "application/json");
        await transport.handleRequest(req, res, req.body);
      }
      return;
    }

    res.setHeader("Content-Type", "application/json");
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
