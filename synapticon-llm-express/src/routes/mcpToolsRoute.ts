import { Router, Request, Response } from "express";
import { mcpBridge } from "../services/mcpBridge.js";

const router = Router();

// Initialize the MCP bridge when the route is loaded
void mcpBridge.initialize().catch((error) => {
  console.error("[MCP Route] Failed to initialize MCPBridge:", error);
});

/**
 * Check if a value appears to be an example/dummy value rather than real user input
 */
function isExampleValue(toolName: string, paramName: string, value: any): boolean {
  if (typeof value !== "string") return false;

  const lowerValue = value.toLowerCase();

  // Common example patterns for device references
  if (paramName === "deviceRef") {
    const examplePatterns = [
      /^(servo|device|motor|actuator|axis)[-_]?\d+$/i, // servo-01, device-001, etc.
      /^example/i,
      /^demo/i,
      /^test/i,
      /^sample/i,
    ];
    return examplePatterns.some((pattern) => pattern.test(value));
  }

  return false;
}

/**
 * Helper function to extract tool information from tool schema
 */
function extractToolInfo(tool: any) {
  return {
    name: tool.function.name,
    description: tool.function.description,
    parameters: tool.function.parameters?.properties || {},
    required: tool.function.parameters?.required || [],
  };
}

/**
 * Helper function to analyze which parameters are missing for a tool
 */
function findMissingParameters(toolInfo: any, providedParams: Record<string, any>) {
  const missingParams: any[] = [];

  for (const paramName of toolInfo.required) {
    if (!(paramName in providedParams) || providedParams[paramName] === null || providedParams[paramName] === undefined) {
      const paramSchema = toolInfo.parameters[paramName] || {};
      missingParams.push({
        name: paramName,
        type: paramSchema.type || "string",
        description: paramSchema.description || "",
        required: true,
      });
    }
  }

  return missingParams;
}

/**
 * POST /analyze-question
 * Analyze a user question to identify which tool should be used and what parameters are missing
 * Request body: { question: string }
 */
