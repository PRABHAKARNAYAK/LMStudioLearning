import { LexiumLogger } from "./LexiumLogger";
import ParametersMonitoringHandler from "./ParametersMonitoringHandler";
import { ParametersProcessingHandler } from "./ParametersProcessingHandler";
import { MotionMasterClientFunctions } from "../controllers/MotionMasterClientFunctions";
import { TuningTrajectoryInfo } from "../model/TuningTrajectoryInfo";
import { motionmaster } from "motion-master-client/src/lib/motion-master.proto";
import { lastValueFrom } from "rxjs";
import { makeDeviceRefObj, SignalGeneratorStatus } from "motion-master-client";
import NotificationHandler from "./NotificationHandler";
import { NotificationType } from "../model/notificationInfo";
import { Constants } from "../utility/constants";

const STEP_RESPONSE = 0;
const ADVANCED_STEP_RESPONSE = 1;
const RAMP = 2;
const TRAPEZOIDAL = 3;
const BIDIRECTIONAL = 4;
const SINE_WAVE = 5;

type PositionTrajectoryTypeMap = {
  [STEP_RESPONSE]: motionmaster.MotionMasterMessage.Request.SetSignalGeneratorParameters.IPositionStepResponse;
  [ADVANCED_STEP_RESPONSE]: motionmaster.MotionMasterMessage.Request.SetSignalGeneratorParameters.IPositionAdvancedStepResponse;
  [RAMP]: motionmaster.MotionMasterMessage.Request.SetSignalGeneratorParameters.IPositionRamp;
  [TRAPEZOIDAL]: motionmaster.MotionMasterMessage.Request.SetSignalGeneratorParameters.IPositionTrapezoidal;
  [BIDIRECTIONAL]: motionmaster.MotionMasterMessage.Request.SetSignalGeneratorParameters.IPositionBidirectional;
  [SINE_WAVE]: motionmaster.MotionMasterMessage.Request.SetSignalGeneratorParameters.IPositionSineWave;
};

type VelocityTrajectoryTypeMap = {
  [STEP_RESPONSE]: motionmaster.MotionMasterMessage.Request.SetSignalGeneratorParameters.IVelocityStepResponse;
  [ADVANCED_STEP_RESPONSE]: motionmaster.MotionMasterMessage.Request.SetSignalGeneratorParameters.IVelocityAdvancedStepResponse;
  [RAMP]: motionmaster.MotionMasterMessage.Request.SetSignalGeneratorParameters.IVelocityRamp;
  [TRAPEZOIDAL]: motionmaster.MotionMasterMessage.Request.SetSignalGeneratorParameters.IVelocityTrapezoidal;
  [BIDIRECTIONAL]: motionmaster.MotionMasterMessage.Request.SetSignalGeneratorParameters.IVelocityBidirectional;
  [SINE_WAVE]: motionmaster.MotionMasterMessage.Request.SetSignalGeneratorParameters.IVelocitySineWave;
};

type TorqueTrajectoryTypeMap = {
  [STEP_RESPONSE]: motionmaster.MotionMasterMessage.Request.SetSignalGeneratorParameters.ITorqueStepResponse;
  [ADVANCED_STEP_RESPONSE]: motionmaster.MotionMasterMessage.Request.SetSignalGeneratorParameters.ITorqueAdvancedStepResponse;
  [RAMP]: motionmaster.MotionMasterMessage.Request.SetSignalGeneratorParameters.ITorqueRamp;
  [TRAPEZOIDAL]: motionmaster.MotionMasterMessage.Request.SetSignalGeneratorParameters.ITorqueTrapezoidal;
  [BIDIRECTIONAL]: motionmaster.MotionMasterMessage.Request.SetSignalGeneratorParameters.ITorqueBidirectional;
  [SINE_WAVE]: motionmaster.MotionMasterMessage.Request.SetSignalGeneratorParameters.ITorqueSineWave;
};

export class TrajectoryHandler {
  private static instance: TrajectoryHandler;
  private readonly mmClient = MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance();

  private readonly parametersProcessingHandler = ParametersProcessingHandler.getInstance();
  private readonly parametersMonitoringHandler = ParametersMonitoringHandler.getInstance();

  static readonly TORQUE_PROFILE_TYPE = "0";
  static readonly VELOCITY_PROFILE_TYPE = "2";
  static readonly POSITION_PROFILE_TYPE = "3";

