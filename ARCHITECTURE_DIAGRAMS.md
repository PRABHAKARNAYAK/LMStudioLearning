# MCP-LLM Integration Architecture Diagrams

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER INTERACTION LAYER                             │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Angular Chat UI (Port 4200)                       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │                   mcp-chat.component                             │ │   │
│  │  │  ┌────────────┐  ┌──────────┐  ┌─────────┐  ┌──────────────┐  │ │   │
│  │  │  │  Messages  │  │   Input  │  │  Tools  │  │   Status     │  │ │   │
│  │  │  │  Display   │  │   Area   │  │  Panel  │  │  Indicator   │  │ │   │
│  │  │  └────────────┘  └──────────┘  └─────────┘  └──────────────┘  │ │   │
│  │  │                                                                  │ │   │
│  │  │         McpLlmService (Angular Service)                        │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                              │                                         │   │
│  │                    HTTP Requests (REST API)                           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     │ JSON over HTTP
                                     │
        ┌────────────────────────────▼──────────────────────────────┐
        │                                                             │
        │        Express Backend (Port 3001) - /api/mcp             │
        │                                                             │
        │  ┌─────────────────────────────────────────────────────┐  │
        │  │                  mcpToolsRoute                       │  │
        │  │                                                      │  │
        │  │  ┌──────────────────────────────────────────────┐  │  │
        │  │  │  POST /chat-with-mcp-tools                  │  │  │
        │  │  │  GET  /list-tools                           │  │  │
        │  │  │  GET  /mcp-status                           │  │  │
        │  │  │  POST /execute-tool                         │  │  │
        │  │  └──────────────────────────────────────────────┘  │  │
        │  │                       │                              │  │
        │  │             ┌─────────▼──────────┐                  │  │
        │  │             │  MCPBridge Service │                  │  │
        │  │             │                    │                  │  │
        │  │             │ • Tool Management  │                  │  │
        │  │             │ • Tool Execution   │                  │  │
        │  │             │ • Error Handling   │                  │  │
        │  │             │ • Status Checking  │                  │  │
        │  │             └─────────┬──────────┘                  │  │
        │  └──────────────────────┼──────────────────────────────┘  │
        │                          │                                 │
        └──────────────────────────┼─────────────────────────────────┘
                                   │
                    ┌──────────────┬─────────────────┐
                    │              │                 │
                    │              │                 │
         ┌──────────▼──┐  ┌───────▼────────┐  ┌────▼──────────┐
         │              │  │                │  │               │
         │  LM Studio   │  │  MCP Server    │  │ Other APIs    │
         │ (Port 1234)  │  │ (Port 8036)    │  │ (as needed)   │
         │              │  │                │  │               │
         │ • Chat API   │  │ • Tool HTTP    │  │               │
         │ • Tool Calling│ │   Endpoints    │  │               │
         │ • Model      │  │ • Device       │  │               │
         │   Management │  │   Management   │  │               │
         │              │  │                │  │               │
         └──────────────┘  └────────────────┘  └───────────────┘
```

## Data Flow: Chat with Tool Execution

```
┌──────────┐
│   User   │
│ Asks     │
│ Question │
└────┬─────┘
     │
     │ "Move device-1 to position 5000"
     │
     ▼
┌──────────────────────────────────────────────┐
│  Angular Chat Component                      │
│  • Captures user input                       │
│  • Sends via McpLlmService.chatWithMcpTools │
└────────────┬─────────────────────────────────┘
             │
             │ POST /api/mcp/chat-with-mcp-tools
             │ Body: { question, conversationHistory }
             │
             ▼
┌──────────────────────────────────────────────┐
│  Express Route Handler                       │
│  • Validates request                         │
│  • Checks MCP server availability            │
│  • Gets environment variables                │
│  • Retrieves tools from MCPBridge            │
└────────────┬─────────────────────────────────┘
             │
             │ Build LLM request with:
             │ - System prompt
             │ - Conversation history
             │ - User message
             │ - 29 tool definitions
             │
             ▼
┌──────────────────────────────────────────────┐
│  LM Studio (meta-llama-3.1-8b-instruct)     │
│  • Analyzes question                         │
│  • Recognizes "move device" action           │
│  • Selects startPositionProfile tool         │
│  • Extracts parameters from question         │
│  • Generates tool call with arguments        │
└────────────┬─────────────────────────────────┘
             │
             │ Response with tool_calls:
             │ [{
             │   name: "startPositionProfile",
             │   arguments: {
             │     deviceRef: "device-1",
             │     target: 5000,
             │     acceleration: 1000,
             │     deceleration: 1000
             │   }
             │ }]
             │
             ▼
┌──────────────────────────────────────────────┐
│  Express Route (Tool Execution Loop)         │
│  • Parses tool_calls from LLM response      │
│  • For each tool call:                       │
└────────────┬─────────────────────────────────┘
             │
             │ callMcpServerTool("startPositionProfile", {...})
             │
             ▼
