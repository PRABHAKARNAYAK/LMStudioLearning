# MCP Server Integration with LLM Chat Model

This document describes the integration of the Motion Master Client MCP Server (`SE.IA.Lexium38i.MotionMasterClient`) with the LM Studio chat model (`meta-llama-3.1-8b-instruct`) and the new Chat UI component.

## Architecture Overview

The integration consists of three main components:

1. **MCP Server** (`SE.IA.Lexium38i.MotionMasterClient`): Exposes servo drive control tools via HTTP endpoints
2. **Express Backend** (`synapticon-llm-express`): Bridges the MCP server with the LLM, handling tool calls
3. **Angular Frontend** (`LLM_UI`): Chat interface for user interaction

### Component Flow

```
User Input
    ↓
Angular Chat Component (mcp-chat)
    ↓
McpLlmService (HTTP call to Express backend)
    ↓
Express Route (/api/mcp/chat-with-mcp-tools)
    ↓
MCPBridge Service (extracts tools, formats for LLM)
    ↓
LM Studio (meta-llama-3.1-8b-instruct)
    ↓
Tool Execution (if tool calls are made)
    ↓
MCP Server Tools (HTTP requests to port 8036)
    ↓
Response back through the chain
    ↓
Angular Component displays result
```

## Components Created

### 1. MCPBridge Service (`synapticon-llm-express/src/services/mcpBridge.ts`)

Handles communication with the Motion Master MCP Server.

**Key Features:**

- Initializes tool definitions for all 29 MCP server tools
- Formats tools for LLM integration
- Executes tool calls on the MCP server
- Maps tool names to appropriate HTTP endpoints

**Available Tools:**

- Device Discovery: `startDeviceDiscovery`
- Control Profiles: `startPositionProfile`, `startVelocityProfile`, `startTorqueProfile`
- Device Management: `releaseControl`, `resetFault`, `quickStop`, `startHoming`
- State Monitoring: `getCia402State`
- Tuning: `getPositionTuningInfo`, `startPositionAutoTuning`, `getVelocityTuningInfo`, `startVelocityAutoTuning`, `getTorqueTuningInfo`, `computePositionGains`, `computeVelocityGains`, `getTuningTrajectoryInfo`
- System Identification: `startSystemIdentification`, `getSystemIdentificationData`
- Signal Generation: `startSignalGenerator`, `stopSignalGenerator`
- Information Retrieval: `getGroupInfo`
- Health: `ping`

### 2. Express Routes (`synapticon-llm-express/src/routes/mcpToolsRoute.ts`)

Three main endpoints:

#### `POST /api/mcp/chat-with-mcp-tools`

Main endpoint for chatting with MCP tool integration.

**Request Body:**

```json
{
  "question": "Move device-1 to position 5000 with acceleration 1000",
  "conversationHistory": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "answer": "I've successfully moved device-1 to position 5000...",
  "toolsUsed": ["startPositionProfile"],
  "debug": {
    "requestModel": "meta-llama-3.1-8b-instruct",
    "toolsAvailable": 29,
    "toolsCalled": 1
  }
}
```

#### `GET /api/mcp/list-tools`

Returns all available tools from the MCP server.

#### `POST /api/mcp/execute-tool`

Direct tool execution endpoint for testing.

**Request Body:**

```json
{
  "toolName": "startPositionProfile",
  "args": {
    "deviceRef": "device-1",
    "target": 5000,
    "acceleration": 1000,
    "deceleration": 1000
  }
}
```

#### `GET /api/mcp/mcp-status`

Check the status of the MCP server and available tools.

### 3. Angular Service (`LLM_UI/src/app/services/mcp-llm.service.ts`)

Service for communicating with the Express backend.

**Methods:**

- `chatWithMcpTools(question: string)`: Send chat with MCP tools
- `listMcpTools()`: Get available tools
- `executeTool(toolName, args)`: Execute a tool directly
- `getMcpStatus()`: Check MCP server status
- `addMessageToHistory()`: Add message to conversation history
- `clearHistory()`: Clear conversation history

