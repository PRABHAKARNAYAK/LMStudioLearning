import { getIO } from "./ioManager";
import { WebSocketManager } from "./webSocketManager";

/**
 * Utility class to broadcast events to both Socket.IO and custom WebSocketManager.
 */
export class SocketBroadcaster {
  /**
   * Broadcasts an event and payload to both Socket.IO and WebSocketManager.
   * @param event Event name
   * @param payload Data to send
   */
  static broadcast(event: string, payload: unknown): void {
    getIO()?.emit(event, payload);
    WebSocketManager.broadcastCustomEvent?.(event, payload);
  }
}
