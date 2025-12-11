import { Server as WebSocketServer, WebSocket } from "ws";
import { Server as HttpServer, createServer } from "node:http";
import { MotionMasterClientFunctions } from "../controllers/MotionMasterClientFunctions";
import { LexiumLogger } from "../services/LexiumLogger";

export class WebSocketManager {
  private static wsServer: WebSocketServer | null = null;
  private static httpServer: HttpServer | null = null;

  /**
   * Initializes the WebSocket server on a dedicated port.
   * If not already initialized, creates a new HTTP server and attaches ws to it.
   */
  static initWebSocketServer(port: number): WebSocketServer {
    try {
      if (!WebSocketManager.wsServer) {
        WebSocketManager.httpServer = createServer();
        WebSocketManager.wsServer = new WebSocketServer({ server: WebSocketManager.httpServer });
        WebSocketManager.httpServer.listen(port, () => {
          LexiumLogger.info(`WebSocket HTTP server listening on port ${port}`);
        });
        WebSocketManager.wsServer.on("connection", (socket: WebSocket) => {
          LexiumLogger.info("New WebSocket connection established");

          // Heartbeat logic
          const sendHeartbeat = () => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ event: "heartbeat", data: "ping" }));
            }
          };
          const HEARTBEAT_INTERVAL_MS = 5000;
          const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

          socket.on("message", (message: unknown) => {
            try {
              const { event, data } = JSON.parse((message as string)?.toString());
              LexiumLogger.info(`Received event: ${event}, data: ${data}`);
              //To Do: remove the customEvent1 and implement actual events handling logic here, when needed to send to respective clients.
              WebSocketManager.sendCustomEvent(socket, "customEvent", "Response from server");
            } catch (err) {
              LexiumLogger.error("Invalid message:", message);
              LexiumLogger.error("Error details:", err);
            }
          });

          socket.on("close", () => {
            LexiumLogger.info("Client disconnected");
            MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance().disconnectClient();
            clearInterval(interval);
          });
        });
        LexiumLogger.info("WebSocket server initialized on its own HTTP server");
      }
      return WebSocketManager.wsServer;
    } catch (error) {
      LexiumLogger.error("Failed to initialize WebSocket server:", error);
      throw error;
    }
  }

  /**
   * Returns the WebSocket server instance, or throws if not initialized.
   */
  static getWebSocketServer(): WebSocketServer {
    if (!WebSocketManager.wsServer) {
      throw new Error("WebSocket server has not been initialized. Call initWebSocketServer first.");
    }
    return WebSocketManager.wsServer;
  }

  /**
   * Sends a custom event to a WebSocket client.
   */
  static sendCustomEvent(socket: WebSocket, event: string, data: unknown) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ event, data }));
    }
  }

  /**
   * Broadcasts a custom event to all connected WebSocket clients.
   */
  static broadcastCustomEvent(event: string, data: unknown) {
    if (!WebSocketManager.wsServer) {
      throw new Error("WebSocket server has not been initialized. Call initWebSocketServer first.");
    }
    for (const client of WebSocketManager.wsServer.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ event, data }));
      }
    }
  }
}