### 4. Angular Component (`LLM_UI/src/app/mcp-chat/mcp-chat.component.*`)

Full-featured chat UI with:

- Real-time message display
- Tool usage tracking
- MCP server status monitoring
- Available tools sidebar
- Conversation history management
- Auto-scroll to latest messages
- Error handling and loading states

**Features:**

- Beautiful gradient UI with dark and light themes
- Tool badges showing which tools were used
- Timestamped messages
- Example prompts for first-time users
- Responsive design (works on mobile/tablet)
- Keyboard shortcuts (Shift+Enter for new line, Enter to send)

## Setup Instructions

### Prerequisites

1. **Node.js** v18+ and npm/yarn
2. **Motion Master Client MCP Server** running on `http://localhost:8036`
3. **LM Studio** with `meta-llama-3.1-8b-instruct` model running on `http://localhost:1234/v1`

### 1. Start the MCP Server

```bash
cd SE.IA.Lexium38i.MotionMasterClient
npm install
npm run build
npm run start
# Server will be available at http://localhost:8036
```

### 2. Start the Express Backend

```bash
cd synapticon-llm-express
npm install
npm run build
npm run start
# Backend will be available at http://localhost:3001
```

### 3. Start the Angular Frontend

```bash
cd LLM_UI
npm install
ng serve
# Frontend will be available at http://localhost:4200
```

### 4. Ensure LM Studio is Running

- Download and start LM Studio
- Load the model `meta-llama-3.1-8b-instruct`
- Ensure the server is running on `http://localhost:1234/v1`
- Set API key (optional, defaults to `lm-studio`)

### 5. Access the Chat UI

Navigate to `http://localhost:4200/mcp-chat`

## Environment Variables

### Express Backend (`synapticon-llm-express`)

```env
# .env
PORT=3001
LMSTUDIO_BASE_URL=http://localhost:1234/v1
LMSTUDIO_API_KEY=lm-studio
LMSTUDIO_MODEL=meta-llama-3.1-8b-instruct
```

### Angular Frontend (`LLM_UI`)

The frontend is configured to use:

- `http://localhost:3001/api/llm` for LLM endpoints
- `http://localhost:3001/api/mcp` for MCP endpoints

You can modify these in:

- `src/environments/environment.ts` (production)
- `src/environments/environment.development.ts` (development)

## Usage Examples

### Example 1: Device Discovery

**User Input:**

```
Discover devices on network with MAC address 00:11:22:33:44:55
```

**LLM will use:** `startDeviceDiscovery` tool

**Expected Response:**

```
✓ Device Discovery Successful

Status: SUCCESS
MAC Address: 00:11:22:33:44:55
Devices Found: 2
Time Elapsed: 15 seconds

DEVICES:
1. Servo Drive 1
   Serial: SN12345
   MAC: 00:11:22:33:44:55
   Status: online
```

### Example 2: Position Control

**User Input:**

```
Move device-1 to position 10000 with acceleration 5000 and deceleration 5000
```

**LLM will use:** `startPositionProfile` tool

**Expected Response:**

```
✓ Position Profile Successful

I've successfully sent a position profile command to device-1:
- Target Position: 10000 counts
- Acceleration: 5000 units/s²
- Deceleration: 5000 units/s²

The device will now move to the target position and I'll monitor for completion.
```

### Example 3: Device State Monitoring

**User Input:**

```
Get the current state of device-1 and tell me if it's ready to operate
```

**LLM will use:** `getCia402State` tool

**Expected Response:**

```
Device-1 is currently in the "Operation Enabled" state, which means it's fully ready for operation. The motor can be commanded to move or hold position. All safety checks have passed.
```

## Troubleshooting

### Issue: MCP Server Not Available

**Error Message:** `"MCP server is not available"`

**Solution:**

