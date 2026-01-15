import axios from "axios";

interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

interface ToolCallResult {
  toolName: string;
  success: boolean;
  result: any;
  error?: string;
}

/**
 * MCPBridge service handles communication with the Motion Master MCP Server
 * and provides tool definitions and execution for LLM integration
 */
export class MCPBridge {
  private readonly mcpBaseUrl: string;
  private readonly tools: Map<string, McpTool> = new Map();
  private initialized: boolean = false;

  constructor(mcpBaseUrl: string = "http://localhost:8036") {
    this.mcpBaseUrl = mcpBaseUrl;
  }

  /**
   * Initialize the MCP bridge and fetch available tools
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log(`[MCPBridge] Initializing with base URL: ${this.mcpBaseUrl}`);

      // First, try to fetch tools from the MCP server via tools/list endpoint
      // If that fails, fall back to loading predefined tool definitions
      try {
        await this.fetchToolsFromMcpServer();
      } catch (error) {
        console.warn(`[MCPBridge] Failed to fetch tools from MCP server, using fallback definitions: ${error instanceof Error ? error.message : "Unknown error"}`);
        await this.loadToolDefinitions();
      }

      this.initialized = true;
      console.log(`[MCPBridge] Initialized with ${this.tools.size} tools`);
    } catch (error) {
      console.error("[MCPBridge] Failed to initialize:", error);
      throw error;
    }
  }

  /**
   * Fetch tool definitions from the MCP server
   * The MCP server's HTTP endpoint provides tool information via RPC calls
   */
  private async fetchToolsFromMcpServer(): Promise<void> {
    try {
      console.log("[MCPBridge] Attempting to fetch tools from MCP server...");

      // Initialize an MCP session to get tools list
      const initResponse = await axios.post(
        `${this.mcpBaseUrl}/mcp`,
        {
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "mcpBridge",
              version: "1.0.0",
            },
          },
          id: 1,
        },
        {
          timeout: 5000,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
          },
        }
      );

      const sessionId = (initResponse.data as any)?.result?.sessionId;
      if (!sessionId) {
        throw new Error("Failed to obtain session ID from MCP server");
      }

      console.log(`[MCPBridge] MCP session established: ${sessionId}`);

      // Now list tools using the session
      const toolsResponse = await axios.post(
        `${this.mcpBaseUrl}/mcp`,
        {
          jsonrpc: "2.0",
          method: "tools/list",
          params: {},
          id: 2,
        },
        {
          timeout: 5000,
          headers: {
            "Content-Type": "application/json",
            "mcp-session-id": sessionId,
            Accept: "application/json, text/event-stream",
          },
        }
      );

      const toolsData = (toolsResponse.data as any)?.result?.tools || [];
      console.log(`[MCPBridge] Fetched ${toolsData.length} tools from MCP server`);

      // Convert MCP tools to our internal format
      for (const tool of toolsData) {
        this.tools.set(tool.name, {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        });
      }

      if (this.tools.size === 0) {
        throw new Error("No tools returned from MCP server");
      }

      console.log(`[MCPBridge] Successfully loaded ${this.tools.size} tools from MCP server`);
    } catch (error) {
      console.error("[MCPBridge] Error fetching tools from MCP server:", error);
      throw error;
    }
  }

  /**
   * Load tool definitions from the MCP server
   * Since the MCP server is running, we can construct the tool definitions based on known tools
   */
  private async loadToolDefinitions(): Promise<void> {
    // Define all the tools registered in the MCP server
    // This matches the tools registered in mcpServer.ts
    const toolDefinitions: McpTool[] = [
      {
        name: "ping",
        description: "Health check for the Motion Master MCP Server",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "startDeviceDiscovery",
        description: "Start device discovery on the network and monitor progress via polling",
        inputSchema: {
          type: "object",
          properties: {
            macAddress: { type: "string", description: "MAC address to discover" },
            timeoutSeconds: { type: "number", description: "Timeout in seconds (optional, default 300)" },
            pollIntervalMs: { type: "number", description: "Poll interval in milliseconds (optional, default 3000)" },
          },
          required: ["macAddress"],
        },
      },
      {
        name: "getGroupInfo",
        description: "Retrieve group information and parameters for a device",
        inputSchema: {
          type: "object",
          properties: {
            deviceRef: { type: "string", description: "The device reference/ID" },
            groupId: { type: "string", description: "The group ID" },
          },
          required: ["deviceRef", "groupId"],
        },
      },
      {
        name: "startHoming",
        description: "Execute a homing sequence to establish the home position reference point on the device. Required before position-based operations.",
        inputSchema: {
          type: "object",
          properties: {
            deviceRef: { type: "string", description: "The device reference/ID" },
          },
          required: ["deviceRef"],
        },
      },
      {
        name: "startPositionProfile",
        description: "Execute a POSITION PROFILE on the servo device to move to a specific target position with controlled acceleration and deceleration",
        inputSchema: {
          type: "object",
          properties: {
            deviceRef: { type: "string", description: "The device reference/ID" },
            target: { type: "number", description: "Target position in counts or units" },
            acceleration: { type: "number", description: "Profile acceleration in units/s²" },
            deceleration: { type: "number", description: "Profile deceleration in units/s²" },
            relative: { type: "boolean", description: "If true, target is relative; if false, absolute" },
            holdingDuration: { type: "number", description: "Delay in milliseconds before quick stop" },
            skipQuickStop: { type: "boolean", description: "Skip quick stop request after reaching target" },
            targetReachTimeout: { type: "number", description: "Timeout in milliseconds to wait for target reached" },
            window: { type: "number", description: "Position window" },
            windowTime: { type: "number", description: "Position window time" },
          },
          required: ["deviceRef", "target", "acceleration", "deceleration"],
        },
      },
      {
        name: "startVelocityProfile",
        description: "Execute a VELOCITY PROFILE on the servo device to move at a specific target speed with controlled acceleration and deceleration ramps",
        inputSchema: {
          type: "object",
          properties: {
            deviceRef: { type: "string", description: "The device reference/ID" },
            target: { type: "number", description: "Target velocity in RPM or counts/s" },
            acceleration: { type: "number", description: "Profile acceleration ramp in units/s²" },
            deceleration: { type: "number", description: "Profile deceleration ramp in units/s²" },
            holdingDuration: { type: "number", description: "Delay in milliseconds before quick stop" },
            skipQuickStop: { type: "boolean", description: "Skip quick stop request after reaching target" },
            targetReachTimeout: { type: "number", description: "Timeout in milliseconds to wait for target velocity reached" },
            window: { type: "number", description: "Velocity window tolerance" },
            windowTime: { type: "number", description: "Velocity window time" },
          },
          required: ["deviceRef", "target", "acceleration", "deceleration"],
        },
      },
      {
        name: "startTorqueProfile",
        description: "Execute a TORQUE PROFILE on the servo device to apply a specific target torque/force with controlled ramp slope",
        inputSchema: {
          type: "object",
          properties: {
            deviceRef: { type: "string", description: "The device reference/ID" },
            target: { type: "number", description: "Target torque/force in mNm" },
            slope: { type: "number", description: "Torque ramp slope in mNm/s" },
            holdingDuration: { type: "number", description: "Delay in milliseconds before quick stop" },
            skipQuickStop: { type: "boolean", description: "Skip quick stop request after reaching target" },
            targetReachTimeout: { type: "number", description: "Timeout in milliseconds to wait for target torque reached" },
            window: { type: "number", description: "Torque window tolerance" },
            windowTime: { type: "number", description: "Torque window time" },
          },
          required: ["deviceRef", "target", "slope"],
        },
      },
      {
        name: "releaseControl",
        description: "Release control of the device",
        inputSchema: {
          type: "object",
          properties: {
            deviceRef: { type: "string", description: "The device reference/ID" },
          },
          required: ["deviceRef"],
        },
      },
      {
        name: "resetFault",
        description: "Reset fault status on a device",
        inputSchema: {
          type: "object",
          properties: {
            deviceRef: { type: "string", description: "The device reference/ID" },
          },
          required: ["deviceRef"],
        },
      },
      {
        name: "getCia402State",
        description: "Retrieve the current CIA 402 state machine status of a device (e.g., not ready to switch on, ready to switch on, switched on, operation enabled)",
        inputSchema: {
          type: "object",
          properties: {
            deviceRef: { type: "string", description: "The device reference/ID" },
          },
          required: ["deviceRef"],
        },
      },
      {
        name: "startSystemIdentification",
        description: "Execute system identification procedure",
        inputSchema: {
          type: "object",
          properties: {
            deviceRef: { type: "string", description: "The device reference/ID" },
          },
          required: ["deviceRef"],
        },
      },
      {
        name: "getSystemIdentificationData",
        description: "Retrieve system identification results",
        inputSchema: {
          type: "object",
          properties: {
            deviceRef: { type: "string", description: "The device reference/ID" },
          },
          required: ["deviceRef"],
        },
      },
      {
        name: "getPositionTuningInfo",
        description: "Retrieve position tuning parameters and status",
        inputSchema: {
          type: "object",
          properties: {
            deviceRef: { type: "string", description: "The device reference/ID" },
          },
          required: ["deviceRef"],
        },
      },
      {
        name: "startPositionAutoTuning",
        description: "Execute automatic position tuning",
        inputSchema: {
          type: "object",
          properties: {
            deviceRef: { type: "string", description: "The device reference/ID" },
            controllerType: { type: "string", description: "The controller type" },
          },
          required: ["deviceRef", "controllerType"],
        },
      },
      {
        name: "getVelocityTuningInfo",
        description: "Retrieve velocity tuning parameters and status",
        inputSchema: {
          type: "object",
          properties: {
            deviceRef: { type: "string", description: "The device reference/ID" },
          },
          required: ["deviceRef"],
        },
      },
      {
        name: "startVelocityAutoTuning",
        description: "Execute automatic velocity tuning",
        inputSchema: {
          type: "object",
          properties: {
            deviceRef: { type: "string", description: "The device reference/ID" },
          },
          required: ["deviceRef"],
        },
      },
      {
        name: "getTorqueTuningInfo",
        description: "Retrieve torque tuning parameters and status",
        inputSchema: {
          type: "object",
          properties: {
            deviceRef: { type: "string", description: "The device reference/ID" },
          },
          required: ["deviceRef"],
        },
      },
      {
        name: "computePositionGains",
        description: "Compute position tuning gains",
        inputSchema: {
          type: "object",
          properties: {
            deviceRef: { type: "string", description: "The device reference/ID" },
            parameters: { type: "object", description: "Optional parameters" },
          },
          required: ["deviceRef"],
        },
      },
      {
        name: "computeVelocityGains",
        description: "Compute velocity tuning gains",
        inputSchema: {
          type: "object",
          properties: {
            deviceRef: { type: "string", description: "The device reference/ID" },
            parameters: { type: "object", description: "Optional parameters" },
          },
          required: ["deviceRef"],
        },
      },
      {
        name: "getTuningTrajectoryInfo",
        description: "Retrieve tuning trajectory information",
        inputSchema: {
          type: "object",
          properties: {
            deviceRef: { type: "string", description: "The device reference/ID" },
            profileType: {
              type: "string",
              enum: ["position", "velocity", "torque"],
              description: "The profile type",
            },
          },
          required: ["deviceRef", "profileType"],
        },
      },
      {
        name: "startSignalGenerator",
        description: "Start signal generation for tuning",
        inputSchema: {
          type: "object",
          properties: {
            deviceRef: { type: "string", description: "The device reference/ID" },
            config: { type: "object", description: "Optional configuration" },
          },
          required: ["deviceRef"],
        },
      },
      {
        name: "stopSignalGenerator",
        description: "Stop signal generation",
        inputSchema: {
          type: "object",
          properties: {
            deviceRef: { type: "string", description: "The device reference/ID" },
          },
          required: ["deviceRef"],
        },
      },
      {
        name: "quickStop",
        description: "Send a quick stop command to a device",
        inputSchema: {
          type: "object",
          properties: {
            deviceRef: { type: "string", description: "The device reference identifier" },
          },
          required: ["deviceRef"],
        },
      },
    ];

    // Store tools in the map
    toolDefinitions.forEach((tool) => {
      this.tools.set(tool.name, tool);
    });

    console.log(`[MCPBridge] Loaded ${this.tools.size} tool definitions`);
  }

  /**
   * Get all available tools formatted for LLM tool definitions
   */
  getToolsForLLM(): Array<{
    type: string;
    function: {
      name: string;
      description: string;
      parameters: any;
    };
  }> {
    const toolsArray: Array<{
      type: string;
      function: {
        name: string;
        description: string;
        parameters: any;
      };
    }> = [];

    this.tools.forEach((tool) => {
      toolsArray.push({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      });
    });

    return toolsArray;
  }

  /**
   * Execute a tool call on the MCP server
   */
  async executeTool(toolName: string, args: Record<string, any>): Promise<ToolCallResult> {
    try {
      const tool = this.tools.get(toolName);
      if (!tool) {
        return {
          toolName,
          success: false,
          result: null,
          error: `Tool not found: ${toolName}`,
        };
      }

      console.log(`[MCPBridge] Executing tool: ${toolName} with args:`, args);

      // Call the MCP server tool via HTTP
      // The MCP server exposes tools through its HTTP endpoints
      const response = await this.callMcpServerTool(toolName, args);

      console.log(`[MCPBridge] Tool execution successful: ${toolName}`, response);

      return {
        toolName,
        success: true,
        result: response,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MCPBridge] Tool execution failed: ${toolName}`, error);

      return {
        toolName,
        success: false,
        result: null,
        error: errorMessage,
      };
    }
  }

  /**
   * Call the MCP server tool via HTTP
   * This method determines the appropriate endpoint based on the tool name
   */
  private async callMcpServerTool(toolName: string, args: Record<string, any>): Promise<any> {
    const baseUrl = `${this.mcpBaseUrl}/parameterConfig`;

    // Map tool names to their respective endpoints
    const endpoints: Record<string, (args: any) => string> = {
      ping: () => `${this.mcpBaseUrl}/health`,
      startDeviceDiscovery: (args) => `${this.mcpBaseUrl}/startMaster/discoverDevices/${encodeURIComponent(args.macAddress)}`,
      getGroupInfo: (args) => `${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/groupInfo/${encodeURIComponent(args.groupId)}`,
      startHoming: (args) => `${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/startHoming`,
      startPositionProfile: (args) => `${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/startPositionProfile`,
      startVelocityProfile: (args) => `${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/startVelocityProfile`,
      startTorqueProfile: (args) => `${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/startTorqueProfile`,
      releaseControl: (args) => `${baseUrl}/api/devices/${encodeURIComponent(args.deviceRef)}/releaseControl`,
      resetFault: (args) => `${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/resetFault/`,
      getCia402State: (args) => `${baseUrl}/api/devices/${encodeURIComponent(args.deviceRef)}/getCia402StateOfDevice`,
      startSystemIdentification: (args) => `${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/startSystemIdentification`,
      getSystemIdentificationData: (args) => `${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/getSystemIdentificationData`,
      getPositionTuningInfo: (args) => `${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/getPositionTuningInfo`,
      startPositionAutoTuning: (args) => `${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/startPositionAutoTuning/${encodeURIComponent(args.controllerType)}`,
      getVelocityTuningInfo: (args) => `${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/getVelocityTuningInfo`,
      startVelocityAutoTuning: (args) => `${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/startVelocityAutoTuning/`,
      getTorqueTuningInfo: (args) => `${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/getTorqueTuningInfo`,
      computePositionGains: (args) => `${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/computePositionGains`,
      computeVelocityGains: (args) => `${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/computeVelocityGains`,
      getTuningTrajectoryInfo: (args) => `${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/getTuningTrajectoryInfo/profileType/${encodeURIComponent(args.profileType)}`,
      startSignalGenerator: (args) => `${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/startSignalGenerator`,
      stopSignalGenerator: (args) => `${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/stopSignalGenerator`,
      quickStop: (args) => `${this.mcpBaseUrl}/motionMasterClient/api/devices/${encodeURIComponent(args.deviceRef)}/quick-stop`,
    };

    const endpointBuilder = endpoints[toolName];
    if (!endpointBuilder) {
      throw new Error(`No endpoint mapping for tool: ${toolName}`);
    }

    const url = endpointBuilder(args);
    console.log(`[MCPBridge] Calling endpoint: ${url}`);

    // Determine the HTTP method and body based on the tool
    const postTools = [
      "startDeviceDiscovery",
      "startHoming",
      "startPositionProfile",
      "startVelocityProfile",
      "startTorqueProfile",
      "releaseControl",
      "startSystemIdentification",
      "startPositionAutoTuning",
      "startVelocityAutoTuning",
      "startSignalGenerator",
      "stopSignalGenerator",
      "quickStop",
    ];

    const isPost = postTools.includes(toolName);
    const method = isPost ? "POST" : "GET";

    const config: any = {
      method,
      url,
      headers: {
        "Content-Type": "application/json",
      },
    };

    // For POST requests that require body parameters
    if (
      isPost &&
      ["startPositionProfile", "startVelocityProfile", "startTorqueProfile", "computePositionGains", "computeVelocityGains", "startSignalGenerator"].includes(toolName)
    ) {
      // Extract only the relevant parameters for the body
      const bodyParams = { ...args };
      delete bodyParams.deviceRef;
      config.data = bodyParams;
    }

    const response = await axios(config);
    return response.data;
  }

  /**
   * Format tool call results for the LLM
   */
  formatToolResultForLLM(result: ToolCallResult): string {
    if (result.success) {
      return JSON.stringify(result.result, null, 2);
    } else {
      return `Error: ${result.error}`;
    }
  }

  /**
   * Check if the MCP server is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Send an initialize request to the MCP endpoint
      const response = await axios.post(
        `${this.mcpBaseUrl}/mcp`,
        {
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "mcpBridge-health-check",
              version: "1.0.0",
            },
          },
          id: 1,
        },
        {
          timeout: 5000,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
          },
        }
      );
      // If we get a response with result and no error, the server is available
      return response.status === 200 && !!(response.data as any)?.result;
    } catch {
      return false;
    }
  }
}

// Export a singleton instance
export const mcpBridge = new MCPBridge();