  private readonly signalGeneratorPropertyMapper: Record<string, Record<number, string>> = {
    [TrajectoryHandler.POSITION_PROFILE_TYPE]: {
      [STEP_RESPONSE]: "positionStepResponse",
      [ADVANCED_STEP_RESPONSE]: "positionAdvancedStepResponse",
      [RAMP]: "positionRamp",
      [TRAPEZOIDAL]: "positionTrapezoidal",
      [BIDIRECTIONAL]: "positionBidirectional",
      [SINE_WAVE]: "positionSineWave",
    },
    [TrajectoryHandler.VELOCITY_PROFILE_TYPE]: {
      [STEP_RESPONSE]: "velocityStepResponse",
      [ADVANCED_STEP_RESPONSE]: "velocityAdvancedStepResponse",
      [RAMP]: "velocityRamp",
      [TRAPEZOIDAL]: "velocityTrapezoidal",
      [BIDIRECTIONAL]: "velocityBidirectional",
      [SINE_WAVE]: "velocitySineWave",
    },
    [TrajectoryHandler.TORQUE_PROFILE_TYPE]: {
      [STEP_RESPONSE]: "torqueStepResponse",
      [ADVANCED_STEP_RESPONSE]: "torqueAdvancedStepResponse",
      [RAMP]: "torqueRamp",
      [TRAPEZOIDAL]: "torqueTrapezoidal",
      [BIDIRECTIONAL]: "torqueBidirectional",
      [SINE_WAVE]: "torqueSineWave",
    },
  };

  castStrategies: Record<string, (trajectoryKind: number, data: unknown) => unknown> = {
    [TrajectoryHandler.TORQUE_PROFILE_TYPE]: (trajectoryKind, data) => this.castTorqueTrajectory(trajectoryKind as keyof TorqueTrajectoryTypeMap, data),
    [TrajectoryHandler.VELOCITY_PROFILE_TYPE]: (trajectoryKind, data) => this.castVelocityTrajectory(trajectoryKind as keyof VelocityTrajectoryTypeMap, data),
    [TrajectoryHandler.POSITION_PROFILE_TYPE]: (trajectoryKind, data) => this.castPositionTrajectory(trajectoryKind as keyof PositionTrajectoryTypeMap, data),
  };

  private constructor() {}

  public static getInstance(): TrajectoryHandler {
    if (!TrajectoryHandler.instance) {
      TrajectoryHandler.instance = new TrajectoryHandler();
    }
    return TrajectoryHandler.instance;
  }

  /**
   * Retrieves and processes tuning trajectory information for a given device.
   *
   * @param deviceRef - The reference identifier of the device.
   * @param trajectoryInfoFilePath - The file path to the trajectory information JSON file.
   * @returns A promise that resolves to the parsed and processed `TuningTrajectoryInfo` object.
   * @throws Will throw an error if the trajectory information cannot be retrieved or processed.
   */
  public async getTuningTrajectoryInfo(deviceRef: string, trajectoryInfoFilePath: string): Promise<TuningTrajectoryInfo> {
    try {
      const tuningTrajectoryData = this.parametersProcessingHandler.getJsonData<TuningTrajectoryInfo>(trajectoryInfoFilePath);

      for (const trajectoryType of tuningTrajectoryData.trajectoryTypes) {
        await this.parametersProcessingHandler.processDeviceInputParameters(trajectoryType.inputParameters, deviceRef);
      }

      await this.parametersProcessingHandler.processDeviceInputParameters(tuningTrajectoryData.monitoringParameters, deviceRef);
      this.parametersMonitoringHandler.startTrajectoryMonitoring(deviceRef, tuningTrajectoryData.monitoringParameters);

      return tuningTrajectoryData;
    } catch (error: unknown) {
      LexiumLogger.error("Error in getPositionTuningTrajectoryInfo:", error);
      throw error;
    }
  }

  /**
   * Starts the signal generator on the specified device with the provided parameters.
   *
   * This method sets the signal generator parameters for the given device reference and then initiates
   * the signal generator. It uses the appropriate strategy based on the profile type and trajectory type,
   * and handles both the parameter setting and the start process, including error handling and notifications.
   *
   * @param deviceRef - The reference identifier for the target device.
   * @param signalGeneratorParameters - An object containing the profile type, trajectory type, and trajectory data for the signal generator.
   * @returns A Promise that resolves when the signal generator has been started or rejects if an error occurs.
   * @throws Will throw an error if the client is not connected, if the profile type is unknown, if the property name is invalid, or if setting parameters fails.
   */
  public async startSignalGenerator(deviceRef: string, signalGeneratorParameters: { profileType: string; trajectoryType: string; trajectoryData: unknown }): Promise<void> {
    try {
      if (!this.mmClient.client) {
        throw new Error(Constants.ClientNotConnected);
      }
      const deviceRefObj = makeDeviceRefObj(deviceRef);
      const { profileType, trajectoryType, trajectoryData } = signalGeneratorParameters;

      const strategy = this.castStrategies[profileType];
      if (!strategy) {
        throw new Error(`Unknown profileType detected while fetching the strategy: ${profileType}`);
      }

      const trajectoryTypeIndex = Number(trajectoryType);
      const castedObject = strategy(trajectoryTypeIndex, trajectoryData);
      const propertyName = this.getSignalGeneratorProperty(profileType, trajectoryTypeIndex);
      if (!propertyName) {
        throw new Error(`Invalid property name for profileType: ${profileType}, trajectoryType: ${trajectoryTypeIndex}`);
      }

      const SIGNAL_GENERATOR_SET_TIMEOUT_MS = 2000;
      const setResponse = await lastValueFrom(
        this.mmClient.client.request.setSignalGeneratorParameters(
          {
            ...deviceRefObj,
            [propertyName]: castedObject,
          },
          SIGNAL_GENERATOR_SET_TIMEOUT_MS
        )
      );

      if (setResponse.success) {
        const SIGNAL_GENERATOR_START_TIMEOUT_MS = 5000;
        this.mmClient.client.request.startSignalGenerator({ ...deviceRefObj }, SIGNAL_GENERATOR_START_TIMEOUT_MS).subscribe({
          next: (status: SignalGeneratorStatus) => {
            this.handleSignalGeneratorStatus(status);
          },
          error: (error: unknown) => {
            LexiumLogger.error("Error in startSignalGenerator:", error);
            NotificationHandler.sendSnackBarNotification({
              type: NotificationType.warning,
              message: { title: Constants.SIGNAL_TRAJECTORY, description: `${(error as Error).message}` },
            });
          },
        });
      } else {
        throw new Error("Failed to set signal generator parameters. Please check the provided trajectory data and try again.");
      }
    } catch (error: unknown) {
      LexiumLogger.error("Error in startSignalGenerator:", error);
      throw error;
    }
  }