1. Check that the Motion Master Client MCP Server is running on port 8036
2. Verify the server is not blocked by firewall
3. Check server logs for errors: `npm run start`

### Issue: LM Studio Not Responding

**Error Message:** `"Failed to call LM Studio"` or `"timeout"`

**Solution:**

1. Ensure LM Studio is running and the model is loaded
2. Check the base URL: `http://localhost:1234/v1`
3. Verify the model is `meta-llama-3.1-8b-instruct`
4. Check LM Studio logs and system resources

### Issue: Tool Execution Failed

**Error Message:** `"Error: API call failed"`

**Solution:**

1. Check the MCP server logs for the specific tool error
2. Verify all required parameters are provided
3. Ensure the device reference is correct
4. Check network connectivity between Express and MCP server

### Issue: CORS Errors

**Error Message:** `"Access to XMLHttpRequest from origin 'http://localhost:4200' has been blocked by CORS policy"`

**Solution:**

1. Verify that Express backend has CORS enabled (it should be by default)
2. Check that the correct API base URL is set in environment files
3. Restart the Express server

## Architecture Decisions

### Why MCP Bridge Pattern?

The MCPBridge service provides:

1. **Abstraction**: Decouples LLM from MCP server details
2. **Tool Management**: Centralized tool definition and execution
3. **Error Handling**: Consistent error responses
4. **Extensibility**: Easy to add new tools or MCP servers

### Why Express Middleware?

Express is used to:

1. **Security**: Validate requests before forwarding to LLM
2. **Tool Routing**: Intelligently route tools to correct endpoints
3. **Response Formatting**: Standardize responses for the UI
4. **Conversation History**: Maintain conversation state

### Why Angular Frontend?

Angular provides:

1. **Type Safety**: TypeScript for better developer experience
2. **Reactivity**: RxJS for handling async operations
3. **Component-Based**: Reusable UI components
4. **Performance**: Efficient change detection

## Performance Considerations

1. **Token Limits**: The system defaults to 2000 max tokens per response
2. **Timeout**: Chat requests timeout after 30 seconds
3. **Tool Execution**: Can take time depending on MCP server operations
4. **Conversation History**: Grows with each message (consider clearing periodically)

## Security Considerations

1. **API Key Protection**: Keep `LMSTUDIO_API_KEY` secure (defaults to "lm-studio")
2. **Input Validation**: MCPBridge validates all tool arguments
3. **Error Messages**: Detailed errors are logged but sanitized in responses to frontend
4. **CORS**: Configured to allow all origins (consider restricting in production)

## Future Enhancements

1. **Tool Streaming**: Stream responses as they're generated
2. **Multi-Device Support**: Handle multiple MCP servers
3. **Tool Customization**: Allow users to configure tool parameters
4. **Conversation Export**: Save/load conversation history
5. **Analytics**: Track tool usage and performance metrics
6. **Voice Input**: Add speech-to-text for hands-free control
7. **Real-time Monitoring**: WebSocket connection for live device status updates

## Files Modified/Created

**Created:**

- `synapticon-llm-express/src/services/mcpBridge.ts`
- `synapticon-llm-express/src/routes/mcpToolsRoute.ts`
- `LLM_UI/src/app/services/mcp-llm.service.ts`
- `LLM_UI/src/app/mcp-chat/mcp-chat.component.ts`
- `LLM_UI/src/app/mcp-chat/mcp-chat.component.html`
- `LLM_UI/src/app/mcp-chat/mcp-chat.component.scss`
- `LLM_UI/src/app/mcp-chat/mcp-chat.component.spec.ts`

**Modified:**

- `synapticon-llm-express/src/server.ts` (added MCP routes)
- `LLM_UI/src/app/app.routes.ts` (added MCP chat route)

## Support

For issues or questions:

1. Check the logs in each service
2. Enable debug mode by setting `DEBUG=*` in environment
3. Review the error messages and troubleshooting section above
4. Check that all services are properly started and connected
