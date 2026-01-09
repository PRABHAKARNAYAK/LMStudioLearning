import { ProtocolEndPoint, ServiceLocator } from "@SET/se.ia.maf.servicelocator";
import motionMasterClientRoutes from "./controllers/motionMasterClientApi";
import Lexium38iParameterInfoApi from "./controllers/Lexium38iParameterInfoApi";
import motionMasterClientApiRouter from "./routes/motionMasterClientApiRoute";
import { createServer, Server as HttpServer } from "node:http";
import express, { Express } from "express";
import path from "node:path";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
const protoFilePath = path.join(__dirname, "./assets/protos/GroupInfo.proto");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
import { Server as SocketIoServer } from "socket.io";
import { setIO } from "./webSockets/ioManager";
import startDiscoveryRoute from "./routes/StartDiscoveryRoute";
import { WebSocketManager } from "./webSockets/webSocketManager";
import { LexiumLogger } from "./services/LexiumLogger";
import { createMcpServer } from "./mcpServer";

export class MotionMasterStartup {
  private readonly _port: number = 8036;
  private readonly _wsPort: number = 8081;
  private readonly _gRPCServerPort: number = 6789;
  private readonly _serviceId = "Lexium38i_BIC@1.0.0:services:SE.IA.Lexium38i.MotionMasterClient@1.0.0";
  private readonly _sl: ServiceLocator;
  private readonly _config: any = {};
  private readonly _app: Express;
  private readonly _grpcServer;
  private readonly _socketIoServer: SocketIoServer;
  private readonly _httpServer: HttpServer;
  private readonly _mcpServer: ReturnType<typeof createMcpServer>;
  private readonly _mcpSessions: Map<string, StreamableHTTPServerTransport> = new Map();

  private readonly _protocolEndPoint: ProtocolEndPoint;
  private readonly _grpcprotocolEndPoint: ProtocolEndPoint;
  private readonly _wsprotocolEndPoint: ProtocolEndPoint;

  constructor(expressServerPort: number, gRPCServerPort: number, wsPort: number) {
    this._app = express();
    this._httpServer = createServer(this._app);
    this._socketIoServer = new SocketIoServer(this._httpServer, {
      cors: { origin: "*" },
    });

    this._port = expressServerPort;
    this._gRPCServerPort = gRPCServerPort;
    this._wsPort = wsPort;

    WebSocketManager.initWebSocketServer(this._wsPort);

    this._protocolEndPoint = new ProtocolEndPoint("http", "http://localhost:" + this._port, "1.1");
    this._grpcprotocolEndPoint = new ProtocolEndPoint("GRPC/HTTP", "http://127.0.0.1:" + this._gRPCServerPort, "2.0");
    this._wsprotocolEndPoint = new ProtocolEndPoint("WebSocket", "ws://localhost:" + this._wsPort, "1.1");
    this._protocolEndPoint.MaxRequestBodySize = 28;
    this._grpcprotocolEndPoint.MaxRequestBodySize = 28;
    this._config["isContainer"] = "false";

    this._sl = new ServiceLocator(this._serviceId, [this._protocolEndPoint, this._grpcprotocolEndPoint, this._wsprotocolEndPoint], this._config);

    this._grpcServer = new grpc.Server();

    // Initialize MCP Server with dynamic base URL
    const baseUrl = `http://localhost:${this._port}`;
    this._mcpServer = createMcpServer(baseUrl);

    // Setup MCP HTTP endpoint on express app
    this.setupMcpHttpEndpoint();

    this.subscribeToExpressServerEvents();
    this.addGrpServices();
    this.subscribeToSLEvents();
    setIO(this._socketIoServer);
  }

  async start() {
    await this._grpcServer.bindAsync(`127.0.0.1:${this._gRPCServerPort}`, grpc.ServerCredentials.createInsecure(), () => {
      LexiumLogger.info(`gRPC Server running at http://127.0.0.1:${this._gRPCServerPort}`);
    });

    this._httpServer.listen(this._port, () => {
      LexiumLogger.info(`Server is running on http://localhost:${this._port}`);
      LexiumLogger.info("MCP HTTP endpoint available at http://localhost:" + this._port + "/mcp");
      LexiumLogger.info("Motion Master MCP Server initialized and ready for tool calls");
    });

    // Start ServiceLocator in the background without waiting for it
    // This prevents the process from hanging if ServiceLocator times out
    this.startServiceLocatorAsync();
  }