  /**
   * Stops the signal generator for the specified device.
   *
   * @param deviceRef - The reference identifier of the device whose signal generator should be stopped.
   * @returns A promise that resolves when the signal generator has been successfully stopped.
   * @throws Throws an error if the client is not connected or if the stop operation fails.
   *
   * @summary
   * Stops the signal generator on the given device and ensures proper error handling if the operation fails.
   */
  public async stopSignalGenerator(deviceRef: string): Promise<void> {
    try {
      if (!this.mmClient.client) {
        throw new Error(Constants.ClientNotConnected);
      }

      const deviceRefObj = makeDeviceRefObj(deviceRef);
      const SIGNAL_GENERATOR_STOP_TIMEOUT_MS = 5000;
      this.mmClient.client.request.stopSignalGenerator({ ...deviceRefObj }, SIGNAL_GENERATOR_STOP_TIMEOUT_MS).subscribe({
        error: (error: unknown) => {
          LexiumLogger.error("Error in stopSignalGenerator subscription:", error);
          this.mmClient.client?.request.quickStop(deviceRef).catch((err: unknown) => {
            LexiumLogger.error("Error in quickStop during stopSignalGenerator subscription:", err);
            throw err;
          });
        },
      });
    } catch (error: unknown) {
      LexiumLogger.error("Error in stopSignalGenerator:", error);
      throw error;
    }
  }

  private getSignalGeneratorProperty(profileType: string, trajectoryType: number): string | undefined {
    return this.signalGeneratorPropertyMapper[profileType]?.[trajectoryType];
  }

  private castPositionTrajectory<T extends keyof PositionTrajectoryTypeMap>(_type: T, data: unknown): PositionTrajectoryTypeMap[T] {
    return data as PositionTrajectoryTypeMap[T];
  }

  private castVelocityTrajectory<T extends keyof VelocityTrajectoryTypeMap>(_type: T, data: unknown): VelocityTrajectoryTypeMap[T] {
    return data as VelocityTrajectoryTypeMap[T];
  }

  private castTorqueTrajectory<T extends keyof TorqueTrajectoryTypeMap>(_type: T, data: unknown): TorqueTrajectoryTypeMap[T] {
    return data as TorqueTrajectoryTypeMap[T];
  }

  private handleSignalGeneratorStatus(status: SignalGeneratorStatus): void {
    if (status.warning) {
      NotificationHandler.sendSnackBarNotification({
        type: NotificationType.warning,
        message: { title: Constants.SIGNAL_TRAJECTORY, description: `Signal generator encountered a warning. ${status.warning?.message}` },
      });
    }
    switch (status.request) {
      case "started":
        NotificationHandler.sendSnackBarNotification({
          type: NotificationType.info,
          message: { title: Constants.SIGNAL_TRAJECTORY, description: `Signal generator started.` },
        });
        break;
      case "running":
        NotificationHandler.sendSnackBarNotification({
          type: NotificationType.info,
          message: { title: Constants.SIGNAL_TRAJECTORY, description: `Signal generator is running` },
        });
        break;
      case "failed":
        NotificationHandler.sendSnackBarNotification({
          type: NotificationType.error,
          message: { title: Constants.SIGNAL_TRAJECTORY, description: `Signal generator failed with error: ${status.error?.message}` },
        });
        break;
      case "succeeded":
        NotificationHandler.sendSnackBarNotification({
          type: NotificationType.success,
          message: { title: Constants.SIGNAL_TRAJECTORY, description: `Signal generator succeeded. ${status.success?.message}` },
        });
        break;
      default:
        break;
    }
  }
}