router.post("/analyze-question", async (req: Request, res: Response) => {
  try {
    const { question } = req.body as { question: string };

    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    // Check if MCP server is available
    const mcpAvailable = await mcpBridge.isAvailable();
    if (!mcpAvailable) {
      return res.status(503).json({
        error: "MCP server is not available",
      });
    }

    const { base, key, model } = {
      base: process.env.LMSTUDIO_BASE_URL || "http://localhost:1234/v1",
      key: process.env.LMSTUDIO_API_KEY || "lm-studio",
      model: process.env.LMSTUDIO_MODEL || "meta-llama-3.1-8b-instruct",
    };

    // Get tools from MCP server
    const mcpTools = mcpBridge.getToolsForLLM();

    // Build system prompt for tool analysis
    const systemPrompt = `You are a parameter extraction expert. Your job is to:
1. Understand what the user wants to do
2. Identify which tool from the available tools best matches their intent
3. Extract ANY parameters that are explicitly mentioned in the user's question
4. Respond ONLY with valid JSON in this format:
{
  "toolName": "name_of_the_tool",
  "providedParameters": { "param1": "value1", "param2": "value2" },
  "userIntent": "brief description of what user wants"
}

If no appropriate tool matches the user's intent, respond with:
{
  "toolName": null,
  "message": "explanation of why no tool matches"
}

CRITICAL PARAMETER EXTRACTION RULES:
- MAC ADDRESS: Look for patterns like "AA:BB:CC:DD:EE:FF" or "AA-BB-CC-DD-EE-FF" or similar hex patterns
  - If you find a MAC address, extract it AS-IS with the user's format
  - Parameter name is "macAddress"
  - Examples: "discover with 00:11:22:33:44:55" -> macAddress: "00:11:22:33:44:55"
- DEVICE REFERENCE: Look for "device", "servo", "axis" followed by names or numbers
  - Parameter name is "deviceRef"
  - Examples: "device-1", "servo-01", "axis_0"
- NUMERIC PARAMETERS: Look for numbers in context
  - Position: "position 5000" -> position: 5000
  - RPM: "100 RPM" -> rpm: 100
  - Acceleration: "acceleration 1000" -> acceleration: 1000
- For numeric values, convert to numbers (e.g., "5000" becomes 5000)
- For string values, use the exact text provided by the user
- Keep MAC addresses and device references as strings

IMPORTANT: Extract EVERY parameter mentioned, even if optional.
Do NOT infer or assume values. Only extract what is EXPLICITLY stated.
If the user mentions a value, extract it.`;

    const messages: any[] = [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: `Available tools: ${JSON.stringify(
          mcpTools.map((t) => ({ name: t.function.name, description: t.function.description, parameters: Object.keys(t.function.parameters?.properties || {}) })),
          null,
          2
        )}\n\nUser question: "${question}"`,
      },
    ];

    console.log(`[Analyze Route] Analyzing question: "${question}"`);

    // Call LLM to analyze the question
    const analysisResponse = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        max_tokens: 500,
      }),
    }).then((r) => r.json());

    const analysisContent = analysisResponse?.choices?.[0]?.message?.content || "";
    console.log(`[Analyze Route] LLM analysis response:`, analysisContent);

    // Parse the JSON response from LLM
    let analysisResult;
    try {
      analysisResult = JSON.parse(analysisContent);
    } catch (parseError) {
      console.error("[Analyze Route] Failed to parse LLM response as JSON:", analysisContent);
      return res.status(400).json({
        success: false,
        message: "Could not analyze the question properly. Please rephrase.",
      });
    }

    // Post-processing: If macAddress is missing, try to extract it from the question using regex
    if (analysisResult.toolName) {
      const providedParams = analysisResult.providedParameters || {};

      // Check if this tool needs macAddress and it's not provided
      const toolInfo = extractToolInfo(mcpTools.find((t) => t.function.name === analysisResult.toolName) || {});
      if (toolInfo.required?.includes("macAddress") && !providedParams.macAddress) {
        // Try to extract MAC address from the question
        const macAddressPatterns = [
          /([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/g, // Standard MAC: AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF
        ];

        for (const pattern of macAddressPatterns) {
          const match = question.match(pattern);
          if (match) {
            providedParams.macAddress = match[0];
            analysisResult.providedParameters = providedParams;
            console.log(`[Analyze Route] Extracted MAC address from question: ${match[0]}`);
            break;
          }
        }
      }
    }

    // If no tool matched
    if (!analysisResult.toolName) {
      return res.json({
        success: true,
        toolSuggestion: null,
        message: analysisResult.message || "No matching tool found for your request.",
      });
    }

    // Find the matching tool
    const matchingTool = mcpTools.find((t) => t.function.name === analysisResult.toolName);
    if (!matchingTool) {
      return res.json({
        success: true,
        toolSuggestion: null,
        message: `Tool '${analysisResult.toolName}' not found.`,
      });
    }

    // Extract tool information
    const toolInfo = extractToolInfo(matchingTool);

    // Find missing required parameters
    const providedParams = analysisResult.providedParameters || {};
    const missingParams = findMissingParameters(toolInfo, providedParams);

    // Clean up providedParameters to remove null/undefined values
    const cleanedProvidedParams = Object.fromEntries(Object.entries(providedParams).filter(([_, value]) => value !== null && value !== undefined));

    console.log(
      `[Analyze Route] Tool: ${analysisResult.toolName}, Missing params:`,
      missingParams.map((p) => p.name)
    );

    // Return the tool suggestion
    return res.json({
      success: true,
      toolSuggestion: {
        toolName: analysisResult.toolName,
        toolDescription: toolInfo.description,
        providedParameters: cleanedProvidedParams,
        missingParameters: missingParams,
      },
    });
  } catch (error) {
    console.error("[Analyze Route] Error analyzing question:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

/**
 * GET /list-tools
 * Returns a list of available tools from the MCP server
 */
router.get("/list-tools", async (req: Request, res: Response) => {
  try {
    const tools = mcpBridge.getToolsForLLM();
    res.json({
      success: true,
      toolCount: tools.length,
      tools: tools,
    });
  } catch (error) {
    console.error("[MCP Route] Error listing tools:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to list tools",
    });
  }
});

/**
 * POST /chat-with-mcp-tools
 * Chat endpoint that integrates with MCP server tools
 * Request body: { question: string, conversationHistory?: Array<{ role: string; content: string }> }
 */
router.post("/chat-with-mcp-tools", async (req: Request, res: Response) => {
  try {
    const { question, conversationHistory } = req.body as {
      question: string;
      conversationHistory?: Array<{ role: string; content: string }>;
    };

    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    // Check if MCP server is available
    const mcpAvailable = await mcpBridge.isAvailable();
    if (!mcpAvailable) {
      return res.status(503).json({
        error: "MCP server is not available",
        suggestion: "Make sure the Motion Master Client MCP server is running on http://localhost:8036",
      });
    }

    const { base, key, model } = {
      base: process.env.LMSTUDIO_BASE_URL || "http://localhost:1234/v1",
      key: process.env.LMSTUDIO_API_KEY || "lm-studio",
      model: process.env.LMSTUDIO_MODEL || "meta-llama-3.1-8b-instruct",
    };

    // Get tools from MCP server
    const mcpTools = mcpBridge.getToolsForLLM();

    // Build messages array with conversation history
    const messages: any[] = [
      {
        role: "system",
        content:
          "You are a Synapticon servo-drive assistant powered by the Motion Master Client MCP Server. You have access to professional servo drive control tools.\n\n" +
          "CRITICAL TOOL CALLING RULES:\n" +
          "1. REQUIRED parameters MUST have actual values explicitly provided by the user\n" +
          "2. NEVER infer, assume, or guess parameter values (e.g., 'servo-01', 'device-001' are examples ONLY)\n" +
          "3. NEVER use placeholder values or example text in tool calls\n" +
          "4. If ANY required parameter is missing or not explicitly stated, ALWAYS ask the user to provide it\n" +
          "5. For optional parameters with defaults (timeoutSeconds, pollIntervalMs), only include if user specifies custom values\n" +
          "6. Use the EXACT values provided by the user without any modification\n\n" +
          "DEVICE REFERENCE REQUIREMENT:\n" +
          "- Tools that operate on devices REQUIRE a deviceRef parameter (the device's unique identifier)\n" +
          "- Examples like 'servo-01' or 'device-001' are just FORMAT examples\n" +
          "- You MUST ask the user which device they want to operate on\n" +
          "- Do NOT guess or use example values like 'servo-01' - ask the user explicitly\n" +
          "- If user doesn't specify a device reference, ALWAYS use discoverDevices() FIRST to show available devices\n" +
          "- Then let the user select which device to operate on\n\n" +
          "DEVICE DISCOVERY WORKFLOW:\n" +
          "1. When user asks to operate on 'a device' without specifying which one, call discoverDevices() first\n" +
          "2. Show the user the list of available devices (MAC addresses and their details)\n" +
          "3. Ask the user to choose which device they want to use (by MAC address)\n" +
          "4. Wait for the user's device selection before proceeding with the actual operation\n\n" +
          "AFTER TOOL EXECUTION:\n" +
          "- You will receive the tool's results/response\n" +
          "- ALWAYS analyze and report the actual results to the user\n" +
          "- Include specific details from the tool response (e.g., number of devices found, device names, MAC addresses, status)\n" +
          "- If the tool returns data or status information, present it clearly to the user\n" +
          "- Do NOT skip or ignore tool results - always incorporate them into your response\n\n" +
          "MAC ADDRESS REQUIREMENT:\n" +
          "- MAC addresses must be in format: AA:BB:CC:DD:EE:FF (12 hex digits, colon-separated)\n" +
          "- Ask the user to provide the exact MAC address if not specified\n\n" +
          "IMPORTANT: Your response in the second turn MUST be based on the actual tool results returned, not speculation.",
      },
      ...(conversationHistory || []),
      { role: "user", content: question },
    ];

    console.log(`[MCP Route] Sending request to LM Studio with ${mcpTools.length} tools available`);

    // First call: get initial response from LLM with tool suggestions
    const firstResponse = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        tools: mcpTools,
        tool_choice: "auto",
        temperature: 0.2,
        max_tokens: 2000,
      }),
    }).then((r) => r.json());

    console.log("[MCP Route] First LLM response received");

    const assistantMessage = firstResponse?.choices?.[0]?.message;
    const toolCalls = assistantMessage?.tool_calls || [];

    // If no tool calls, return the answer directly
    if (!toolCalls.length) {
      return res.json({
        success: true,
        answer: assistantMessage?.content || "No response generated",
        toolsUsed: [],
        debug: {
          requestModel: model,
          toolsAvailable: mcpTools.length,
        },
      });
    }

    console.log(`[MCP Route] LLM suggested ${toolCalls.length} tool calls`);

    // Execute each tool call
    const toolResults: any[] = [];
    const executedTools: string[] = [];

    for (const call of toolCalls) {
      try {
        const toolName = call.function?.name;
        const args = JSON.parse(call.function?.arguments || "{}");

        console.log(`[MCP Route] Executing tool: ${toolName}`, args);

        // Check for example/dummy values that shouldn't be used
        let exampleValueFound: string | null = null;
        for (const [paramName, paramValue] of Object.entries(args)) {
          if (isExampleValue(toolName, paramName, paramValue)) {
            exampleValueFound = `${paramName}="${paramValue}"`;
            break;
          }
        }

        if (exampleValueFound) {
          console.log(`[MCP Route] Tool ${toolName} contains example value: ${exampleValueFound}`);

          // Return error to LLM indicating example value was used
          toolResults.push({
            role: "tool",
            tool_call_id: call.id,
            name: toolName,
            content: JSON.stringify({
              error: `Invalid parameter value: ${exampleValueFound}. This appears to be an example value. Please ask the user to provide the actual value.`,
              hint: `For tools operating on devices, you MUST ask the user which device they want to operate on. Do not use example device references like 'servo-01' or 'device-001'.`,
            }),
          });
          continue;
        }

        // Execute the tool via MCP bridge
        const result = await mcpBridge.executeTool(toolName, args);

        executedTools.push(toolName);

        // Extract the actual tool result for the LLM
        let toolContent: string;
        if (result.success && result.result) {
          // The result contains the actual tool output
          toolContent = typeof result.result === "string" ? result.result : JSON.stringify(result.result, null, 2);
        } else {
          // Include error information if tool execution failed
          toolContent = JSON.stringify({
            success: false,
            error: result.error || "Tool execution failed",
          });
        }

        // Add result to the messages array for the follow-up call
        toolResults.push({
          role: "tool",
          tool_call_id: call.id,
          name: toolName,
          content: toolContent,
        });

        console.log(`[MCP Route] Tool ${toolName} executed successfully`);
        console.log(`[MCP Route] Tool result content:`, toolContent.substring(0, 200));
      } catch (toolError) {
        console.error(`[MCP Route] Error executing tool:`, toolError);
        const errorMessage = toolError instanceof Error ? toolError.message : "Unknown error";
        toolResults.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function?.name,
          content: JSON.stringify({ error: errorMessage }),
        });
      }
    }

    // Second call: get final response from LLM with tool results
    const secondResponse = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 2000,
        messages: [...messages, assistantMessage, ...toolResults],
      }),
    }).then((r) => r.json());

    const finalAnswer = secondResponse?.choices?.[0]?.message?.content || "No response generated";

    console.log("[MCP Route] Final response generated successfully");

    // Return the structured response
    return res.json({
      success: true,
      answer: finalAnswer,
      toolsUsed: executedTools,
      debug: {
        requestModel: model,
        toolsAvailable: mcpTools.length,
        toolsCalled: toolCalls.length,
      },
    });
  } catch (error) {
    console.error("[MCP Route] Error in chat-with-mcp-tools:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

/**
 * POST /execute-tool
 * Direct tool execution endpoint (for testing or direct API calls)
 * Request body: { toolName: string, args: Record<string, any> }
 */
router.post("/execute-tool", async (req: Request, res: Response) => {
  try {
    const { toolName, args } = req.body as {
      toolName: string;
      args: Record<string, any>;
    };

    if (!toolName || !args) {
      return res.status(400).json({ error: "toolName and args are required" });
    }

    console.log(`[MCP Route] Direct tool execution: ${toolName}`, args);

    // Check if MCP server is available
    const mcpAvailable = await mcpBridge.isAvailable();
    if (!mcpAvailable) {
      return res.status(503).json({
        error: "MCP server is not available",
      });
    }

    // Execute the tool
    const result = await mcpBridge.executeTool(toolName, args);

    if (result.success) {
      return res.json({
        success: true,
        tool: toolName,
        result: result.result,
      });
    } else {
      return res.status(400).json({
        success: false,
        tool: toolName,
        error: result.error,
      });
    }
  } catch (error) {
    console.error("[MCP Route] Error executing tool:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

/**
 * GET /mcp-status
 * Check the status of the MCP server
 */
router.get("/mcp-status", async (req: Request, res: Response) => {
  try {
    const available = await mcpBridge.isAvailable();
    const tools = available ? mcpBridge.getToolsForLLM() : [];

    res.json({
      mcpServerAvailable: available,
      baseUrl: "http://localhost:8036",
      toolsAvailable: tools.length,
      tools: available ? tools.map((t) => ({ name: t.function.name, description: t.function.description })) : [],
    });
  } catch (error) {
    console.error("[MCP Route] Error checking MCP status:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to check MCP status",
    });
  }
});

export default router;