┌──────────────────────────────────────────────┐
│  MCPBridge Service                           │
│  • Maps tool name to MCP endpoint            │
│  • Validates arguments against schema        │
│  • Constructs HTTP request                   │
│  • Sends to MCP server                       │
└────────────┬─────────────────────────────────┘
             │
             │ POST http://localhost:8036/parameterConfig/
             │       devices/device-1/startPositionProfile
             │ Body: { target: 5000, acceleration: 1000, ... }
             │
             ▼
┌──────────────────────────────────────────────┐
│  MCP Server (SE.IA.Lexium38i)               │
│  • Receives HTTP request                     │
│  • Executes startPositionProfile tool        │
│  • Controls servo device via API             │
│  • Returns result                            │
└────────────┬─────────────────────────────────┘
             │
             │ Response: { success: true, message: "...", ... }
             │
             ▼
┌──────────────────────────────────────────────┐
│  MCPBridge (Tool Result Processing)          │
│  • Receives tool execution result            │
│  • Formats for LLM                           │
│  • Returns ToolCallResult                    │
└────────────┬─────────────────────────────────┘
             │
             │ { toolName, success, result }
             │
             ▼
┌──────────────────────────────────────────────┐
│  Express Route (Follow-up LLM Call)          │
│  • Collects all tool results                 │
│  • Sends second request to LLM with:         │
│    - Original user message                   │
│    - Assistant's tool calls                  │
│    - Tool execution results                  │
└────────────┬─────────────────────────────────┘
             │
             │ POST http://localhost:1234/v1/chat/completions
             │
             ▼
┌──────────────────────────────────────────────┐
│  LM Studio (Generate Final Response)         │
│  • Reads tool results                        │
│  • Understands action was successful         │
│  • Generates natural language response       │
│  • Returns final answer                      │
└────────────┬─────────────────────────────────┘
             │
             │ "I've successfully moved device-1 to position 5000..."
             │
             ▼
┌──────────────────────────────────────────────┐
│  Express Route (Send Response)               │
│  • Formats response with metadata            │
│  • Includes tools used information           │
│  • Sends JSON to frontend                    │
└────────────┬─────────────────────────────────┘
             │
             │ JSON Response:
             │ {
             │   success: true,
             │   answer: "I've successfully...",
             │   toolsUsed: ["startPositionProfile"],
             │   debug: { ... }
             │ }
             │
             ▼
┌──────────────────────────────────────────────┐
│  Angular Component (Display Response)        │
│  • Receives JSON response                    │
│  • Adds assistant message to display         │
│  • Shows tool badges                         │
│  • Adds to conversation history              │
│  • Scrolls to latest message                 │
│  • Re-enables input for next question        │
└────────────┬─────────────────────────────────┘
             │
             ▼
        ┌─────────────┐
        │   User      │
        │  Sees       │
        │  Response   │
        │  in Chat UI │
        └─────────────┘
```

## Component Interaction Diagram

```
                      ┌─────────────────────────────────┐
                      │   User Browser                  │
                      │   (Angular App)                 │
                      │                                 │
                      │  ┌───────────────────────────┐  │
                      │  │  mcp-chat Component       │  │
                      │  │                           │  │
                      │  │  • UI Rendering           │  │
                      │  │  • Message Display        │  │
                      │  │  • Input Handling         │  │
                      │  │  • Tool Sidebar           │  │
                      │  │                           │  │
                      │  │  Injects:                 │  │
                      │  │  McpLlmService            │  │
                      │  └─────────┬─────────────────┘  │
                      │            │                    │
                      │  ┌─────────▼──────────────────┐ │
                      │  │  McpLlmService            │ │
                      │  │                           │ │
                      │  │  • chatWithMcpTools()     │ │
                      │  │  • listMcpTools()         │ │
                      │  │  • getMcpStatus()         │ │
                      │  │  • executeTool()          │ │
                      │  │  • History Management     │ │
                      │  │                           │ │
                      │  │  Dependencies:            │ │
                      │  │  HttpClient               │ │
                      │  └─────────┬─────────────────┘ │
                      │            │                    │
                      └────────────┼────────────────────┘
                                   │
                                   │ HTTP Calls
                                   │ JSON/REST
                                   │
                      ┌────────────▼────────────────────┐
                      │   Express Server                │
                      │   (Node.js)                     │
                      │                                 │
                      │  ┌───────────────────────────┐  │
                      │  │  mcpToolsRoute            │  │
                      │  │                           │  │
                      │  │  Handlers:                │  │
                      │  │  • POST /chat-with-...    │  │
                      │  │  • GET /list-tools        │  │
                      │  │  • GET /mcp-status        │  │
                      │  │  • POST /execute-tool     │  │
                      │  │                           │  │
                      │  │  Dependencies:            │  │
                      │  │  MCPBridge                │  │
                      │  └─────────┬─────────────────┘  │
                      │            │                    │
                      │  ┌─────────▼──────────────────┐ │
                      │  │  MCPBridge Service        │ │
                      │  │                           │ │
                      │  │  • Tool Definitions (29)  │ │
                      │  │  • executeTool()          │ │
                      │  │  • callMcpServerTool()    │ │
                      │  │  • isAvailable()          │ │
                      │  │  • getToolsForLLM()       │ │
                      │  │                           │ │
                      │  │  Dependencies:            │ │
                      │  │  axios (HTTP calls)       │ │
                      │  └─────────┬─────────────────┘  │
                      │            │                    │
                      └────────────┼────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              │ HTTP GET/POST      │                    │
              │                    │                    │
              ▼                    ▼                    ▼
    ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
    │  LM Studio       │  │  MCP Server      │  │  Motion Master   │
    │  (Port 1234)     │  │  (Port 8036)     │  │  Backend         │
    │                  │  │                  │  │                  │
    │ • Chat API       │  │ • REST Endpoints │  │  • Device Control│
    │ • Tool Calling   │  │ • Tool Execution │  │  • Servo Control │
    │ • Model Control  │  │ • Device Mgmt    │  │  • Tuning        │
    │                  │  │                  │  │                  │
    └──────────────────┘  └──────────────────┘  └──────────────────┘
