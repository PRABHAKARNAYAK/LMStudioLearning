# LM Studio Learning - MCP Server & LLM Chat Integration

This is a complete integration of the Motion Master Client MCP Server with the LM Studio `meta-llama-3.1-8b-instruct` chat model, featuring a beautiful Angular chat UI for natural language control of servo drives.

## 📚 Quick Navigation

**Start here:** Read [QUICK_START.md](QUICK_START.md) (5 minutes)

Then choose:

- **Complete Setup Guide:** [MCP_INTEGRATION_README.md](MCP_INTEGRATION_README.md)
- **What Was Built:** [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
- **Visual Diagrams:** [ARCHITECTURE_DIAGRAMS.md](ARCHITECTURE_DIAGRAMS.md)
- **Code Examples:** [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)
- **File Inventory:** [FILES_SUMMARY.md](FILES_SUMMARY.md)

## 🏗️ System Architecture

```
User Browser
   (Angular Chat UI - Port 4200)
         ↓ HTTP/JSON
    ┌─────────────────┐
    │ Express Backend │ (Port 3001)
    │   /api/mcp/*    │
    └────────┬────────┘
             │
      ┌──────┴──────┬──────────┐
      ↓             ↓          ↓
   LM Studio    MCP Server   Other APIs
   (Port 1234)  (Port 8036)   (as needed)
      ↓             ↓
   • Chat API   • 29 Tools
   • Tool Call  • Device Mgmt
   • Models     • Servo Control
```

## 🚀 Quick Start

**See [QUICK_START.md](QUICK_START.md) for complete instructions**

### TL;DR (4 Terminals)

**Terminal 1: MCP Server**

```bash
cd SE.IA.Lexium38i.MotionMasterClient
npm install && npm run build && npm run start
```

**Terminal 2: Express Backend**

```bash
cd synapticon-llm-express
npm install && npm run build && npm run start
```

**Terminal 3: Angular Frontend**

```bash
cd LLM_UI
npm install && ng serve
```

**Terminal 4: LM Studio**

- Launch LM Studio app
- Load `meta-llama-3.1-8b-instruct`
- Start server (default port 1234)

Then visit: **http://localhost:4200/mcp-chat**

### Previous Quick Start

### Option 1: Automated (Recommended)

```powershell
.\start-servers.ps1
```

This script will:

1. Start Mock Backend API (Port 4000)
2. Start MCP Server (Port 3000)
3. Start Angular Frontend (Port 4200)
4. Open http://localhost:4200 in your browser

### Option 2: Manual

```powershell
# Terminal 1
cd MCP_Server
npm run dev:mock

# Terminal 2
cd MCP_Server
npm run dev:http

# Terminal 3
cd LLM_UI
npm start
```

### Stop Servers

```powershell
.\stop-servers.ps1
```

## ✅ Verification

All three ports should be listening:

```powershell
netstat -ano | findstr ":3000 :4000 :4200"
```

Expected output:

```
TCP    0.0.0.0:4000    LISTENING    ← Mock Backend
TCP    0.0.0.0:3000    LISTENING    ← MCP Server
TCP    [::1]:4200      LISTENING    ← Angular App
```

## 🧩 What Each Service Does

**Mock Backend (Port 4000):** Simulates servo hardware, maintains device state, responds to control commands, returns mock sensor data.

**MCP Server (Port 3000):** Implements Model Context Protocol, manages sessions, translates MCP tool calls to REST API, provides CORS headers.

**Angular Frontend (Port 4200):** User interface, MCP protocol client, real-time device monitoring, control panels for motion, parameters, trajectories.

## ✨ Features

✅ Device scanning and discovery
✅ Real-time status monitoring
✅ Motion control (home, move, jog, stop)
✅ Parameter configuration
✅ Trajectory execution
✅ Diagnostics display
✅ Auto-refresh toggle
✅ Error handling and user feedback

## 📝 Next Steps

1. **Start the system:** Run `./start-servers.ps1`
2. **Test the UI:** Open http://localhost:4200
3. **Scan devices:** Click the Refresh button
4. **Select a device:** Click on a device card
5. **Try controls:** Test home, move, jog commands

## 🔄 Replacing Mock Backend

To use real hardware instead of mock:

1. Deploy your real backend API on port 4000
2. Implement the same endpoints as `mock-backend.ts`
3. Update `MCP_Server/.env` if needed:
   ```
   API_BASE_URL=http://your-real-api:4000
   ```
4. Restart the MCP Server

The Angular frontend and MCP Server require no changes!

---

## 📚 Documentation

- [STARTUP_GUIDE.md](STARTUP_GUIDE.md) - How to start and manage servers
- [SOLUTION_SUMMARY.md](SOLUTION_SUMMARY.md) - Problem and solution summary
- [LLM_UI/QUICKSTART.md](LLM_UI/QUICKSTART.md) - Angular app guide
- [LLM_UI/MCP_FRONTEND_README.md](LLM_UI/MCP_FRONTEND_README.md) - Frontend documentation

---

## Alternative: MotionMaster API (Legacy)

See previous README versions for legacy MotionMaster API and LLM integration instructions.
