# Latest Changes - Example Value Validation

## 🔧 Problem Statement

The LLM was inferring dummy device references (like "servo-01", "device-001") instead of asking users for actual device identifiers when calling device-specific tools.

## ✅ Solution Implemented

### 1. **Runtime Parameter Validation**

Added `isExampleValue()` function to detect common placeholder patterns:

- Device reference patterns: `servo-01`, `device-001`, `motor-1`, `actuator-1`, etc.
- Prefix patterns: `example`, `demo`, `test`, `sample`
- Returns validation error to LLM asking for real user-provided values

**Location:** [mcpToolsRoute.ts](synapticon-llm-express/src/routes/mcpToolsRoute.ts#L12-L33)

```typescript
function isExampleValue(toolName: string, paramName: string, value: any): boolean {
  if (typeof value !== "string") return false;

  if (paramName === "deviceRef") {
    const examplePatterns = [/^(servo|device|motor|actuator|axis)[-_]?\d+$/i, /^example/i, /^demo/i, /^test/i, /^sample/i];
    return examplePatterns.some((pattern) => pattern.test(value));
  }

  return false;
}
```

### 2. **Tool Execution Validation Loop**

Added parameter validation before tool execution:

- Check all tool arguments against `isExampleValue()`
- If example value detected, return error to LLM instead of executing
- Error message prompts LLM to ask user for real values

**Location:** [mcpToolsRoute.ts](synapticon-llm-express/src/routes/mcpToolsRoute.ts#L172-L206)

```typescript
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
```

### 3. **Enhanced System Prompt**

Strengthened LLM instructions with explicit guidance:

**New Sections Added:**

- **DEVICE DISCOVERY WORKFLOW**: Step-by-step instructions to call `discoverDevices()` first when device isn't specified
- **Device-specific examples**: Using MAC addresses to identify real devices
- **Explicit warnings** against dummy values repeated multiple times

**Location:** [mcpToolsRoute.ts](synapticon-llm-express/src/routes/mcpToolsRoute.ts#L93-L123)

Updated system prompt now includes:

```
DEVICE DISCOVERY WORKFLOW:
1. When user asks to operate on 'a device' without specifying which one, call discoverDevices() first
2. Show the user the list of available devices (MAC addresses and their details)
3. Ask the user to choose which device they want to use (by MAC address)
4. Wait for the user's device selection before proceeding with the actual operation
```

## 🎯 How It Works (Example Flow)

1. **User asks:** "Identify the servo"
2. **LLM attempts:** `startSystemIdentification({deviceRef: "servo-01"})`
3. **Validation catches:** `isExampleValue("startSystemIdentification", "deviceRef", "servo-01")` → TRUE
4. **Tool NOT executed**, instead returns error:
   ```json
   {
     "error": "Invalid parameter value: deviceRef=\"servo-01\". This appears to be an example value. Please ask the user to provide the actual value.",
     "hint": "For tools operating on devices, you MUST ask the user which device they want to operate on..."
   }
   ```
5. **LLM receives error** in second turn and now asks:
   "I need to know which device you want to identify. Let me first discover available devices..."
6. **LLM calls:** `discoverDevices()`
7. **Results show:** Available devices with MAC addresses
8. **User responds:** "Use the device at 10:3D:AC:FF:F0:00"
9. **LLM calls:** `startSystemIdentification({deviceRef: "10:3D:AC:FF:F0:00"})`
10. **Validation passes** and tool executes with real device reference

## 🔍 Detection Patterns

### Current Implementation (v1)

Only checks `deviceRef` parameter for example patterns:

- Regex: `/^(servo|device|motor|actuator|axis)[-_]?\d+$/i`
- Prefix checks: example, demo, test, sample

### Future Enhancements

Could extend to validate:

- MAC addresses (format: `AA:BB:CC:DD:EE:FF`)
- Profile names (ensure not "profile-1", "example-profile")
- Timeout values (ensure positive numbers)
- Any other parameter-specific validation rules

## 📝 Testing Instructions

### Test Case 1: Example Value Rejection

```
User: "Identify the servo"
Expected: LLM asks for device reference, calls discoverDevices(), waits for user input
Not Expected: LLM uses "servo-01" without asking
```

### Test Case 2: Real Device Success

```
User: "Identify device 10:3D:AC:FF:F0:00"
Expected: startSystemIdentification executes with real MAC address
Not Expected: Error returned (deviceRef passes validation)
```

### Test Case 3: Device Discovery First

```
User: "List available devices"
Expected: discoverDevices() called, devices displayed
Then: User provides device reference, LLM uses it in subsequent calls
```

## 🔐 Security Implications

- ✅ Prevents accidental tool execution with dummy values
- ✅ Forces explicit user confirmation of device targets
- ✅ Provides audit trail (validation errors logged)
- ✅ Prevents automation of dangerous operations with hardcoded values

## ✨ Build Status

```
✅ TypeScript compilation: SUCCESS
✅ No type errors
✅ Ready for testing
```

## 📚 Related Files

- [MCP Tools Route](synapticon-llm-express/src/routes/mcpToolsRoute.ts) - Main implementation
- [MCP Bridge Service](synapticon-llm-express/src/services/mcpBridge.ts) - Tool execution layer
- [System Prompt](synapticon-llm-express/src/routes/mcpToolsRoute.ts#L93-L123) - LLM instructions

## ⚠️ Known Limitations

1. **Detection only for `deviceRef`** - Other parameters not yet validated
2. **Simple pattern matching** - Doesn't detect all possible dummy values
3. **English-only patterns** - Patterns specific to common English conventions
4. **No whitespace handling** - Won't catch " servo-01" with leading spaces

## 🚀 Next Steps

1. Test device discovery workflow end-to-end
2. Verify LLM respects validation errors and asks for real values
3. Test with actual device MAC addresses
4. Monitor logs for validation error frequency
5. Consider extending validation to other parameter types if needed