```

## Tool Definition Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  Tool Definition (for LLM)                                      │
│                                                                  │
│  {                                                              │
│    type: "function",                                            │
│    function: {                                                  │
│      name: "startPositionProfile",                              │
│      description: "Execute a POSITION PROFILE on the servo...", │
│      parameters: {                                              │
│        type: "object",                                          │
│        properties: {                                            │
│          deviceRef: {                                           │
│            type: "string",                                      │
│            description: "The device reference/ID"               │
│          },                                                     │
│          target: {                                              │
│            type: "number",                                      │
│            description: "Target position in counts or units"    │
│          },                                                     │
│          acceleration: {                                        │
│            type: "number",                                      │
│            description: "Profile acceleration in units/s²"      │
│          },                                                     │
│          deceleration: {                                        │
│            type: "number",                                      │
│            description: "Profile deceleration in units/s²"      │
│          },                                                     │
│          relative: {                                            │
│            type: "boolean",                                     │
│            description: "If true, target is relative..."        │
│          }                                                      │
│          // ... more optional parameters                        │
│        },                                                       │
│        required: ["deviceRef", "target", "acceleration",        │
│                   "deceleration"]                               │
│      }                                                          │
│    }                                                            │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

## State Management Flow

```
                      Angular Component
                      (mcp-chat)
                            │
                    ┌───────┴────────┐
                    │                │
                    ▼                ▼
            Component State    Injected Service
            • messages[]       McpLlmService
            • inputText        • History management
            • isLoading        • API calls
            • mcpAvailable
            • availableTools[]
                    │
                    └───────┬────────┐
                            │        │
                    Local Storage   Session Memory
                    (future)        (current state)
```

## Error Handling Flow

```
┌─────────────┐
│   Request   │
└──────┬──────┘
       │
       ▼
┌────────────────────────────────┐
│ MCP Server Available?          │
├────────────────────────────────┤
│ NO  ──────► Return 503         │
│            "MCP Unavailable"   │
└────┬───────────────────────────┘
     │ YES
     ▼
┌────────────────────────────────┐
│ LM Studio Response Valid?       │
├────────────────────────────────┤
│ NO  ──────► Parse Error        │
│            Return error details │
└────┬───────────────────────────┘
     │ YES
     ▼
┌────────────────────────────────┐
│ Tool Execution Success?        │
├────────────────────────────────┤
│ NO  ──────► Include error      │
│            in next LLM call    │
└────┬───────────────────────────┘
     │ YES
     ▼
┌────────────────────────────────┐
│ Final LLM Response Valid?       │
├────────────────────────────────┤
│ NO  ──────► Return error       │
│            with debug info     │
└────┬───────────────────────────┘
     │ YES
     ▼
┌────────────────────────────────┐
│ Return Success Response        │
│ with answer, tools used, debug │
└────────────────────────────────┘
```

## Technology Stack

```
Frontend Layer                 Backend Layer              External Services
─────────────────              ────────────               ──────────────────
Angular 17+                    Express.js                 LM Studio
├─ TypeScript                  ├─ Node.js                 ├─ meta-llama-3.1
├─ RxJS                        ├─ TypeScript              ├─ Chat API
├─ SCSS/CSS                    ├─ Zod (validation)        └─ Tool Calling
└─ HttpClient                  └─ Axios (HTTP)
                                                          MCP Server
                               Express Middleware         ├─ Motion Master
                               ├─ CORS                    ├─ 29 Tools
                               ├─ JSON Parser             └─ HTTP Endpoints
                               └─ Error Handler
```

This visual representation helps understand how all components work together to create a seamless chat experience with MCP server tool integration.
