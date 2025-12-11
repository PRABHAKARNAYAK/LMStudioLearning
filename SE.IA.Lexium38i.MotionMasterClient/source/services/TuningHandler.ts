import { AutoTuningStatus, ComputeAutoTuningGainsRequest, DeviceRef, FullAutoTuningStatus, StartFullAutoTuningRequest } from "motion-master-client";
import { MotionMasterClientFunctions } from "../controllers/MotionMasterClientFunctions";
import { LexiumLogger } from "./LexiumLogger";
import { TuningInfo, TuningModeInfo } from "../model/TuningInfo";
import { ParametersProcessingHandler } from "./ParametersProcessingHandler";
import ParametersMonitoringHandler from "./ParametersMonitoringHandler";
import NotificationHandler from "./NotificationHandler";
import { NotificationType } from "@LXM38I/se.ia.lexium38i.common.model";
import { Constants } from "../utility/constants";

const MSG_STARTED = "Tuning started.";
const MSG_IN_PROGRESS = "Tuning is in progress.";
const MSG_COMPLETED = "Tuning completed successfully.";

/**
 * Singleton handler for managing position tuning operations.
 *
 * The `TuningHandler` provides methods to load, process, and monitor position tuning configuration
 * for devices. It supports reading tuning modes from a JSON file, processing their input and monitoring
 * parameters, and initiating monitoring for a selected mode. Tuning operations are initiated via the
 * MotionMaster client, with notifications for progress, completion, warnings, and errors.
 *
 * Use `TuningHandler.getInstance()` to access the singleton instance.
 */
export class TuningHandler {
  private static instance: TuningHandler | null;
  /**
   * For testing: resets the singleton instance so dependencies can be mocked freshly.
   */
  public static resetInstance() {
    TuningHandler.instance = null;
  }

  private readonly mmClient = MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance();

  private readonly parametersProcessingHandler = ParametersProcessingHandler.getInstance();
  private readonly parametersMonitoringHandler = ParametersMonitoringHandler.getInstance();
  private constructor() {}

  public static getInstance(): TuningHandler {
    TuningHandler.instance ??= new TuningHandler();
    return TuningHandler.instance;
  }

  /**
   * Loads and processes position tuning configuration for a device.
   *
   * Reads tuning modes from a JSON file, processes their input and monitoring parameters,
   * and initiates monitoring for the selected mode. Returns the parsed tuning info.
   *
   * @param deviceRef - Reference to the device.
   * @param filePath - Path to the tuning configuration JSON file.
   * @param tuningMode - (Optional) Specific tuning mode to monitor.
   * @returns Promise resolving to the parsed TuningInfo.
   */
  public async getParsedTuningInfo(deviceRef: DeviceRef, filePath: string, tuningMode?: string): Promise<TuningInfo> {
    try {
      const tuningData = this.parametersProcessingHandler.getJsonData<TuningInfo>(filePath);

      for (const mode of tuningData.tuningModes) {
        if (mode?.inputParameters?.length) {
          await this.parametersProcessingHandler.processDeviceInputParameters(mode.inputParameters, deviceRef);
        }

        if (mode?.monitoringParameters?.length) {
          await this.handleMonitoringForTuningMode(mode, deviceRef, tuningMode);
        }
      }
      return tuningData;
    } catch (error) {
      LexiumLogger.error("Error in getParsedTuningInfo:", error);
      throw error;
    }
  }

  /**
   * Starts full auto position tuning using the MotionMaster client.
   *
   * Initiates the tuning process with the provided parameters and handles status updates,
   * warnings, completion, and errors. Notifications are sent for each event.
   *
   * @param props - Parameters for starting full auto tuning.
   * @param title - Title for notifications.
   * @returns Promise resolving to tuning results (damping ratio, settling time, bandwidth) or void if failed.
   */
  public async startFullAutoTuning(
    props: StartFullAutoTuningRequest,
    title: string
  ): Promise<{
    dampingRatio: number;
    settlingTime: number;
    bandwidth: number;
  } | void> {
    return new Promise((resolve, reject) => {
      if (!this.mmClient.client) {
        this.sendNotification(title, Constants.ClientNotConnected, NotificationType.error);
        reject(new Error(`${Constants.ClientNotConnected}`));
        return;
      }

      const fullAutoTuningTimeout = 60000;
      this.mmClient.client.request.startFullAutoTuning(props, fullAutoTuningTimeout).subscribe({
        next: (status: FullAutoTuningStatus) => {
          if (status.warning) {
            this.sendNotification(title, status.warning.message ?? MSG_IN_PROGRESS, NotificationType.warning);
          }

          this.handleStatus(title, status, reject, resolve);
        },
        error: (error: unknown) => {
          this.handleError(title, error, reject);
        },
      });
    });
  }

