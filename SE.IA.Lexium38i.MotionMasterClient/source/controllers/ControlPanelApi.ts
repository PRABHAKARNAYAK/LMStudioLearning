import { Request, Response, NextFunction } from "express";
import { ProfileModesHandler } from "../services/ProfileModesHandler";
import { Cia402State, ensureDeviceRef, PositionProfileConfig, TorqueProfileConfig, VelocityProfileConfig } from "motion-master-client";
import { Constants } from "../utility/constants";
import NotificationHandler from "../services/NotificationHandler";
import { NotificationType } from "@LXM38I/se.ia.lexium38i.common.model";
import { MotionMasterClientFunctions } from "./MotionMasterClientFunctions";
import { lastValueFrom } from "rxjs";

/**
 * Provides API endpoints for controlling the motion master device's control panel.
 * Handles requests related to position profile operations and sends notifications about their status.
 */
class ControlPanelApi {
  private readonly profileModesHandler = ProfileModesHandler.getInstance();
  private readonly mmcInstance: MotionMasterClientFunctions = MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance();

  /**
   * Handles the HTTP request to start a position profile mode for a specified device.
   *
   * @summary Initiates the position profile mode on the target device and sends appropriate notifications.
   * @param req - The Express request object containing the device reference in params and position profile configuration in the body.
   * @param res - The Express response object used to send the HTTP response.
   * @param _next - The Express next middleware function (unused).
   * @returns Promise<void>
   */
  public startPositionProfile = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const deviceRef = req.params["deviceRef"];
      const positionProfileConfig = req.body as PositionProfileConfig;
      NotificationHandler.sendSnackBarNotification({
        message: { title: Constants.POSITION_PROFILE, description: `${Constants.STARTING_POSITION_PROFILE}` },
        type: NotificationType.info,
      });

      await this.profileModesHandler.startPositionProfileMode(deviceRef, positionProfileConfig);

      res.status(Constants.HttpStatusOk).send({ message: `${Constants.POSITION_PROFILE_SUCCESS}` });
    } catch (error) {
      NotificationHandler.sendSnackBarNotification({
        message: { title: Constants.POSITION_PROFILE, description: Constants.POSITION_PROFILE_FAILED },
        type: NotificationType.error,
      });
      res.status(Constants.InternalServerError).send({
        message: (error as Error)?.message || Constants.POSITION_PROFILE_FAILED,
      });
    }
  };

  /**
   * Handles the HTTP request to release control of a specified device.
   */

  public releaseControl = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const deviceRef = ensureDeviceRef(req.params["deviceRef"]);

      if (this.mmcInstance.client?.request.getCia402State) {
        const currentStatus: Cia402State = await lastValueFrom(this.mmcInstance.client.request.getCia402State(deviceRef));
        if (currentStatus === Cia402State.OPERATION_ENABLED) {
          this.mmcInstance.quickStop(deviceRef);
        }
      }
    } catch (error) {
      res.status(Constants.InternalServerError).send({
        message: (error as Error)?.message || "Failed to release control.",
      });
    }
  };

  /**
   * Handles the HTTP request to start a velocity profile mode for a specified device.
   *
   * @summary Initiates the velocity profile mode on the target device and sends appropriate notifications.
   * @param req - The Express request object containing the device reference in params and velocity profile configuration in the body.
   * @param res - The Express response object used to send the HTTP response.
   * @param _next - The Express next middleware function (unused).
   * @returns Promise<void>
   */
  public startVelocityProfile = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const deviceRef = req.params["deviceRef"];
      const velocityProfileConfig = req.body as VelocityProfileConfig;
      NotificationHandler.sendSnackBarNotification({
        message: { title: Constants.VELOCITY_PROFILE, description: `${Constants.STARTING_VELOCITY_PROFILE}` },
        type: NotificationType.info,
      });

      await this.profileModesHandler.startVelocityProfileMode(deviceRef, velocityProfileConfig);

      res.status(Constants.HttpStatusOk).send({ message: `${Constants.VELOCITY_PROFILE_SUCCESS}` });
    } catch (error) {
      NotificationHandler.sendSnackBarNotification({
        message: { title: Constants.VELOCITY_PROFILE, description: Constants.VELOCITY_PROFILE_FAILED },
        type: NotificationType.error,
      });
      res.status(Constants.InternalServerError).send({
        message: (error as Error)?.message || Constants.VELOCITY_PROFILE_FAILED,
      });
    }
  };

  /**
   * Handles the HTTP request to start a torque profile mode for a specified device.
   *
   * @summary Initiates the torque profile mode on the target device and sends appropriate notifications.
   * @param req - The Express request object containing the device reference in params and torque profile configuration in the body.
   * @param res - The Express response object used to send the HTTP response.
   * @param _next - The Express next middleware function (unused).
   * @returns Promise<void>
   */
  public startTorqueProfile = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const deviceRef = req.params["deviceRef"];
      const torqueProfileConfig = req.body as TorqueProfileConfig;
      NotificationHandler.sendSnackBarNotification({
        message: { title: Constants.TORQUE_PROFILE, description: `${Constants.STARTING_TORQUE_PROFILE}` },
        type: NotificationType.info,
      });

      await this.profileModesHandler.startTorqueProfileMode(deviceRef, torqueProfileConfig);

      res.status(Constants.HttpStatusOk).send({ message: `${Constants.TORQUE_PROFILE_SUCCESS}` });
    } catch (error) {
      NotificationHandler.sendSnackBarNotification({
        message: { title: Constants.TORQUE_PROFILE, description: Constants.TORQUE_PROFILE_FAILED },
        type: NotificationType.error,
      });
      res.status(Constants.InternalServerError).send({
        message: (error as Error)?.message || Constants.TORQUE_PROFILE_FAILED,
      });
    }
  };
}

export default new ControlPanelApi();
