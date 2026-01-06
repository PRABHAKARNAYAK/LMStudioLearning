import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { LexiumLogger } from "./services/LexiumLogger";

export function createMcpServer(baseUrl: string = "http://localhost:8036") {
  const server = new McpServer({
    name: "motion-master-client-mcp",
    version: "1.0.0",
  });

  // Register each tool with the server
  server.registerTool(
    "ping",
    {
      description: "Health check for the Motion Master MCP Server",
      inputSchema: z.object({}),
    },
    async () => {
      const result = { ok: true, timestamp: new Date().toISOString() };
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "getGroupInfo",
    {
      description: "Retrieve group information and parameters for a device",
      inputSchema: z.object({
        deviceRef: z.string(),
        groupId: z.string(),
      }),
    },
    async (args) => {
      const result = await callApi(`${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/groupInfo/${encodeURIComponent(args.groupId)}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "getControlPanelInfo",
    {
      description: "Retrieve control panel information and current status",
      inputSchema: z.object({
        deviceRef: z.string(),
      }),
    },
    async (args) => {
      const result = await callApi(`${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/controlPanelInfo`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "getDefaultParameterInfo",
    {
      description: "Retrieve default parameter information for a device",
      inputSchema: z.object({
        deviceRef: z.string(),
      }),
    },
    async (args) => {
      const result = await callApi(`${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/getDefaultParameterInfo`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "startHoming",
    {
      description: "Execute homing sequence for a servo device",
      inputSchema: z.object({
        deviceRef: z.string(),
      }),
    },
    async (args) => {
      const result = await callApi(`${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/startHoming`, { method: "POST" });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "startPositionProfile",
    {
      description: "Execute a position profile on the servo device",
      inputSchema: z.object({
        deviceRef: z.string(),
        parameters: z.record(z.any()).optional(),
      }),
    },
    async (args) => {
      const result = await callApi(`${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/startPositionProfile`, {
        method: "POST",
        body: JSON.stringify(args.parameters || {}),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "startVelocityProfile",
    {
      description: "Execute a velocity profile on the servo device",
      inputSchema: z.object({
        deviceRef: z.string(),
        parameters: z.record(z.any()).optional(),
      }),
    },
    async (args) => {
      const result = await callApi(`${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/startVelocityProfile`, {
        method: "POST",
        body: JSON.stringify(args.parameters || {}),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "startTorqueProfile",
    {
      description: "Execute a torque profile on the servo device",
      inputSchema: z.object({
        deviceRef: z.string(),
        parameters: z.record(z.any()).optional(),
      }),
    },
    async (args) => {
      const result = await callApi(`${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/startTorqueProfile`, {
        method: "POST",
        body: JSON.stringify(args.parameters || {}),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "releaseControl",
    {
      description: "Release control of the device",
      inputSchema: z.object({
        deviceRef: z.string(),
      }),
    },
    async (args) => {
      const result = await callApi(`${baseUrl}/api/devices/${encodeURIComponent(args.deviceRef)}/releaseControl`, { method: "POST" });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "startDiagnostics",
    {
      description: "Start diagnostic data collection for a device",
      inputSchema: z.object({
        deviceRef: z.string(),
      }),
    },
    async (args) => {
      const result = await callApi(`${baseUrl}/api/startDiagnostics/${encodeURIComponent(args.deviceRef)}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "resetFault",
    {
      description: "Reset fault status on a device",
      inputSchema: z.object({
        deviceRef: z.string(),
      }),
    },
    async (args) => {
      const result = await callApi(`${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/resetFault/`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "getDiagnosticStatus",
    {
      description: "Retrieve current diagnostic status for a device",
      inputSchema: z.object({}),
    },
    async () => {
      const result = await callApi(`${baseUrl}/api/getDeviceDiagnosticStatus`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "getErrorAndWarningData",
    {
      description: "Retrieve error and warning data for devices",
      inputSchema: z.object({}),
    },
    async () => {
      const result = await callApi(`${baseUrl}/api/getErrorAndWarningData`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "getCia402State",
    {
      description: "Retrieve CIA 402 state of a device",
      inputSchema: z.object({}),
    },
    async () => {
      const result = await callApi(`${baseUrl}/api/getCia402StateOfDevice`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "startSystemIdentification",
    {
      description: "Execute system identification procedure",
      inputSchema: z.object({
        deviceRef: z.string(),
      }),
    },
    async (args) => {
      const result = await callApi(`${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/startSystemIdentification`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "getSystemIdentificationData",
    {
      description: "Retrieve system identification results",
      inputSchema: z.object({
        deviceRef: z.string(),
      }),
    },
    async (args) => {
      const result = await callApi(`${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/getSystemIdentificationData`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "getPositionTuningInfo",
    {
      description: "Retrieve position tuning parameters and status",
      inputSchema: z.object({
        deviceRef: z.string(),
      }),
    },
    async (args) => {
      const result = await callApi(`${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/getPositionTuningInfo`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "startPositionAutoTuning",
    {
      description: "Execute automatic position tuning",
      inputSchema: z.object({
        deviceRef: z.string(),
        controllerType: z.string(),
      }),
    },
    async (args) => {
      const result = await callApi(`${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/startPositionAutoTuning/${encodeURIComponent(args.controllerType)}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "getVelocityTuningInfo",
    {
      description: "Retrieve velocity tuning parameters and status",
      inputSchema: z.object({
        deviceRef: z.string(),
      }),
    },
    async (args) => {
      const result = await callApi(`${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/getVelocityTuningInfo`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "startVelocityAutoTuning",
    {
      description: "Execute automatic velocity tuning",
      inputSchema: z.object({
        deviceRef: z.string(),
      }),
    },
    async (args) => {
      const result = await callApi(`${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/startVelocityAutoTuning/`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "getTorqueTuningInfo",
    {
      description: "Retrieve torque tuning parameters and status",
      inputSchema: z.object({
        deviceRef: z.string(),
      }),
    },
    async (args) => {
      const result = await callApi(`${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/getTorqueTuningInfo`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "computePositionGains",
    {
      description: "Compute position tuning gains",
      inputSchema: z.object({
        deviceRef: z.string(),
        parameters: z.record(z.any()).optional(),
      }),
    },
    async (args) => {
      const result = await callApi(`${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/computePositionGains`, {
        method: "POST",
        body: JSON.stringify(args.parameters || {}),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "computeVelocityGains",
    {
      description: "Compute velocity tuning gains",
      inputSchema: z.object({
        deviceRef: z.string(),
        parameters: z.record(z.any()).optional(),
      }),
    },
    async (args) => {
      const result = await callApi(`${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/computeVelocityGains`, {
        method: "POST",
        body: JSON.stringify(args.parameters || {}),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "getTuningTrajectoryInfo",
    {
      description: "Retrieve tuning trajectory information",
      inputSchema: z.object({
        deviceRef: z.string(),
        profileType: z.enum(["position", "velocity", "torque"]),
      }),
    },
    async (args) => {
      const result = await callApi(`${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/getTuningTrajectoryInfo/profileType/${encodeURIComponent(args.profileType)}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "startSignalGenerator",
    {
      description: "Start signal generation for tuning",
      inputSchema: z.object({
        deviceRef: z.string(),
        config: z.record(z.any()).optional(),
      }),
    },
    async (args) => {
      const result = await callApi(`${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/startSignalGenerator`, {
        method: "POST",
        body: JSON.stringify(args.config || {}),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "stopSignalGenerator",
    {
      description: "Stop signal generation",
      inputSchema: z.object({
        deviceRef: z.string(),
      }),
    },
    async (args) => {
      const result = await callApi(`${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/stopSignalGenerator`, { method: "POST" });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "startDeviceDiscovery",
    {
      description: "Start device discovery on the network for a specified MAC address",
      inputSchema: z.object({
        macAddress: z.string(),
      }),
    },
    async (args) => {
      const result = await callApi(`${baseUrl}/startMaster/discoverDevices/${encodeURIComponent(args.macAddress)}`, { method: "POST" });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  LexiumLogger.info("[MCP] Motion Master Client MCP Server initialized");
  return server;
}

async function callApi(url: string, options?: RequestInit): Promise<any> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  return await response.json();
}
