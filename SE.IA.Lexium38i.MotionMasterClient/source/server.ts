import { LexiumLogger } from "./services/LexiumLogger";
import { PortProvider } from "./services/PortProvider";
import { MotionMasterStartup } from "./MotionMasterStartup";

LexiumLogger.init();

const portProvider = new PortProvider();
(async () => {
  const EXPRESS_DEFAULT_PORT = 8036;
  const GRPC_DEFAULT_PORT = 30043;
  const WEBSOCKET_DEFAULT_PORT = 8081;
  const expressServerPort = await portProvider.getAvailablePort(EXPRESS_DEFAULT_PORT);
  const gRPCServerPort = await portProvider.getAvailablePort(GRPC_DEFAULT_PORT);
  const wsPort = await portProvider.getAvailablePort(WEBSOCKET_DEFAULT_PORT);

  LexiumLogger.info("Express server port is " + expressServerPort);
  LexiumLogger.info("gRPC server port is " + gRPCServerPort);
  LexiumLogger.info("WebSocket server port is " + wsPort);

  try {
    const motionMasterStartup = new MotionMasterStartup(expressServerPort, gRPCServerPort, wsPort);
    await motionMasterStartup.start();
    LexiumLogger.info("server is started");
  } catch (err) {
    LexiumLogger.error("Error in Startwebapiserver", err);
  }
})();
