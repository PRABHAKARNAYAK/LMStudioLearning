import { HomingModeGroup } from "../model/ControlPanelInfo";
import { LexiumLogger } from "./LexiumLogger";
import { MotionMasterClientFunctions } from "../controllers/MotionMasterClientFunctions";
import { ParametersProcessingHandler } from "./ParametersProcessingHandler";
import { HomingProcedureConfig, HomingProcedureStatus } from "motion-master-client";
import { SocketBroadcaster } from "../webSockets/SocketBroadcaster";
import { HomingProcedureStatusMapper } from "../model/HomingProcedureStatusMapper";
import { Constants } from "../utility/constants";
import { IParameter } from "@LXM38I/se.ia.lexium38i.common.model";
import { Parameter } from "../generated/source/assets/protos/GroupInfo_pb";

/**
 * Handles homing procedures for devices, including processing homing mode groups,
 * starting homing procedures, managing parameters, and emitting notifications.
 * Implements singleton pattern.
 */
export class HomingHandler {
  private static instance: HomingHandler;
  private readonly parametersProcessingHandler = ParametersProcessingHandler.getInstance();
  private readonly motionMasterClientFunctions = MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance();

  private constructor() {}

  public static getInstance(): HomingHandler {
    if (!HomingHandler.instance) {
      HomingHandler.instance = new HomingHandler();
    }
    return HomingHandler.instance;
  }

  /**
   * Processes a HomingModeGroup by updating its homing methods and parameters with device-specific values.
   * Fetches and maps parameter values for homing methods and updates homingMethod and homeOffset if present.
   * Emits error notifications if processing fails.
   */
  public async processHomingModeGroup(homingMode: HomingModeGroup, deviceRef: string): Promise<void> {
    try {
      if (homingMode.homingMethods?.length) {
        await this.processHomingMethods(homingMode.homingMethods, deviceRef);
      }
      await Promise.all([this.processParameterIfExists(homingMode, "homingMethod", deviceRef), this.processParameterIfExists(homingMode, "homeOffset", deviceRef)]);
    } catch (error) {
      this.emitErrorNotification(error);
    }
  }

  /**
   * Starts the homing procedure for a device using the provided configuration.
   * Subscribes to homing status updates and emits notifications for status changes.
   * Unsubscribes when the procedure succeeds or fails, and emits error notifications on failure.
   */
  public async startHomingProcedure(deviceRef: string, homingProcedureConfig?: HomingProcedureConfig): Promise<void> {
    const completeProcedure = (error?: unknown) => {
      SocketBroadcaster.broadcast(Constants.HomingProcedureCompleted, true);
      if (error) this.emitErrorNotification(error);
    };

    try {
      const client = this.motionMasterClientFunctions?.client;
      if (!client) {
        completeProcedure(`${Constants.ClientNotConnected}`);
        return;
      }

      const subscription = client.runHomingProcedure(deviceRef, homingProcedureConfig).subscribe({
        next: (homingStatus: HomingProcedureStatus) => {
          this.emitStatusNotification(homingStatus.request);
          if (["succeeded", "failed"].includes(homingStatus.request)) {
            completeProcedure();
            subscription?.unsubscribe();
          }
        },
        error: (err) => {
          completeProcedure(err);
          subscription?.unsubscribe();
        },
      });
    } catch (error) {
      completeProcedure(error);
    }
  }

  private async processParameterIfExists(homingMode: HomingModeGroup, key: keyof Pick<HomingModeGroup, "homingMethod" | "homeOffset">, deviceRef: string): Promise<void> {
    if (homingMode[key]) {
      homingMode[key] = await this.parametersProcessingHandler.processParameter(homingMode[key], deviceRef);
    }
  }

  private async processHomingMethods(homingMethods: NonNullable<HomingModeGroup["homingMethods"]>, deviceRef: string): Promise<void> {
    for (const method of homingMethods) {
      if (method.inputParameters?.length) {
        const parameters = method.inputParameters.map((parameter: IParameter) => this.parametersProcessingHandler.createParameterFromIParameter(parameter));
        const parameterIds = parameters
          .map((param: Parameter) => `${this.parametersProcessingHandler.replaceHashWithZero(param.getIndex())}:${param.getSubIndex() || "00"}`)
          .join(",");
        const parameterValuesStatus = await this.motionMasterClientFunctions.getDeviceParameterValues(deviceRef, parameterIds, true, true);
        method.inputParameters = parameters.map((param: Parameter) => this.parametersProcessingHandler.mapParameterToIParameter(param, parameterValuesStatus));
      }
    }
  }

  private emitMonitoredData(emitId: string, monitoredData: string): void {
    LexiumLogger.info(`Emitting monitored data for ${monitoredData}`);
    SocketBroadcaster.broadcast(emitId, monitoredData);
  }

  private emitStatusNotification(requestStatus: string): void {
    const notification = HomingProcedureStatusMapper.requestStatus[requestStatus];
    this.emitMonitoredData(Constants.SnackBarNotificationReceived, JSON.stringify(notification));
  }

  private emitErrorNotification(error: unknown): void {
    const notificationInfo = { ...HomingProcedureStatusMapper.requestStatus["failed"] };
    if (typeof error === "string") {
      notificationInfo.message.description = error;
    } else {
      notificationInfo.message.description = String(error);
    }
    this.emitMonitoredData(Constants.SnackBarNotificationReceived, JSON.stringify(notificationInfo));
  }
}
