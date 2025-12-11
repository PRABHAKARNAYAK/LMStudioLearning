import { ProtocolEndPoint, ServiceLocator } from "@SET/se.ia.maf.servicelocator";
import motionMasterClientRoutes from "./controllers/motionMasterClientApi";
import Lexium38iParameterInfoApi from "./controllers/Lexium38iParameterInfoApi";
import motionMasterClientApiRouter from "./routes/motionMasterClientApiRoute";
import { createServer, Server as HttpServer } from "http";
import express, { Express } from "express";
import path from "node:path";
import cors from "cors";
const protoFilePath = path.join(__dirname, "./assets/protos/GroupInfo.proto");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
import { Server as SocketIoServer } from "socket.io";
import { setIO } from "./webSockets/ioManager";
import startDiscoveryRoute from "./routes/StartDiscoveryRoute";
import { WebSocketManager } from "./webSockets/webSocketManager";
import { LexiumLogger } from "./services/LexiumLogger";

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

    this.subscribeToExpressServerEvents();
    this.addGrpServices();
    this.subscribeToSLEvents();
    setIO(this._socketIoServer);
  }

  async start() {
    await this._grpcServer.bindAsync(`127.0.0.1:${this._gRPCServerPort}`, grpc.ServerCredentials.createInsecure(), () => {
      LexiumLogger.info(`gRPC Server running at http://127.0.0.1:${this._gRPCServerPort}`);
    });

    this._httpServer.listen(this._port, async () => {
      LexiumLogger.info(`Server is running on http://localhost:${this._port}`);
      LexiumLogger.info("Starting ServiceLocator from service");
    });

    try {
      const connected = new Promise<void>((resolve) => {
        this._sl.onConnectedEvent = () => {
          LexiumLogger.info(`ServiceLocatorProvider: ServiceLocator connected with serviceId ${this._serviceId}`);
          resolve();
        };
      });
      await this._sl.startAsync();
      await connected;

      LexiumLogger.info("wait is over, SL is started");
    } catch (err) {
      LexiumLogger.error("Error in start SL", err);
    }
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
      const sid = req.query["sm"];
      let isOrcestratedFlag: boolean = false;
      if (req.query["isOrcestrated"] && req.query["isOrcestrated"] === "true") {
        isOrcestratedFlag = true;
      }
      LexiumLogger.info("received sm: " + sid);
      LexiumLogger.info("received isOrcestrated", isOrcestratedFlag);
      if (sid) {
        try {
          LexiumLogger.info("Getting service model");
          const sm3 = await this._sl.getServiceModelAsync(sid as string, isOrcestratedFlag);
          LexiumLogger.info("GetserviceModelResponse", JSON.stringify(sm3));
          res.send("Hello, Received service model" + JSON.stringify(sm3));
        } catch (err) {
          res.send("error in receiving service model" + err);
        }
      }
    });
  }
}