  /**
   * Computes the auto-tuning gains for the motion master client using the provided properties.
   *
   * @param props - The request parameters required to compute auto-tuning gains.
   * @param title - The title used for notifications related to the operation.
   * @returns A promise that resolves when the operation completes or rejects if an error occurs.
   *
   * @remarks
   * Sends notifications for client connection issues, warnings, or failures during the computation process.
   */
  public async computeAutoTuningGains(props: ComputeAutoTuningGainsRequest, title: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.mmClient.client) {
        this.sendNotification(title, Constants.ClientNotConnected, NotificationType.error);
        reject(new Error(`${Constants.ClientNotConnected}`));
        return;
      }

      const requestTimeout = 10000;
      this.mmClient.client.request.computeAutoTuningGains(props, requestTimeout).subscribe({
        next: (status: AutoTuningStatus) => {
          if (status.warning) {
            this.sendNotification(title, status.warning.message ?? "Identified warning while computing auto tuning gains.", NotificationType.warning);
          }
          if (status.request === "failed") {
            reject(new Error(status.error?.message ?? Constants.FAILED_TO_COMPUTE_AUTO_TUNING_GAINS));
          } else if (status.request === "succeeded") {
            resolve();
          } else {
            // For "started", "running", or any other status, do nothing
          }
        },
        error: (error: unknown) => {
          reject(new Error((error as Error)?.message ?? Constants.FAILED_TO_COMPUTE_AUTO_TUNING_GAINS));
        },
      });
    });
  }

  private handleError(title: string, error: unknown, reject: (reason?: unknown) => void) {
    let errorMessage: string;
    if (typeof error === "string") {
      errorMessage = error;
    } else {
      errorMessage = (error as { message?: string })?.message || Constants.START_POSITION_TUNING_MSG_FAILED;
    }
    this.sendNotification(title, JSON.stringify(error) || Constants.START_POSITION_TUNING_MSG_FAILED, NotificationType.error);
    reject(new Error(errorMessage));
  }

  private handleStatus(
    title: string,
    status: FullAutoTuningStatus,
    reject: (reason?: unknown) => void,
    resolve: (
      value:
        | void
        | { dampingRatio: number; settlingTime: number; bandwidth: number }
        | PromiseLike<void | {
            dampingRatio: number;
            settlingTime: number;
            bandwidth: number;
          }>
    ) => void
  ) {
    switch (status.request) {
      case "started":
        this.sendNotification(title, MSG_STARTED, NotificationType.info);
        break;
      case "running":
        this.sendNotification(title, MSG_IN_PROGRESS, NotificationType.info);
        break;
      case "failed":
        this.sendNotification(title, status.error?.message ?? Constants.START_POSITION_TUNING_MSG_FAILED, NotificationType.error);
        reject(new Error(status.error?.message ?? Constants.START_POSITION_TUNING_MSG_FAILED));
        break;
      case "succeeded":
        this.handleSuccessStatus(resolve, status, title);
        break;
      default:
        break;
    }
  }

  private handleSuccessStatus(
    resolve: (
      value:
        | void
        | { dampingRatio: number; settlingTime: number; bandwidth: number }
        | PromiseLike<void | {
            dampingRatio: number;
            settlingTime: number;
            bandwidth: number;
          }>
    ) => void,
    status,
    title: string
  ) {
    this.sendNotification(title, MSG_COMPLETED, NotificationType.success);
    resolve({
      dampingRatio: status.dampingRatio ?? 0,
      settlingTime: status.settlingTime ?? 0,
      bandwidth: status.bandwidth ?? 0,
    });
  }

  private sendNotification(title: string, description: string, type: NotificationType) {
    NotificationHandler.sendSnackBarNotification({
      message: { title, description },
      type,
    });
  }

  private async handleMonitoringForTuningMode(mode: TuningModeInfo, deviceRef: DeviceRef, tuningMode: string | undefined) {
    await this.parametersProcessingHandler.processDeviceInputParameters(mode.monitoringParameters, deviceRef);
    if (mode?.tuningMode.toString() === tuningMode) {
      this.parametersMonitoringHandler.startTuningMonitoring(deviceRef, mode.monitoringParameters);
    }
  }
}
