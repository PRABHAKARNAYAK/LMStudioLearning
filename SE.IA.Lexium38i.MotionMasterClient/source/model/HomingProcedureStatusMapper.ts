import { RequestStatus } from "motion-master-client";
import { MessageInfo, NotificationInfo, NotificationType } from "./notificationInfo";

const started = "Homing procedure started.";
const running = "Homing procedure running.";
const succeeded = "Homing procedure completed successfully.";
const failed = "Homing procedure failed.";

/**
 * Maps homing procedure request statuses to corresponding notification information.
 * Provides message details and notification type for each status.
 */
export class HomingProcedureStatusMapper {
  message: MessageInfo = { title: "Homing", description: started };

  /**
   * Maps each RequestStatus to its corresponding NotificationInfo for the homing procedure.
   * Used to provide appropriate notification messages and types based on the current status.
   */
  public static readonly requestStatus: Record<RequestStatus, NotificationInfo> = {
    started: { message: { title: "Homing", description: started }, type: NotificationType.info },
    running: { message: { title: "Homing", description: running }, type: NotificationType.info },
    failed: { message: { title: "Homing", description: failed }, type: NotificationType.error },
    succeeded: { message: { title: "Homing", description: succeeded }, type: NotificationType.success },
  };
}
