import { NotificationInfo } from "../model/notificationInfo";
import { Constants } from "../utility/constants";
import { SocketBroadcaster } from "../webSockets/SocketBroadcaster";

/**
 * Handles sending notification events to connected clients via IO.
 *
 * Provides static methods to emit snack bar notifications and custom notifications
 * using a specified notification ID. Notifications are serialized to JSON before emission.
 */
class NotificationHandler {
  /**
   * Sends a snackbar notification to connected clients via socket IO.
   *
   * @param notificationInfo - The information about the notification to be sent.
   */
  public static sendSnackBarNotification(notificationInfo: NotificationInfo): void {
    SocketBroadcaster.broadcast(Constants.SnackBarNotificationReceived, JSON.stringify(notificationInfo));
  }

  public static sendNotification(notificationId: string, notificationInfo: NotificationInfo): void {
    SocketBroadcaster.broadcast(notificationId, JSON.stringify(notificationInfo));
  }
}
export default NotificationHandler;
