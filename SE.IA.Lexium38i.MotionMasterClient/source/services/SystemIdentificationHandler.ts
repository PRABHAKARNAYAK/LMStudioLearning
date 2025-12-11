import { DeviceRef, StartSystemIdentificationRequest, SystemIdentificationStatus } from "motion-master-client";
import { MotionMasterClientFunctions } from "../controllers/MotionMasterClientFunctions";
import { LexiumLogger } from "./LexiumLogger";
import { NotificationType } from "../model/notificationInfo";
import { lastValueFrom } from "rxjs";
import NotificationHandler from "./NotificationHandler";
import { Constants } from "../utility/constants";

const MSG_STARTED = "System identification procedure started.";
const MSG_IN_PROGRESS = "System identification procedure is in progress.";
const MSG_COMPLETED = "System identification procedure completed successfully.";
const MSG_FILE_FAILED = "Failed to retrieve plant model file from device.";

/**
 * Singleton service class responsible for handling system identification and tuning procedures
 * for Lexium38i devices via the MotionMaster client.
 *
 * Provides methods to:
 * - Retrieve system identification data (plant model file) from a device.
 * - Start and monitor the system identification/tuning procedure.
 * - Send notifications about the progress and results of tuning operations.
 *
 * Utilizes MotionMasterClientFunctions for device communication and LexiumLogger for logging.
 */
export class SystemIdentificationHandler {
  private static instance: SystemIdentificationHandler;

  private readonly mmClient = MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance();

  private constructor() {}

  public static getInstance(): SystemIdentificationHandler {
    if (!SystemIdentificationHandler.instance) {
      SystemIdentificationHandler.instance = new SystemIdentificationHandler();
    }
    return SystemIdentificationHandler.instance;
  }

  /**
   * Retrieves the system identification data (plant model) from the specified device.
   *
   * @param deviceRef - Reference to the target device from which to retrieve the plant model file.
   * @returns A promise that resolves to the contents of the plant model CSV file as a string.
   *
   * @remarks
   * If the MotionMaster client is not initialized or the file retrieval fails, an error is logged and a notification is sent.
   * In case of failure, the returned string will be empty.
   */
  public async getSystemIdentificationData(deviceRef: DeviceRef): Promise<string> {
    let plantModelFileContent = "";
    try {
      if (!this.mmClient.client) {
        throw new Error(`${Constants.ClientNotConnected}`);
      }
      plantModelFileContent = await lastValueFrom(this.mmClient.client.request.getDecodedFile(deviceRef, "plant_model.csv"));
    } catch (fileError) {
      let errorDetail: string;
      if (typeof fileError === "string") {
        errorDetail = fileError;
      } else {
        errorDetail = fileError?.message || MSG_FILE_FAILED;
      }
      LexiumLogger.error(`Failed to retrieve plant model file from device ${deviceRef}: ${errorDetail}`);
      this.sendNotification(Constants.SYSTEM_IDENTIFICATION, errorDetail, NotificationType.error);
    }
    return plantModelFileContent;
  }

  /**
   * Initiates the tuning procedure for a specified device using the provided system identification request.
   *
   * @param deviceRef - Reference to the target device for tuning.
   * @param startSystemIdentificationRequest - The request payload containing parameters for system identification.
   * @returns A promise that resolves with a status message upon successful completion or rejects with an error message if the procedure fails.
   *
   * @remarks
   * This method interacts with the MotionMaster client to start the system identification process.
   * Notifications are sent for warnings and errors during the procedure.
   */
  public async startSystemIdentificationProcedure(deviceRef: DeviceRef, startSystemIdentificationRequest: StartSystemIdentificationRequest): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const identificationTimeout = 30000;
      if (!this.mmClient.client) {
        reject(new Error(`${Constants.ClientNotConnected}`));
        return;
      }
      this.mmClient.client.request.startSystemIdentification(startSystemIdentificationRequest, identificationTimeout).subscribe({
        next: (status: SystemIdentificationStatus) => {
          if (status.warning) {
            this.sendNotification(Constants.SYSTEM_IDENTIFICATION, status.warning.message ?? MSG_IN_PROGRESS, NotificationType.warning);
          }

          this.handleStatus(deviceRef, status, resolve, reject);
        },
        error: (error: unknown) => {
          this.handleError(error, reject);
        },
      });
    });
  }

  private handleError(error: unknown, reject: (reason?: any) => void) {
    let errorMessage: string;
    if (typeof error === "string") {
      errorMessage = error;
    } else {
      errorMessage = (error as { message?: string })?.message || Constants.SYS_IDENTIFICATION_MSG_FAILED;
    }
    LexiumLogger.error(`Error in starting system identification: ${JSON.stringify(error)}`);
    this.sendNotification(Constants.SYSTEM_IDENTIFICATION, Constants.SYS_IDENTIFICATION_MSG_FAILED, NotificationType.error);
    reject(new Error(errorMessage));
  }

  private handleStatus(deviceRef: DeviceRef, status: SystemIdentificationStatus, resolve: (value: string | PromiseLike<string>) => void, reject: (reason?: unknown) => void) {
    switch (status.request) {
      case "succeeded":
        this.handleSucceeded(deviceRef, status, resolve, reject);
        break;
      case "started":
        this.sendNotification(Constants.SYSTEM_IDENTIFICATION, MSG_STARTED, NotificationType.info);
        break;
      case "running":
        this.sendNotification(Constants.SYSTEM_IDENTIFICATION, MSG_IN_PROGRESS, NotificationType.info);
        break;
      case "failed":
        this.sendNotification(Constants.SYSTEM_IDENTIFICATION, status.error?.message ?? Constants.SYS_IDENTIFICATION_MSG_FAILED, NotificationType.error);
        reject(new Error(status.error?.message ?? Constants.SYS_IDENTIFICATION_MSG_FAILED));
        break;
      default:
        break;
    }
  }

  private handleSucceeded(deviceRef: DeviceRef, status: SystemIdentificationStatus, resolve: (value: string | PromiseLike<string>) => void, reject: (reason?: unknown) => void) {
    if (!this.mmClient.client) {
      this.sendNotification(Constants.SYSTEM_IDENTIFICATION, Constants.ClientNotConnected, NotificationType.error);
      reject(new Error(Constants.ClientNotConnected));
      return;
    }
    lastValueFrom(this.mmClient.client.request.getDecodedFile(deviceRef, "plant_model.csv"))
      .then((plantModelFileContent: string) => {
        this.sendNotification(Constants.SYSTEM_IDENTIFICATION, status.success?.message ?? MSG_COMPLETED, NotificationType.success);
        resolve(plantModelFileContent);
      })
      .catch((fileError: unknown) => {
        this.sendNotification(Constants.SYSTEM_IDENTIFICATION, MSG_FILE_FAILED, NotificationType.error);
        let errorMsg: string;
        if (typeof fileError === "string") {
          errorMsg = fileError;
        } else if (fileError && typeof fileError === "object" && "message" in fileError) {
          errorMsg = (fileError as { message?: string }).message || MSG_FILE_FAILED;
        } else {
          errorMsg = MSG_FILE_FAILED;
        }
        reject(new Error(errorMsg));
      });
  }

  private sendNotification(title: string, description: string, type: NotificationType) {
    NotificationHandler.sendSnackBarNotification({
      message: { title, description },
      type,
    });
  }
}
