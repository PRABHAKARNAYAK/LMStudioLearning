
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ServoDevice, MoveCommand, JogCommand, Trajectory, ParamKV, Status, Diagnostics, PingResult } from "./types.js";
import { callApi } from "./httpUtil.js";

export function createServer() {
  const server = new McpServer(
    { name: "servo-mcp-bridge", version: "1.0.0", websiteUrl: "https://example.com/servo-mcp-bridge" },
    { capabilities: { logging: {} } }
  );

  // Quick ping tool to prove tools show instantly
  server.registerTool(
    "ping",
    {
      title: "Ping",
      description: "Quick readiness check",
      inputSchema: {},
      outputSchema: { ok: z.literal(true), now: z.string() }
    },
    async () => {
      const now = new Date().toISOString();
      const output: PingResult = { ok: true, now };
      return { content: [{ type: "text", text: `OK ${now}` }], structuredContent: output };
    }
  );

  server.registerTool(
    "scanDevices",
    {
      title: "Scan for servo devices",
      description: "Discover connected servo drives",
      inputSchema: {},
      outputSchema: { devices: z.array(ServoDevice) }
    },
    async () => {
      const { data } = await callApi<{ devices: unknown }>("/api/servo/scan");
      const devices = z.object({ devices: z.array(ServoDevice) }).parse(data);
      return { content: [{ type: "text", text: JSON.stringify(devices, null, 2) }], structuredContent: devices };
    }
  );

  server.registerTool(
    "getStatus",
    {
      title: "Get servo status",
      description: "Get status for a servo drive by ID",
      inputSchema: { id: z.string() },
      outputSchema: Status.shape
    },
    async ({ id }) => {
      const { data } = await callApi<unknown>(`/api/servo/${encodeURIComponent(id)}/status`);
      const status = Status.parse(data);
      return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }], structuredContent: status };
    }
  );

  server.registerTool(
    "home",
    {
      title: "Home servo",
      description: "Execute homing sequence",
      inputSchema: { id: z.string() },
      outputSchema: { result: z.string() }
    },
    async ({ id }) => {
      const { data } = await callApi<{ result: string }>(`/api/servo/${encodeURIComponent(id)}/home`, { method: "POST" });
      return { content: [{ type: "text", text: data.result }], structuredContent: data };
    }
  );

  server.registerTool(
    "moveToPosition",
    {
      title: "Move to position",
      description: "Move servo to an absolute position",
      inputSchema: { id: z.string(), command: MoveCommand },
      outputSchema: { acknowledged: z.boolean(), jobId: z.string().optional() }
    },
    async ({ id, command }) => {
      const { data } = await callApi<{ acknowledged: boolean; jobId?: string }>(`/api/servo/${encodeURIComponent(id)}/move`, {
        method: "POST",
        body: JSON.stringify(command)
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data };
    }
  );

  server.registerTool(
    "jog",
    {
      title: "Jog servo",
      description: "Jog in positive/negative direction for a duration",
      inputSchema: { id: z.string(), command: JogCommand },
      outputSchema: { acknowledged: z.boolean() }
    },
    async ({ id, command }) => {
      const { data } = await callApi<{ acknowledged: boolean }>(`/api/servo/${encodeURIComponent(id)}/jog`, {
        method: "POST",
        body: JSON.stringify(command)
      });
      return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
    }
  );

  server.registerTool(
    "stop",
    {
      title: "Stop motion",
      description: "Emergency stop / controlled stop",
      inputSchema: { id: z.string(), immediate: z.boolean().optional() },
      outputSchema: { acknowledged: z.boolean() }
    },
    async ({ id, immediate }) => {
      const { data } = await callApi<{ acknowledged: boolean }>(`/api/servo/${encodeURIComponent(id)}/stop`, {
        method: "POST",
        body: JSON.stringify({ immediate: !!immediate })
      });
      return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
    }
  );

  server.registerTool(
    "setParam",
    {
      title: "Set parameter",
      description: "Set a named parameter on the servo",
      inputSchema: { id: z.string(), param: ParamKV },
      outputSchema: { acknowledged: z.boolean() }
    },
    async ({ id, param }) => {
      const { data } = await callApi<{ acknowledged: boolean }>(`/api/servo/${encodeURIComponent(id)}/param`, {
        method: "POST",
        body: JSON.stringify(param)
      });
      return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
    }
  );

  server.registerTool(
    "getDiagnostics",
    {
      title: "Get diagnostics",
      description: "Retrieve servo diagnostics",
      inputSchema: { id: z.string() },
      outputSchema: Diagnostics.shape
    },
    async ({ id }) => {
      const { data } = await callApi<unknown>(`/api/servo/${encodeURIComponent(id)}/diagnostics`);
      const diag = Diagnostics.parse(data);
      return { content: [{ type: "text", text: JSON.stringify(diag, null, 2) }], structuredContent: diag };
    }
  );

  server.registerTool(
    "executeTrajectory",
    {
      title: "Execute trajectory",
      description: "Run a time‑parameterized trajectory",
      inputSchema: { id: z.string(), traj: Trajectory },
      outputSchema: { acknowledged: z.boolean(), jobId: z.string().optional() }
    },
    async ({ id, traj }) => {
      const { data } = await callApi<{ acknowledged: boolean; jobId?: string }>(`/api/servo/${encodeURIComponent(id)}/trajectory`, {
        method: "POST",
        body: JSON.stringify(traj)
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data };
    }
  );

  console.error("[MCP] Tools registered: ping, scanDevices, getStatus, home, moveToPosition, jog, stop, setParam, getDiagnostics, executeTrajectory");
  return server;
}
