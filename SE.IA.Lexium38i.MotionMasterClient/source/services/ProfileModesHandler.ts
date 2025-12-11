import { Cia402State, PositionProfileConfig, TorqueProfileConfig, VelocityProfileConfig } from "motion-master-client";
import { LexiumLogger } from "./LexiumLogger";
import { MotionMasterClientFunctions } from "../controllers/MotionMasterClientFunctions";
import { Constants } from "../utility/constants";
import NotificationHandler from "./NotificationHandler";
import { NotificationType } from "../model/notificationInfo";

const MODE_OF_OPERATION_INDEX = 0x6060;
const POSITION_WINDOW = 0x6067;
const TARGET_POSITION_INDEX = 0x607a;
const PROFILE_VELOCITY_INDEX = 0x6081;
const PROFILE_ACCELERATION_INDEX = 0x6083;
const PROFILE_DECELERATION_INDEX = 0x6084;

/**
 * Handles operations related to profile modes for motion control devices.
 *
 * @remarks
 * This singleton class provides methods to start and manage position profile modes
 * using the MotionMasterClient. It ensures only one instance is used throughout the application.
 *
 * @public
 */
export class ProfileModesHandler {
  private static instance: ProfileModesHandler;
  private readonly mmClient = MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance();

  private constructor() {}

  public static getInstance(): ProfileModesHandler {
    if (!ProfileModesHandler.instance) {
      ProfileModesHandler.instance = new ProfileModesHandler();
    }
    return ProfileModesHandler.instance;
  }

  /**
   * Starts the position profile mode for the specified device using the provided configuration.
   *
   * @summary
   * Initiates a position profile motion sequence on the target device, configuring motion parameters
   * such as target position, velocity, acceleration, and deceleration. Handles the transition to the
   * appropriate state, applies the set point, and waits for the target position to be reached.
   * Sends success or error notifications based on the operation outcome.
   *
   * @param deviceRef - The reference identifier of the device to control.
   * @param positionProfileConfig - The configuration object containing position, velocity, acceleration, and deceleration parameters.
   * @returns A promise that resolves when the target position is reached or rejects if an error occurs.
   */
  public async startPositionProfileMode(deviceRef: string, positionProfileConfig: PositionProfileConfig): Promise<void> {
    try {
      if (!this.mmClient.client) {
        throw new Error(`${Constants.ClientNotConnected}`);
      }

      await this.mmClient.client.request.resetTargets(deviceRef);
      const targetPosition = await this.getTargetPosition(positionProfileConfig, deviceRef);

      const positionProfileValue = 1;
      await this.mmClient.client.request.downloadMany([
        [deviceRef, MODE_OF_OPERATION_INDEX, 0, positionProfileValue],
        [deviceRef, POSITION_WINDOW, 0, 10],
        [deviceRef, TARGET_POSITION_INDEX, 0, targetPosition],
        [deviceRef, PROFILE_VELOCITY_INDEX, 0, positionProfileConfig.velocity],
        [deviceRef, PROFILE_ACCELERATION_INDEX, 0, positionProfileConfig.acceleration],
        [deviceRef, PROFILE_DECELERATION_INDEX, 0, positionProfileConfig.deceleration],
      ]);

      await this.mmClient.client.request.transitionToCia402State(deviceRef, Cia402State.OPERATION_ENABLED);
      await this.mmClient.client.request.applySetPoint(deviceRef);
      await this.mmClient.client.whenTargetReached(deviceRef);

      NotificationHandler.sendSnackBarNotification({
        message: { title: Constants.POSITION_PROFILE, description: `${Constants.TARGET_POSITION_REACHED}` },
        type: NotificationType.success,
      });
    } catch (error) {
      NotificationHandler.sendSnackBarNotification({
        message: { title: Constants.POSITION_PROFILE, description: `${Constants.FAILED_TO_REACH_TARGET_POSITION((error as Error)?.message)}` },
        type: NotificationType.error,
      });
      LexiumLogger.info(`${Constants.FAILED_TO_REACH_TARGET_POSITION((error as Error)?.message)}`);
    }
  }