  private async startServiceLocatorAsync() {
    try {
      LexiumLogger.info("Starting ServiceLocator from service");

      const connected = new Promise<void>((resolve, reject) => {
        this._sl.onConnectedEvent = () => {
          LexiumLogger.info(`ServiceLocatorProvider: ServiceLocator connected with serviceId ${this._serviceId}`);
          resolve();
        };

        // Add a timeout in case ServiceLocator never connects
        const timeout = setTimeout(() => {
          reject(new Error("ServiceLocator connection timeout after 30 seconds"));
        }, 30000);
      });

      await this._sl.startAsync();
      await connected;

      LexiumLogger.info("ServiceLocator startup successful");
      LexiumLogger.info("Motion Master MCP Server initialized and running on HTTP transport");
    } catch (err) {
      LexiumLogger.warn(`ServiceLocator startup failed (MCP server will still work): ${err instanceof Error ? err.message : String(err)}`);
      // Don't exit - let the MCP server continue running even if ServiceLocator fails
      // The MCP server HTTP endpoint will still be available
    }
  }

  private setupMcpHttpEndpoint() {
    // Enable JSON parsing for MCP requests
    this._app.use(express.json());

    // MCP HTTP endpoint
    this._app.all("/mcp", async (req, res) => {
      try {
        const incomingSessionId = req.headers["mcp-session-id"] as string | undefined;

        LexiumLogger.verbose(`[MCP] Request: ${req.method} ${req.path}, sessionId: ${incomingSessionId}, body.method: ${(req.body as any)?.method}`);

        let transport = incomingSessionId ? this._mcpSessions.get(incomingSessionId) : undefined;

        // Create new session on initialize
        if (!transport && req.method === "POST" && (req.body as any)?.method === "initialize") {
          // Generate a new session ID explicitly
          const newSessionId = randomUUID();

          LexiumLogger.info(`[MCP] Creating new session: ${newSessionId}`);

          transport = new StreamableHTTPServerTransport({
            enableJsonResponse: true,
            sessionIdGenerator: () => newSessionId,
          });

          // Store the session BEFORE handling the request
          this._mcpSessions.set(newSessionId, transport);
          LexiumLogger.info(`[MCP] Session stored in map. Total sessions: ${this._mcpSessions.size}`);

          // Connect the MCP server to the transport
          await this._mcpServer.connect(transport);

          // Set the session ID header BEFORE calling handleRequest
          res.setHeader("mcp-session-id", newSessionId);
          res.setHeader("Content-Type", "application/json");

          // Handle the initialize request
          await transport.handleRequest(req, res, req.body);

          LexiumLogger.info(`[MCP] Initialize request handled for session: ${newSessionId}`);
          return;
        }

        // Handle existing session
        if (transport) {
          LexiumLogger.verbose(`[MCP] Using existing session: ${incomingSessionId}`);

          if (req.method === "DELETE") {
            res.setHeader("Content-Type", "application/json");
            await transport.handleRequest(req, res);
            transport.close();
            this._mcpSessions.delete(incomingSessionId!);
            LexiumLogger.info(`[MCP] Session closed: ${incomingSessionId}`);
          } else if (req.method === "GET") {
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
            await transport.handleRequest(req, res);
          } else if (req.method === "POST") {
            res.setHeader("Content-Type", "application/json");
            // Pass the request body for POST requests
            await transport.handleRequest(req, res, req.body);
          } else {
            res.setHeader("Content-Type", "application/json");
            await transport.handleRequest(req, res);
          }
          return;
        }

        // Session not found
        if (incomingSessionId) {
          LexiumLogger.warn(`[MCP] Session not found: ${incomingSessionId}. Available sessions: ${Array.from(this._mcpSessions.keys()).join(", ") || "none"}`);
        } else {
          LexiumLogger.warn(`[MCP] Request without session ID received for non-initialize method: ${(req.body as any)?.method}`);
        }

        res.setHeader("Content-Type", "application/json");
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32600, message: `Session not found. Available: ${Array.from(this._mcpSessions.keys()).join(", ")}` },
          id: (req.body as any)?.id || null,
        });
      } catch (err) {
        LexiumLogger.error("Error in MCP HTTP endpoint:", err instanceof Error ? err.message : String(err));
        if (!res.headersSent) {
          res.setHeader("Content-Type", "application/json");
          res.status(500).json({
            jsonrpc: "2.0",
            error: { code: -32000, message: `Internal server error: ${err instanceof Error ? err.message : "Unknown error"}` },
            id: (req.body as any)?.id || null,
          });
        }
      }
    });

    LexiumLogger.info(`MCP HTTP endpoint available at http://localhost:${this._port}/mcp`);

    // Debugging endpoint to list available tools
    this._app.get("/mcp/tools", async (req, res) => {
      try {
        res.setHeader("Content-Type", "application/json");
        // Create a request to list tools via MCP protocol
        const listToolsRequest = {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        };

        // Try to get tools from the server
        res.json({
          status: "ok",
          message: "This server supports MCP protocol with 28 registered tools",
          tools: [
            "ping",
            "getGroupInfo",
            "getControlPanelInfo",
            "getDefaultParameterInfo",
            "startHoming",
            "startPositionProfile",
            "startVelocityProfile",
            "startTorqueProfile",
            "releaseControl",
            "startDiagnostics",
            "resetFault",
            "getDiagnosticStatus",
            "getErrorAndWarningData",
            "getCia402State",
            "startSystemIdentification",
            "getSystemIdentificationData",
            "getPositionTuningInfo",
            "startPositionAutoTuning",
            "getVelocityTuningInfo",
            "startVelocityAutoTuning",
            "getTorqueTuningInfo",
            "computePositionGains",
            "computeVelocityGains",
            "getTuningTrajectoryInfo",
            "startSignalGenerator",
            "stopSignalGenerator",
            "startDeviceDiscovery",
            "getDiscoveryStatus",
          ],
          note: "Use MCP protocol HTTP endpoint at /mcp to interact with these tools. Send initialize request with session ID header to start.",
        });
      } catch (err) {
        LexiumLogger.error("Error listing tools:", err);
        res.status(500).json({ error: "Failed to list tools" });
      }
    });

    // Debugging endpoint to check server status
    this._app.get("/mcp/status", async (req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.json({
        status: "ok",
        mcp: "initialized",
        sessions: this._mcpSessions.size,
        port: this._port,
      });
    });
  }

  private addGrpServices() {
    const packageDefinition = protoLoader.loadSync(protoFilePath, {
      keepCase: true,
      longs: String,
      enums: String,
      arrays: true,
    });
    const groupInfoProto = grpc.loadPackageDefinition(packageDefinition);
    this._grpcServer.addService(groupInfoProto.SchneiderElectric.Automation.Sodb.Messages.GroupInfoService.service, {
      getParametersDetail: async function (call, callback) {
        const deviceRef = "1";
        const groupInfo = await Lexium38iParameterInfoApi.getGroupInfo(deviceRef, call.request.groupId);
        callback(null, groupInfo);
      },
    });
  }

  private subscribeToSLEvents() {
    this._sl.onConnectedEvent = (sender: any, eventArgs: string) => {
      LexiumLogger.info("SERVICE is Connected with service orchestrator: " + eventArgs);
      // Start the server and listen on the specified port
    };
    this._sl.onDisconnectEvent = (sender: any, eventArgs: string) => {
      LexiumLogger.info("SERVICE is Disconnected from service orchestrator: " + eventArgs);
    };
  }

  private subscribeToExpressServerEvents() {
    // when this server is closed, close the log file
    this._app.on("close", () => {
      LexiumLogger.info("EXPRESS Server is closing");
    });

    this._app.use(cors());

    this._app.use("/motionMasterClient", motionMasterClientRoutes);
    this._app.use("/parameterConfig", motionMasterClientApiRouter);
    this._app.use("/startMaster", startDiscoveryRoute);

    // Define a route for the root path ('/')
    this._app.get("/", (req, res) => {
      // Send a response to the client
      res.send("Hello, from service");
    });

    this._app.get("/status", (req, res) => {
      res.send("Service up...");
    });

    this._app.get("/serviceModel", async (req, res) => {
      // Send a response to the client
      const sid = req.query["sm"] as string | undefined;
      let isOrcestratedFlag: boolean = false;
      if (req.query["isOrcestrated"] && req.query["isOrcestrated"] === "true") {
        isOrcestratedFlag = true;
      }
      LexiumLogger.info(`received sm: ${sid}`);
      LexiumLogger.info("received isOrcestrated", isOrcestratedFlag);
      if (sid) {
        try {
          LexiumLogger.info("Getting service model");
          const sm3 = await this._sl.getServiceModelAsync(sid, isOrcestratedFlag);
          LexiumLogger.info("GetserviceModelResponse", JSON.stringify(sm3));
          res.send("Hello, Received service model" + JSON.stringify(sm3));
        } catch (err) {
          res.send("error in receiving service model" + err);
        }
      }
    });
  }
}
