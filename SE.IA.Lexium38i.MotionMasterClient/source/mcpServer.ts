import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { LexiumLogger } from "./services/LexiumLogger";
import { MotionMasterClientFunctions } from "./controllers/MotionMasterClientFunctions";

// Helper function to poll for device discovery status
async function pollDiscoveryStatus(baseUrl: string, timeoutMs: number, pollInterval: number): Promise<{ discoveredDevices: any[]; elapsed: number }> {
  const startTime = Date.now();
  let pollCount = 0;

  while (Date.now() - startTime < timeoutMs) {
    pollCount++;
    try {
      const elapsedSoFar = Math.round((Date.now() - startTime) / 1000);
      console.log(`[MCP] Poll #${pollCount} at ${elapsedSoFar}s - querying discovery status...`);

      const status = await callApi(`${baseUrl}/startMaster/devices/discoveryStatus`, {
        method: "GET",
      });

      console.log(
        `[MCP] Poll #${pollCount} response:`,
        JSON.stringify({
          isRunning: status?.isRunning,
          isServerRunning: status?.isServerRunning,
          deviceCount: status?.discoveredDevices?.length || 0,
          hasDevices: (status?.discoveredDevices?.length || 0) > 0,
        })
      );

      // Check the API response for devices (fresh discovery results from this session)
      const devicesFromResponse = status?.discoveredDevices || [];

      console.log(`[MCP] Poll #${pollCount}: Found ${devicesFromResponse.length} devices in response`);

      // Use devices from the fresh API response (previously discovered devices are cleared at discovery start)
      if (devicesFromResponse && Array.isArray(devicesFromResponse) && devicesFromResponse.length > 0) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        LexiumLogger.info(`[MCP] Discovery found ${devicesFromResponse.length} devices after ${pollCount} polls in ${elapsed}s`);
        console.log(`[MCP] Discovery SUCCESS: Found ${devicesFromResponse.length} devices after ${elapsed}s (${pollCount} polls)`);
        return { discoveredDevices: devicesFromResponse, elapsed };
      }
    } catch (e) {
      LexiumLogger.warn(`[MCP] Poll #${pollCount} failed: ${e instanceof Error ? e.message : "Unknown error"}`);
      console.log(`[MCP] Poll #${pollCount} error:`, e instanceof Error ? e.message : e);
    }

    await new Promise((r) => setTimeout(r, pollInterval));
  }

  // Final check: if we timed out, get devices from instance (which were cleared at start, so only new devices are present)
  const mmcInstance = MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance();
  const finalDevices = mmcInstance.previouslyDiscoveredDevices || [];
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`[MCP] Polling TIMEOUT after ${elapsed}s (${pollCount} polls): Final device count = ${finalDevices.length}`);
  LexiumLogger.warn(`[MCP] Discovery polling timed out after ${elapsed}s with ${finalDevices.length} devices found`);
  return { discoveredDevices: finalDevices, elapsed };
}