  /**
   * Starts the velocity profile mode for the specified device using the provided configuration.
   *
   * @summary
   * Initiates a velocity profile motion sequence on the target device, configuring motion parameters
   * such as target velocity, acceleration, and deceleration. Handles the transition to the
   * appropriate state and sends notifications based on the operation outcome.
   *
   * @param deviceRef - The reference identifier of the device to control.
   * @param velocityProfileConfig - The configuration object containing target velocity, acceleration, and deceleration parameters.
   * @returns A promise that resolves when the operation is initiated or rejects if an error occurs.
   */
  public async startVelocityProfileMode(deviceRef: string, velocityProfileConfig: VelocityProfileConfig): Promise<void> {
    try {
      if (!this.mmClient.client) {
        throw new Error(`${Constants.ClientNotConnected}`);
      }

      await this.mmClient.client.request.resetTargets(deviceRef);

      const targetVelocity = 0x60ff;
      const velocityProfileValue = 3;
      await this.mmClient.client.request.downloadMany([
        [deviceRef, MODE_OF_OPERATION_INDEX, 0, velocityProfileValue],
        [deviceRef, targetVelocity, 0, velocityProfileConfig.target],
        [deviceRef, PROFILE_ACCELERATION_INDEX, 0, velocityProfileConfig.acceleration],
        [deviceRef, PROFILE_DECELERATION_INDEX, 0, velocityProfileConfig.deceleration],
      ]);

      await this.mmClient.client.request.transitionToCia402State(deviceRef, Cia402State.OPERATION_ENABLED);

      NotificationHandler.sendSnackBarNotification({
        message: { title: Constants.VELOCITY_PROFILE, description: `${Constants.VELOCITY_PROFILE_STATUS}` },
        type: NotificationType.info,
      });
    } catch (error) {
      NotificationHandler.sendSnackBarNotification({
        message: { title: Constants.VELOCITY_PROFILE, description: `${Constants.FAILED_TO_REACH_TARGET_VELOCITY((error as Error)?.message)}` },
        type: NotificationType.error,
      });
      LexiumLogger.info(`${Constants.FAILED_TO_REACH_TARGET_VELOCITY((error as Error)?.message)}`);
    }
  }

  /**
   * Starts the torque profile mode for the specified device using the provided torque profile configuration.
   *
   * @param deviceRef - The reference identifier of the device to configure.
   * @param torqueProfileConfig - The configuration object containing target torque and slope values.
   * @returns A promise that resolves when the torque profile mode has been successfully started.
   *
   * @throws Will throw an error if the MotionMaster client is not connected or if any operation fails.
   *
   * @summary
   * This method configures the device to operate in torque profile mode by setting the appropriate parameters,
   * transitioning the device to the OPERATION_ENABLED state, and sending user notifications about the operation status.
   */
  public async startTorqueProfileMode(deviceRef: string, torqueProfileConfig: TorqueProfileConfig): Promise<void> {
    try {
      if (!this.mmClient.client) {
        throw new Error(`${Constants.ClientNotConnected}`);
      }

      await this.mmClient.client.request.resetTargets(deviceRef);

      const targetTorque = 0x6071;
      const targetSlope = 0x6087;
      const torqueProfileValue = 4;
      await this.mmClient.client.request.downloadMany([
        [deviceRef, MODE_OF_OPERATION_INDEX, 0, torqueProfileValue],
        [deviceRef, targetTorque, 0, torqueProfileConfig.target],
        [deviceRef, targetSlope, 0, torqueProfileConfig.slope],
      ]);

      await this.mmClient.client.request.transitionToCia402State(deviceRef, Cia402State.OPERATION_ENABLED);

      NotificationHandler.sendSnackBarNotification({
        message: { title: Constants.TORQUE_PROFILE, description: `${Constants.TORQUE_PROFILE_STATUS}` },
        type: NotificationType.info,
      });
    } catch (error) {
      NotificationHandler.sendSnackBarNotification({
        message: { title: Constants.TORQUE_PROFILE, description: `${Constants.FAILED_TO_REACH_TARGET_TORQUE((error as Error)?.message)}` },
        type: NotificationType.error,
      });
      LexiumLogger.info(`${Constants.FAILED_TO_REACH_TARGET_TORQUE((error as Error)?.message)}`);
    }
  }

  private async getTargetPosition(positionProfileConfig: PositionProfileConfig, deviceRef: string) {
    let targetPosition = positionProfileConfig.target;
    if (positionProfileConfig.relative) {
      if (!this.mmClient.client) {
        throw new Error(`${Constants.ClientNotConnected}`);
      }
      const actualPositionIndex = 0x6064;
      const positionActualValue = await this.mmClient.client.request.upload(deviceRef, actualPositionIndex, 0);

      targetPosition = positionActualValue + targetPosition;
    }
    return targetPosition;
  }
}
