# Code Examples & Developer Guide

## Table of Contents

1. [Using the Chat Service](#using-the-chat-service)
2. [Extending the MCP Bridge](#extending-the-mcp-bridge)
3. [Adding New Tools](#adding-new-tools)
4. [Testing Examples](#testing-examples)
5. [Debugging Guide](#debugging-guide)

## Using the Chat Service

### Basic Chat with Tools (Angular)

```typescript
import { Component, inject } from "@angular/core";
import { McpLlmService, ChatResponse } from "../services/mcp-llm.service";

@Component({
  selector: "app-simple-chat",
  template: `
    <div>
      <input [(ngModel)]="question" (keyup.enter)="chat()" />
      <button (click)="chat()">Send</button>
      <p>{{ response }}</p>
    </div>
  `,
})
export class SimpleChatComponent {
  private mcpLlmService = inject(McpLlmService);
  question = "";
  response = "";

  chat(): void {
    this.mcpLlmService.chatWithMcpTools(this.question).subscribe({
      next: (result: ChatResponse) => {
        this.response = result.answer;
        console.log("Tools used:", result.toolsUsed);
      },
      error: (err) => {
        this.response = `Error: ${err.message}`;
      },
    });
  }
}
```

### Direct Tool Execution (Angular)

```typescript
// Execute a specific tool directly
this.mcpLlmService
  .executeTool("startPositionProfile", {
    deviceRef: "device-1",
    target: 5000,
    acceleration: 1000,
    deceleration: 1000,
  })
  .subscribe({
    next: (result) => {
      console.log("Tool executed:", result);
      if (result.success) {
        console.log("Result:", result.result);
      } else {
        console.error("Error:", result.error);
      }
    },
  });
```

### Checking MCP Status (Angular)

```typescript
// Check MCP server status and available tools
this.mcpLlmService.getMcpStatus().subscribe({
  next: (status) => {
    console.log("MCP Server Available:", status.mcpServerAvailable);
    console.log("Tools Available:", status.toolsAvailable);
    console.log("Tools:", status.tools);
  },
});
```

### Conversation History (Angular)

```typescript
// Add messages to history
this.mcpLlmService.addMessageToHistory({
  role: "user",
  content: "Move device-1 to position 5000",
});

this.mcpLlmService.addMessageToHistory({
  role: "assistant",
  content: "I will move device-1 to position 5000 for you.",
});

// Get history
const history = this.mcpLlmService.getHistory();
console.log("Conversation:", history);

// Clear history
this.mcpLlmService.clearHistory();
```

## Extending the MCP Bridge

### Adding a New Tool to MCPBridge

```typescript
// In mcpBridge.ts - add to loadToolDefinitions()

const newToolDefinitions: McpTool[] = [
  // ... existing tools ...
  {
    name: "customDeviceOperation",
    description: "Perform a custom operation on the device",
    inputSchema: {
      type: "object",
      properties: {
        deviceRef: {
          type: "string",
          description: "The device reference/ID",
        },
        customParam: {
          type: "string",
          description: "Custom parameter",
        },
        value: {
          type: "number",
          description: "Numeric value",
        },
      },
      required: ["deviceRef", "customParam", "value"],
    },
  },
];
```

### Adding Endpoint Mapping for New Tool

```typescript
// In MCPBridge.callMcpServerTool()

const endpoints: Record<string, (args: any) => string> = {
  // ... existing endpoints ...
  customDeviceOperation: (args) => `${baseUrl}/devices/${encodeURIComponent(args.deviceRef)}/customOperation`,
};
```

### Handling Tool-Specific Logic

```typescript
// In MCPBridge.callMcpServerTool()

// For POST requests that require special body handling
if (isPost && ["customDeviceOperation"].includes(toolName)) {
  const bodyParams = { ...args };
  delete bodyParams.deviceRef;
  config.data = bodyParams;
}
```

## Adding New Tools

### Complete Example: Add "setDeviceParameters" Tool

#### 1. Define Tool Schema (mcpBridge.ts)

```typescript
{
  name: "setDeviceParameters",
  description: "Set custom parameters on a device",
  inputSchema: {
    type: "object",
    properties: {
      deviceRef: {
        type: "string",
        description: "The device reference/ID"
      },
      parameters: {
        type: "object",
        description: "Key-value pairs of parameters to set",
        additionalProperties: {
          oneOf: [
            { type: "string" },
            { type: "number" },
            { type: "boolean" }
          ]
        }
      }
    },
    required: ["deviceRef", "parameters"]
  }
}
```

#### 2. Add Route Handler (mcpToolsRoute.ts)

```typescript
// Tools are handled automatically, but you can add custom logic:
router.post("/set-device-parameters", async (req: Request, res: Response) => {
  try {
    const { deviceRef, parameters } = req.body;

    // Validate parameters
    if (!deviceRef || !parameters) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Execute via MCP Bridge
    const result = await mcpBridge.executeTool("setDeviceParameters", {
      deviceRef,
      parameters,
    });

    res.json(result.success ? result.result : { error: result.error });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});
```

#### 3. Use in Angular Service

```typescript
// The existing methods work automatically
this.mcpLlmService
  .executeTool("setDeviceParameters", {
    deviceRef: "device-1",
    parameters: {
      maxVelocity: 1000,
      minPosition: -500,
      emergencyStop: false,
    },
  })
  .subscribe((result) => {
    console.log("Parameters set:", result);
  });
```

## Testing Examples

### Unit Test: MCPBridge Service

```typescript
import { MCPBridge } from "./mcpBridge";

describe("MCPBridge", () => {
  let bridge: MCPBridge;

  beforeEach(() => {
    bridge = new MCPBridge("http://localhost:8036");
  });

  it("should initialize and load tools", async () => {
    await bridge.initialize();
    const tools = bridge.getToolsForLLM();
    expect(tools.length).toBe(29);
    expect(tools[0].function.name).toBe("ping");
  });

  it("should format tools for LLM correctly", async () => {
    await bridge.initialize();
    const tools = bridge.getToolsForLLM();

    tools.forEach((tool) => {
      expect(tool.type).toBe("function");
      expect(tool.function.name).toBeTruthy();
      expect(tool.function.description).toBeTruthy();
      expect(tool.function.parameters).toBeTruthy();
    });
  });

  it("should return proper tool call result", async () => {
    const result = await bridge.executeTool("ping", {});
    expect(result.toolName).toBe("ping");
    expect(result.success).toBeDefined();
  });
});
```

### Integration Test: Express Route

```typescript
import request from "supertest";
import app from "../server";

describe("MCP Routes", () => {
  it("should list tools", async () => {
    const response = await request(app).get("/api/mcp/list-tools").expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.toolCount).toBeGreaterThan(0);
    expect(response.body.tools).toBeInstanceOf(Array);
  });

  it("should check MCP status", async () => {
    const response = await request(app).get("/api/mcp/mcp-status").expect(200);

    expect(response.body.mcpServerAvailable).toBeDefined();
    expect(response.body.toolsAvailable).toBeDefined();
  });

  it("should execute a tool", async () => {
    const response = await request(app)
      .post("/api/mcp/execute-tool")
      .send({
        toolName: "ping",
        args: {},
      })
      .expect(200);

    expect(response.body.success).toBe(true);
  });

  it("should handle chat with tools", async () => {
    const response = await request(app)
      .post("/api/mcp/chat-with-mcp-tools")
      .send({
        question: "What is your status?",
      })
      .expect(200);

    expect(response.body.success).toBeDefined();
    expect(response.body.answer).toBeTruthy();
  });
});
```

### Angular Component Test

```typescript
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { of, throwError } from "rxjs";
import { McpChatComponent } from "./mcp-chat.component";
import { McpLlmService } from "../../services/mcp-llm.service";

describe("McpChatComponent", () => {
  let component: McpChatComponent;
  let fixture: ComponentFixture<McpChatComponent>;
  let mockService: jasmine.SpyObj<McpLlmService>;

  beforeEach(async () => {
    mockService = jasmine.createSpyObj("McpLlmService", ["getMcpStatus", "listMcpTools", "chatWithMcpTools", "addMessageToHistory", "clearHistory"]);

    await TestBed.configureTestingModule({
      imports: [McpChatComponent],
      providers: [{ provide: McpLlmService, useValue: mockService }],
    }).compileComponents();

    fixture = TestBed.createComponent(McpChatComponent);
    component = fixture.componentInstance;
  });

  it("should load MCP status on init", () => {
    mockService.getMcpStatus.and.returnValue(
      of({
        mcpServerAvailable: true,
        toolsAvailable: 29,
        baseUrl: "http://localhost:8036",
        tools: [],
      })
    );

    component.ngOnInit();

    expect(mockService.getMcpStatus).toHaveBeenCalled();
    expect(component.mcpServerAvailable).toBe(true);
    expect(component.toolsAvailable).toBe(29);
  });

  it("should send message and display response", (done) => {
    mockService.chatWithMcpTools.and.returnValue(
      of({
        success: true,
        answer: "Test response",
        toolsUsed: [],
      })
    );

    component.inputText = "Test question";
    component.sendMessage();

    setTimeout(() => {
      expect(component.messages.length).toBeGreaterThan(0);
      expect(mockService.chatWithMcpTools).toHaveBeenCalledWith("Test question");
      done();
    }, 100);
  });

  it("should handle errors gracefully", (done) => {
    mockService.chatWithMcpTools.and.returnValue(throwError(() => new Error("Test error")));

    component.inputText = "Test question";
    component.sendMessage();

    setTimeout(() => {
      const lastMessage = component.messages[component.messages.length - 1];
      expect(lastMessage.error).toBeTruthy();
      done();
    }, 100);
  });
});
```

## Debugging Guide

### Enable Debug Logging

#### Express Backend

```typescript
// In server.ts
import debug from "debug";
const log = debug("mcp:*");

// Enable with: DEBUG=mcp:* npm run start
```

#### Angular Service

```typescript
// In mcp-llm.service.ts
private log(message: string, data?: any): void {
  console.log(`[McpLlmService] ${message}`, data);
}

// Use throughout service
this.log('Chat request sent', { question, historyLength });
```

### Check Network Requests

#### Chrome DevTools

1. Open DevTools (F12)
2. Go to Network tab
3. Send a chat message
4. Inspect the requests:
   - POST to `/api/mcp/chat-with-mcp-tools` - Main chat request
   - Network should show response with answer and tools used

#### cURL Commands for Manual Testing

```bash
# Check MCP status
curl http://localhost:3001/api/mcp/mcp-status | jq

# List tools
curl http://localhost:3001/api/mcp/list-tools | jq

# Execute a tool
curl -X POST http://localhost:3001/api/mcp/execute-tool \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "ping",
    "args": {}
  }' | jq

# Chat with tools
curl -X POST http://localhost:3001/api/mcp/chat-with-mcp-tools \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What tools are available?"
  }' | jq
```

### Common Issues and Solutions

#### Issue: Tool not executing

```typescript
// Add debug logging to MCPBridge
console.log(`[MCPBridge] Executing tool: ${toolName}`);
console.log(`[MCPBridge] With args:`, args);

// Check endpoint construction
console.log(`[MCPBridge] Calling endpoint: ${url}`);
```

#### Issue: LLM not recognizing tools

```typescript
// Verify tools are formatted correctly
const tools = mcpBridge.getToolsForLLM();
console.log("Tools for LLM:", JSON.stringify(tools, null, 2));

// Check tool names match exactly
tools.forEach((t) => console.log(t.function.name));
```

#### Issue: Slow responses

```typescript
// Add timing logging
const startTime = Date.now();

// ... operation ...

const elapsed = Date.now() - startTime;
console.log(`Operation took ${elapsed}ms`);
```

### Performance Profiling

```typescript
// Angular component performance
import { performance } from "@angular/platform-browser";

const mark = "chat-" + Date.now();
performance.mark(mark + "-start");

// ... chat operation ...

performance.mark(mark + "-end");
performance.measure(mark, mark + "-start", mark + "-end");
const measure = performance.getEntriesByName(mark)[0];
console.log(`Chat took ${measure.duration}ms`);
```

### Browser Console Examples

```javascript
// In browser console while chatting

// Get component instance
ng.probe(document.querySelector("app-mcp-chat")).componentInstance;

// Access service
const service = ng.probe(document.querySelector("app-mcp-chat")).injector.get(McpLlmService);

// Check conversation history
service.getHistory();

// Manual chat call
service.chatWithMcpTools("test").subscribe(
  (result) => console.log("Result:", result),
  (error) => console.error("Error:", error)
);
```

## Best Practices

### 1. Error Handling

```typescript
// Always use try-catch in MCPBridge
try {
  const result = await this.callMcpServerTool(toolName, args);
  return { toolName, success: true, result };
} catch (error) {
  console.error(`Tool execution failed: ${toolName}`, error);
  return {
    toolName,
    success: false,
    result: null,
    error: error instanceof Error ? error.message : String(error),
  };
}
```

### 2. Type Safety

```typescript
// Use proper types in Angular
interface ChatRequest {
  question: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

interface ChatResponse {
  success: boolean;
  answer: string;
  toolsUsed?: string[];
  error?: string;
}
```

### 3. Input Validation

```typescript
// Validate in Express routes
if (!question || typeof question !== "string") {
  return res.status(400).json({ error: "Invalid question" });
}

if (!Array.isArray(conversationHistory)) {
  conversationHistory = [];
}
```

### 4. Logging Best Practices

```typescript
// Use consistent logging format
console.log(`[ServiceName] Method: message`, data);

// Log levels
console.log("[INFO] Normal operation");
console.warn("[WARN] Unexpected but handled");
console.error("[ERROR] Failed operation");
```

This guide provides practical examples for extending, testing, and debugging the MCP-LLM integration system.