export function createMcpServer(baseUrl: string = "http://localhost:8036") {
  const server = new McpServer(
    {
      name: "motion-master-client-mcp",
      version: "1.0.0",
    },
    {
      capabilities: { logging: {} },
    }
  );

  let pmConfigRouteBaseUrl = `${baseUrl}/parameterConfig`;

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
    "startDeviceDiscovery",
    {
      description: "Start device discovery on the network and monitor progress via polling",
      inputSchema: z.object({
        macAddress: z.string(),
        timeoutSeconds: z.number().optional().default(300),
        pollIntervalMs: z.number().optional().default(3000),
      }),
    },
    async (args) => {
      try {
        LexiumLogger.info(`[MCP] Starting device discovery for MAC: ${args.macAddress}`);

        // Initiate discovery via HTTP API
        console.log(`[MCP] Calling POST ${baseUrl}/startMaster/discoverDevices/${args.macAddress}`);
        await callApi(`${baseUrl}/startMaster/discoverDevices/${encodeURIComponent(args.macAddress)}`, {
          method: "POST",
        });

        console.log(`[MCP] Device discovery initiated, waiting for backend to populate devices...`);

        // Give the discovery process a moment to initialize and start populating devices
        await new Promise((r) => setTimeout(r, 2000));

        // Poll status until devices are discovered or timeout
        // Use shorter default timeouts for quick response
        const timeoutSeconds = args.timeoutSeconds || 60; // Default to 60 seconds
        const pollIntervalMs = args.pollIntervalMs || 1500; // Poll every 1.5 seconds
        const timeoutMs = timeoutSeconds * 1000;

        console.log(`[MCP] Starting polling (timeout: ${timeoutSeconds}s, interval: ${pollIntervalMs}ms)`);
        const { discoveredDevices, elapsed } = await pollDiscoveryStatus(baseUrl, timeoutMs, pollIntervalMs);

        console.log(`[MCP] Device discovery completed in ${elapsed}s, found ${discoveredDevices.length} devices`);

        // Create a simplified response with essential data only
        const simplifiedDevices = discoveredDevices.map((device: any) => ({
          id: device.id,
          deviceAddress: device.deviceAddress,
          type: device.type,
          position: device.position,
          status: device.status,
          macAddress: device.hardwareDescription?.device?.macAddress,
          name: device.hardwareDescription?.device?.name,
          serialNumber: device.hardwareDescription?.device?.serialNumber,
        }));

        // Create a clean, simple text response for LM Studio
        let responseText = `✓ Device Discovery Successful\n\n`;
        responseText += `Status: SUCCESS\n`;
        responseText += `MAC Address: ${args.macAddress}\n`;
        responseText += `Devices Found: ${discoveredDevices.length}\n`;
        responseText += `Time Elapsed: ${elapsed} seconds\n\n`;

        if (discoveredDevices.length > 0) {
          responseText += `DEVICES:\n`;
          simplifiedDevices.forEach((device: any, index: number) => {
            responseText += `\n${index + 1}. ${device.name || "Unknown Device"}\n`;
            responseText += `   Serial: ${device.serialNumber}\n`;
            responseText += `   MAC: ${device.macAddress}\n`;
            responseText += `   Status: ${device.status}\n`;
          });
        }

        return {
          content: [
            {
              type: "text",
              text: responseText,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        LexiumLogger.error(`[MCP] Device discovery error: ${errorMessage}`);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "error",
                  macAddress: args.macAddress,
                  message: errorMessage,
                },
                null,
                2
              ),
            },
          ],
        };
      }
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
      const result = await callApi(`${pmConfigRouteBaseUrl}/devices/${encodeURIComponent(args.deviceRef)}/groupInfo/${encodeURIComponent(args.groupId)}`, { method: "GET" });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "startHoming",
    {
      description: "Execute a homing sequence to establish the home position reference point on the device. Required before position-based operations.",
      inputSchema: z.object({
        deviceRef: z.string().describe("The device reference/ID"),
      }),
    },
    async (args) => {
      const result = await callApi(`${pmConfigRouteBaseUrl}/devices/${encodeURIComponent(args.deviceRef)}/startHoming`, { method: "POST" });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "startPositionProfile",
    {
      description:
        "Execute a POSITION PROFILE on the servo device to move to a specific target position with controlled acceleration and deceleration. Use this when you need to command the device to move to a specific location.",
      inputSchema: z.object({
        deviceRef: z.string().describe("The device reference/ID"),
        target: z.number().describe("Target position in counts or units (0x607A:00)"),
        acceleration: z.number().describe("Profile acceleration in units/s² (0x6083:00)"),
        deceleration: z.number().describe("Profile deceleration in units/s² (0x6084:00)"),
        relative: z.boolean().optional().describe("If true, target is relative to current position; if false, use as absolute position"),
        holdingDuration: z.number().optional().describe("Delay in milliseconds before quick stop after reaching target"),
        skipQuickStop: z.boolean().optional().describe("Skip quick stop request after reaching target"),
        targetReachTimeout: z.number().optional().describe("Timeout in milliseconds to wait for target reached"),
        window: z.number().optional().describe("Position window (0x6067:00)"),
        windowTime: z.number().optional().describe("Position window time (0x6068:00)"),
      }),
    },
    async (args) => {
      const positionConfig = {
        target: args.target,
        acceleration: args.acceleration,
        deceleration: args.deceleration,
        ...(args.relative !== undefined && { relative: args.relative }),
        ...(args.holdingDuration !== undefined && { holdingDuration: args.holdingDuration }),
        ...(args.skipQuickStop !== undefined && { skipQuickStop: args.skipQuickStop }),
        ...(args.targetReachTimeout !== undefined && { targetReachTimeout: args.targetReachTimeout }),
        ...(args.window !== undefined && { window: args.window }),
        ...(args.windowTime !== undefined && { windowTime: args.windowTime }),
      };
      const result = await callApi(`${pmConfigRouteBaseUrl}/devices/${encodeURIComponent(args.deviceRef)}/startPositionProfile`, {
        method: "POST",
        body: JSON.stringify(positionConfig),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "startVelocityProfile",
    {
      description:
        "Execute a VELOCITY PROFILE on the servo device to move at a specific target speed/velocity with controlled acceleration and deceleration ramps. Use this when you need to control the device speed.",
      inputSchema: z.object({
        deviceRef: z.string().describe("The device reference/ID"),
        target: z.number().describe("Target velocity in RPM or counts/s (0x60FF:00)"),
        acceleration: z.number().describe("Profile acceleration ramp in units/s² (0x6083:00)"),
        deceleration: z.number().describe("Profile deceleration ramp in units/s² (0x6084:00)"),
        holdingDuration: z.number().optional().describe("Delay in milliseconds before quick stop after reaching target"),
        skipQuickStop: z.boolean().optional().describe("Skip quick stop request after reaching target"),
        targetReachTimeout: z.number().optional().describe("Timeout in milliseconds to wait for target velocity reached"),
        window: z.number().optional().describe("Velocity window tolerance (0x606D:00)"),
        windowTime: z.number().optional().describe("Velocity window time (0x606E:00)"),
      }),
    },
    async (args) => {
      const velocityConfig = {
        target: args.target,
        acceleration: args.acceleration,
        deceleration: args.deceleration,
        ...(args.holdingDuration !== undefined && { holdingDuration: args.holdingDuration }),
        ...(args.skipQuickStop !== undefined && { skipQuickStop: args.skipQuickStop }),
        ...(args.targetReachTimeout !== undefined && { targetReachTimeout: args.targetReachTimeout }),
        ...(args.window !== undefined && { window: args.window }),
        ...(args.windowTime !== undefined && { windowTime: args.windowTime }),
      };
      const result = await callApi(`${pmConfigRouteBaseUrl}/devices/${encodeURIComponent(args.deviceRef)}/startVelocityProfile`, {
        method: "POST",
        body: JSON.stringify(velocityConfig),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "startTorqueProfile",
    {
      description:
        "Execute a TORQUE PROFILE on the servo device to apply a specific target torque/force with controlled ramp slope. Use this when you need to control the force or torque applied by the device.",
      inputSchema: z.object({
        deviceRef: z.string().describe("The device reference/ID"),
        target: z.number().describe("Target torque/force in mNm (0x6071:00)"),
        slope: z.number().describe("Torque ramp slope in mNm/s (0x6087:00)"),
        holdingDuration: z.number().optional().describe("Delay in milliseconds before quick stop after reaching target"),
        skipQuickStop: z.boolean().optional().describe("Skip quick stop request after reaching target"),
        targetReachTimeout: z.number().optional().describe("Timeout in milliseconds to wait for target torque reached"),
        window: z.number().optional().describe("Torque window tolerance (0x2014:01)"),
        windowTime: z.number().optional().describe("Torque window time (0x2014:02)"),
      }),
    },
    async (args) => {
      const torqueConfig = {
        target: args.target,
        slope: args.slope,
        ...(args.holdingDuration !== undefined && { holdingDuration: args.holdingDuration }),
        ...(args.skipQuickStop !== undefined && { skipQuickStop: args.skipQuickStop }),
        ...(args.targetReachTimeout !== undefined && { targetReachTimeout: args.targetReachTimeout }),
        ...(args.window !== undefined && { window: args.window }),
        ...(args.windowTime !== undefined && { windowTime: args.windowTime }),
      };
      const result = await callApi(`${pmConfigRouteBaseUrl}/devices/${encodeURIComponent(args.deviceRef)}/startTorqueProfile`, {
        method: "POST",
        body: JSON.stringify(torqueConfig),
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
      const result = await callApi(`${pmConfigRouteBaseUrl}/api/devices/${encodeURIComponent(args.deviceRef)}/releaseControl`, { method: "POST" });
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
      const result = await callApi(`${pmConfigRouteBaseUrl}/devices/${encodeURIComponent(args.deviceRef)}/resetFault/`, { method: "GET" });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "getCia402State",
    {
      description: "Retrieve the current CIA 402 state machine status of a device (e.g., not ready to switch on, ready to switch on, switched on, operation enabled, etc.)",
      inputSchema: z.object({
        deviceRef: z.string().describe("The device reference/ID"),
      }),
    },
    async (args) => {
      const result = await callApi(`${pmConfigRouteBaseUrl}/api/devices/${encodeURIComponent(args.deviceRef)}/getCia402StateOfDevice`, { method: "GET" });
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
      const result = await callApi(`${pmConfigRouteBaseUrl}/devices/${encodeURIComponent(args.deviceRef)}/startSystemIdentification`, { method: "GET" });
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
      const result = await callApi(`${pmConfigRouteBaseUrl}/devices/${encodeURIComponent(args.deviceRef)}/getSystemIdentificationData`, { method: "GET" });
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
      const result = await callApi(`${pmConfigRouteBaseUrl}/devices/${encodeURIComponent(args.deviceRef)}/getPositionTuningInfo`, { method: "GET" });
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
      const result = await callApi(`${pmConfigRouteBaseUrl}/devices/${encodeURIComponent(args.deviceRef)}/startPositionAutoTuning/${encodeURIComponent(args.controllerType)}`, {
        method: "GET",
      });
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
      const result = await callApi(`${pmConfigRouteBaseUrl}/devices/${encodeURIComponent(args.deviceRef)}/getVelocityTuningInfo`, { method: "GET" });
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
      const result = await callApi(`${pmConfigRouteBaseUrl}/devices/${encodeURIComponent(args.deviceRef)}/startVelocityAutoTuning/`, { method: "GET" });
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
      const result = await callApi(`${pmConfigRouteBaseUrl}/devices/${encodeURIComponent(args.deviceRef)}/getTorqueTuningInfo`, { method: "GET" });
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
      const result = await callApi(`${pmConfigRouteBaseUrl}/devices/${encodeURIComponent(args.deviceRef)}/computePositionGains`, {
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
      const result = await callApi(`${pmConfigRouteBaseUrl}/devices/${encodeURIComponent(args.deviceRef)}/computeVelocityGains`, {
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
      const result = await callApi(
        `${pmConfigRouteBaseUrl}/devices/${encodeURIComponent(args.deviceRef)}/getTuningTrajectoryInfo/profileType/${encodeURIComponent(args.profileType)}`,
        { method: "GET" }
      );
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
      const result = await callApi(`${pmConfigRouteBaseUrl}/devices/${encodeURIComponent(args.deviceRef)}/startSignalGenerator`, {
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
      const result = await callApi(`${pmConfigRouteBaseUrl}/devices/${encodeURIComponent(args.deviceRef)}/stopSignalGenerator`, { method: "POST" });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "quickStop",
    {
      description: "Send a quick stop command to a device",
      inputSchema: z.object({
        deviceRef: z.string().describe("The device reference identifier"),
      }),
    },
    async (args) => {
      try {
        const result = await callApi(`${baseUrl}/motionMasterClient/api/devices/${encodeURIComponent(args.deviceRef)}/quick-stop`, { method: "GET" });
        LexiumLogger.info(`[MCP] Quick stop executed for device ${args.deviceRef}: ${JSON.stringify(result)}`);

        // Create a clear text response for LM Studio
        let responseText = `✓ Quick Stop Successful\n\n`;
        responseText += `Status: SUCCESS\n`;
        responseText += `Device: ${args.deviceRef}\n`;
        responseText += `Action: Quick stop command sent and acknowledged\n`;

        return {
          content: [{ type: "text", text: responseText }],
          structuredContent: {
            success: true,
            message: "Quick stop command executed successfully",
            device: args.deviceRef,
            timestamp: new Date().toISOString(),
          },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const responseText = `✗ Quick Stop Failed\n\nDevice: ${args.deviceRef}\nError: ${errorMessage}`;

        return {
          content: [{ type: "text", text: responseText }],
          structuredContent: {
            success: false,
            message: "Failed to execute quick stop command",
            device: args.deviceRef,
            error: errorMessage,
            timestamp: new Date().toISOString(),
          },
        };
      }
    }
  );

  LexiumLogger.info(`[MCP] Motion Master Client MCP Server initialized with 29 tools`);
  console.log(`[MCP] Server initialization complete. Total tools registered: 29`);
  return server;
}

async function callApi(url: string, options?: RequestInit): Promise<any> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  // Check if response is successful
  if (!response.ok) {
    const contentType = response.headers.get("content-type");
    let errorBody: string;

    // Try to parse error response as JSON if it's JSON, otherwise use text
    if (contentType?.includes("application/json")) {
      try {
        const json = await response.json();
        errorBody = JSON.stringify(json);
      } catch {
        errorBody = await response.text();
      }
    } else {
      errorBody = await response.text();
    }

    throw new Error(`API call failed: ${errorBody}`);
  }

  console.log(`[MCP] API call successful: ${url}, response: ${await response.clone().json()} `);

  return await response.json();
}
