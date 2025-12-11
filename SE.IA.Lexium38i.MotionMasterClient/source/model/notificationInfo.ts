/**
 * Represents information about a notification, including its type and message details.
 *
 * @property type - The type of notification (e.g., error, warning, info).
 * @property message - The message details associated with the notification.
 */
export interface NotificationInfo {
  type: NotificationType;
  message: MessageInfo;
}

/**
 * Enum representing the types of notifications that can be displayed.
 *
 * @enum {number}
 * @property info - Informational notification.
 * @property warning - Warning notification.
 * @property error - Error notification.
 * @property success - Success notification.
 */
export enum NotificationType {
  info = 1,
  warning = 2,
  error = 3,
  success = 4,
}

/**
 * Represents information about a notification message, including its title, description,
 * and optional details for further information.
 *
 * @property title - The main heading or subject of the notification message.
 * @property description - A brief explanation or details about the notification.
 * @property moreInfoAvailable - Indicates whether additional information is available for this message.
 * @property moreInfoUrl - A URL pointing to further details about the notification, if available.
 */
export interface MessageInfo {
  title?: string;
  description: string;
  moreInfoAvailable?: boolean;
  moreInfoUrl?: string;
}
