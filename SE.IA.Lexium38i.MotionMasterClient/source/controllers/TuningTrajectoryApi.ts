import path from "node:path";
import { Constants } from "../utility/constants";
import { LexiumLogger } from "../services/LexiumLogger";
import { Request, Response, NextFunction } from "express";
import NotificationHandler from "../services/NotificationHandler";
import { NotificationType } from "@LXM38I/se.ia.lexium38i.common.model";
import { TrajectoryHandler } from "../services/TrajectoryHandler";

const FILEPATHINDEX = 0;
const ERRORMSGINDEX = 1;

/**
 * Provides API endpoints for managing and controlling tuning trajectories and signal generators
 * for motion control devices. Handles retrieval of trajectory information and starting/stopping
 * of signal generators based on device references and profile types.
 *
 * @remarks
 * This controller interacts with the `TrajectoryHandler` singleton to perform operations
 * and uses a logger and notification handler for error reporting and user feedback.
 */
class TuningTrajectoryApi {
  private readonly positionTrajectoryHandler = TrajectoryHandler.getInstance();

  private readonly profileTypeDataMapper: Record<string, string[]> = {
    [TrajectoryHandler.TORQUE_PROFILE_TYPE]: [path.join(__dirname, "./assets/TorqueTrajectoryInfo.json"), "Failed to load torque trajectory info."],
    [TrajectoryHandler.VELOCITY_PROFILE_TYPE]: [path.join(__dirname, "./assets/VelocityTrajectoryInfo.json"), "Failed to load velocity trajectory info."],
    [TrajectoryHandler.POSITION_PROFILE_TYPE]: [path.join(__dirname, "./assets/PositionTrajectoryInfo.json"), "Failed to load position trajectory info."],
  };

  /**
   * Handles the HTTP request to retrieve tuning trajectory information for a specific device and profile type.
   *
   * @summary Retrieves tuning trajectory information based on device reference and profile type.
   * @param req - The Express request object containing route parameters `deviceRef` and `profileType`.
   * @param res - The Express response object used to send the trajectory data or error response.
   * @param _next - The Express next middleware function (unused).
   * @returns A Promise that resolves when the response is sent.
   */
  public getTuningTrajectoryInfo = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const deviceRef = req.params["deviceRef"];
    const profileType = req.params["profileType"];
    try {
      const trajectoryFilePath = this.profileTypeDataMapper[profileType][FILEPATHINDEX];
      const positionTuningTrajectoryData = await this.positionTrajectoryHandler.getTuningTrajectoryInfo(deviceRef, trajectoryFilePath);
      res.send(positionTuningTrajectoryData);
    } catch (error) {
      this.handleError(res, Constants.SIGNAL_TRAJECTORY, this.profileTypeDataMapper[profileType][ERRORMSGINDEX], error);
    }
  };

  /**
   * Handles the HTTP request to start the signal generator for a specific device.
   *
   * @summary Starts the signal generator based on device reference and provided parameters.
   * @param req - The Express request object containing route parameter `deviceRef` and body with signal generator parameters.
   * @param res - The Express response object used to send the success or error response.
   * @param _next - The Express next middleware function (unused).
   * @returns A Promise that resolves when the response is sent.
   */
  public startSignalGenerator = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const deviceRef = req.params["deviceRef"];
    const signalGeneratorParameters = req.body as { profileType: string; trajectoryType: string; trajectoryData: unknown };

    try {
      await this.positionTrajectoryHandler.startSignalGenerator(deviceRef, signalGeneratorParameters);
      res.send({ message: "Signal generator started successfully." });
    } catch (error: unknown) {
      this.handleError(res, Constants.SIGNAL_TRAJECTORY, `Failed to start signal generator. ${Constants.ClientNotConnected}`, error);
    }
  };

  /**
   * Handles the HTTP request to stop the signal generator for a specific device.
   *
   * @summary Stops the signal generator based on device reference.
   * @param req - The Express request object containing route parameter `deviceRef`.
   * @param res - The Express response object used to send the success or error response.
   * @param _next - The Express next middleware function (unused).
   * @returns A Promise that resolves when the response is sent.
   */
  public stopSignalGenerator = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const deviceRef = req.params["deviceRef"];

    try {
      await this.positionTrajectoryHandler.stopSignalGenerator(deviceRef);
      res.status(Constants.HttpStatusOk).send({ message: "Signal generator stopped successfully." });
    } catch (error) {
      this.handleError(res, Constants.SIGNAL_TRAJECTORY, `Failed to stop signal generator. ${Constants.ClientNotConnected}`, error);
    }
  };

  private handleError(res: Response, title: string, description: string, error: unknown): void {
    this.sendNotification(title, description, NotificationType.error);
    LexiumLogger.error(`${title} - ${description}: ${error}`);
    res.status(Constants.InternalServerError).send({ message: description, error });
  }

  private sendNotification(title: string, description: string, type: NotificationType): void {
    NotificationHandler.sendSnackBarNotification({
      message: { title, description },
      type,
    });
  }
}

export default new TuningTrajectoryApi();
