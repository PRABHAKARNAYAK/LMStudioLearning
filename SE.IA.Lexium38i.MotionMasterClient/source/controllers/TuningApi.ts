import { Request, Response, NextFunction } from "express";
import { ComputeAutoTuningGainsRequest, ensureDeviceRef, makeDeviceRefObj, MotionMasterMessage } from "motion-master-client";
import { MotionMasterClientFunctions } from "./MotionMasterClientFunctions";
import NotificationHandler from "../services/NotificationHandler";
import { NotificationType } from "../model/notificationInfo";
import { SystemIdentificationHandler } from "../services/SystemIdentificationHandler";
import { Constants } from "../utility/constants";
import { LexiumLogger } from "../services/LexiumLogger";
import { TuningHandler } from "../services/TuningHandler";
import path from "node:path";

const MSG_FILE_FAILED = "Failed to retrieve plant model file from device.";
const POSITION_TUNING_MSG_FAILED = "Failed to load position tuning info.";
const VELOCITY_TUNING_MSG_FAILED = "Failed to load velocity tuning info.";
const TORQUE_TUNING_MSG_FAILED = "Failed to load torque tuning info.";

/**
 * Provides API endpoints for system identification and tuning procedures
 * for Lexium38i devices via MotionMasterClient. Handles requests for
 * retrieving system identification data, starting tuning procedures,
 * parsing query parameters, sending notifications, and error handling.
 *
 * @remarks
 * This class acts as a controller for tuning-related operations,
 * integrating with MotionMasterClientFunctions and TuningHandler.
 */
class TuningApi {
  private readonly mmClient = MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance();
  private readonly systemIdentificationHandler = SystemIdentificationHandler.getInstance();
  private readonly tuningHandler = TuningHandler.getInstance();

  /**
   * Retrieves system identification data for a specified device.
   *
   * @param req - Express request object containing the device reference in the route parameters.
   * @param res - Express response object used to send the identification data or error response.
   * @param _next - Express next middleware function (unused).
   * @returns A promise that resolves when the response is sent.
   *
   * @summary Fetches and returns system identification data for a device, handling errors appropriately.
   */
  public getSystemIdentificationData = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    try {
      const identificationData = await this.systemIdentificationHandler.getSystemIdentificationData(deviceRef);
      this.sendResponse(res, Constants.HttpStatusOk, { identificationData });
    } catch (error) {
      this.handleError(res, Constants.SYSTEM_IDENTIFICATION, MSG_FILE_FAILED, error);
    }
  };

  /**
   * Initiates the system identification (tuning) procedure for a specified device.
   *
   * @param req - Express request object containing device reference and query parameters.
   * @param res - Express response object used to send the result or error response.
   * @param _next - Express next middleware function (unused).
   * @returns A promise that resolves when the response is sent.
   *
   * @summary Starts the system identification process for a device and returns the identification data.
   */
  public startSystemIdentification = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const deviceRefObj = makeDeviceRefObj(deviceRef);
    const props = { ...deviceRefObj, ...this.parseQuery(req.query) };
    try {
      const identificationData = await this.systemIdentificationHandler.startSystemIdentificationProcedure(deviceRef, props);
      this.sendResponse(res, Constants.HttpStatusOk, { identificationData });
    } catch (error: unknown) {
      this.handleError(res, Constants.SYSTEM_IDENTIFICATION, Constants.SYS_IDENTIFICATION_MSG_FAILED, error);
    }
  };

  /**
   * Handles the HTTP request to retrieve position tuning information for a specific device.
   *
   * @param req - The Express request object containing the device reference in the route parameters.
   * @param res - The Express response object used to send the position tuning data or error response.
   * @param _next - The Express next middleware function (unused).
   * @returns A promise that resolves when the response is sent.
   *
   * @summary Retrieves and sends parsed position tuning information for the specified device.
   */
  public getPositionTuningInfo = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const deviceRef = req.params["deviceRef"];
    const tuningMode = req.query.tuningMode as string | undefined;
    const positionTuningInfoFilePath = path.join(__dirname, "./assets/PositionTuningInfo.json");

    try {
      const controlPanelData = await this.tuningHandler.getParsedTuningInfo(deviceRef, positionTuningInfoFilePath, tuningMode);
      res.send(controlPanelData);
    } catch (error) {
      this.handleError(res, Constants.POSITION_TUNING, POSITION_TUNING_MSG_FAILED, error);
    }
  };

  /**
   * Handles the HTTP request to retrieve velocity tuning information for a specific device.
   *
   * @param req - The Express request object containing the device reference in the route parameters.
   * @param res - The Express response object used to send the velocity tuning data or error response.
   * @param _next - The Express next middleware function (unused).
   * @returns A promise that resolves when the response is sent.
   *
   * @summary Retrieves and sends parsed velocity tuning information for the specified device.
   */
  public getVelocityTuningInfo = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const deviceRef = req.params["deviceRef"];
    const tuningMode = req.query.tuningMode as string | undefined;
    const velocityTuningInfoFilePath = path.join(__dirname, "./assets/VelocityTuningInfo.json");

    try {
      const controlPanelData = await this.tuningHandler.getParsedTuningInfo(deviceRef, velocityTuningInfoFilePath, tuningMode);
      res.send(controlPanelData);
    } catch (error) {
      this.handleError(res, Constants.VELOCITY_TUNING, VELOCITY_TUNING_MSG_FAILED, error);
    }
  };

  /**
   * Handles the HTTP request to retrieve torque tuning information for a specific device.
   *
   * @param req - The Express request object containing the device reference in the route parameters.
   * @param res - The Express response object used to send the torque tuning data or error response.
   * @param _next - The Express next middleware function (unused).
   * @returns A promise that resolves when the response is sent.
   *
   * @summary Retrieves and sends parsed torque tuning information for the specified device.
   */
  public getTorqueTuningInfo = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const deviceRef = req.params["deviceRef"];
    const tuningMode = req.query.tuningMode as string | undefined;
    const torqueTuningInfoFilePath = path.join(__dirname, "./assets/TorqueTuningInfo.json");

    try {
      const controlPanelData = await this.tuningHandler.getParsedTuningInfo(deviceRef, torqueTuningInfoFilePath, tuningMode);
      res.send(controlPanelData);
    } catch (error) {
      this.handleError(res, Constants.TORQUE_TUNING, TORQUE_TUNING_MSG_FAILED, error);
    }
  };

  /**
   * Initiates the automatic position tuning process for a specified device and controller type.
   *
   * @param req - Express request object containing device reference and controller type parameters.
   * @param res - Express response object used to send the result or error response.
   * @param _next - Express next middleware function (unused).
   * @returns A promise that resolves when the position auto tuning process has started and the response is sent.
   *
   * @remarks
   * This method validates the device reference, constructs the required properties,
   * and invokes the position tuning handler. On success, it sends the tuning response;
   * on failure, it handles and sends an error response.
   */
  public startPositionAutoTuning = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const deviceRefObj = makeDeviceRefObj(deviceRef);
    const type = MotionMasterMessage.Request.StartFullAutoTuning.Type.POSITION;
    const controllerType = Number(req.params["controllerType"] ?? 0);

    const props = {
      ...deviceRefObj,
      type,
      controllerType,
    };

    if (!this.mmClient.client) {
      this.sendNotification(Constants.POSITION_TUNING, Constants.ClientNotConnected, NotificationType.error);
      return;
    }
    try {
      const positionTuningResponse = await this.tuningHandler.startFullAutoTuning(props, Constants.POSITION_TUNING);
      this.sendResponse(res, Constants.HttpStatusOk, {
        positionTuningResponse,
      });
    } catch (error) {
      this.handleError(res, Constants.POSITION_TUNING, Constants.START_POSITION_TUNING_MSG_FAILED, error);
    }
  };

  /**
   * Initiates the automatic velocity tuning process for a specified device.
   *
   * @param req - Express request object containing device reference parameters.
   * @param res - Express response object used to send the result or error response.
   * @param _next - Express next middleware function (unused).
   * @returns A promise that resolves when the velocity auto tuning process has started and the response is sent.
   *
   * @summary Starts the velocity auto tuning procedure for a device and returns the tuning response.
   */
  public startVelocityAutoTuning = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const deviceRefObj = makeDeviceRefObj(deviceRef);
    const type = MotionMasterMessage.Request.StartFullAutoTuning.Type.VELOCITY;

    const props = {
      ...deviceRefObj,
      type,
    };

    if (!this.mmClient.client) {
      this.sendNotification(Constants.VELOCITY_TUNING, Constants.ClientNotConnected, NotificationType.error);
      return;
    }
    try {
      const velocityTuningResponse = await this.tuningHandler.startFullAutoTuning(props, Constants.VELOCITY_TUNING);
      this.sendResponse(res, Constants.HttpStatusOk, {
        velocityTuningResponse,
      });
    } catch (error) {
      this.handleError(res, Constants.VELOCITY_TUNING, Constants.START_VELOCITY_TUNING_MSG_FAILED, error);
    }
  };

  /**
   * Computes position gains for a specified device using provided parameters.
   *
   * @param req - Express request object containing device reference and position parameters in the body.
   * @param res - Express response object used to send the result or error response.
   * @param _next - Express next middleware function (unused).
   * @returns A promise that resolves when the position gains computation is complete and the response is sent.
   *
   * @summary Computes and applies position gains for the device based on controller type, settling time, and damping.
   */
  public computePositionGains = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const deviceRefObj = makeDeviceRefObj(deviceRef);

    const positionParameters = req.body as { controllerType: number; settlingTime: number; positionDamping: number };

    const props: ComputeAutoTuningGainsRequest = {
      ...deviceRefObj,
      positionParameters,
    };

    try {
      await this.tuningHandler.computeAutoTuningGains(props, Constants.POSITION_TUNING);

      res.status(Constants.HttpStatusOk).send({ message: "Position gains computed successfully." });
    } catch (error) {
      this.handleError(res, Constants.POSITION_TUNING, Constants.FAILED_TO_COMPUTE_AUTO_TUNING_GAINS, error);
    }
  };

  /**
   * Handles the computation of velocity loop gains for a device.
   *
   * @param req - The Express request object, containing the device reference in the route parameters and velocity tuning parameters in the body.
   * @param res - The Express response object used to send the result or error response.
   * @param _next - The Express next middleware function (unused).
   * @returns A promise that resolves when the operation is complete.
   *
   * @summary Computes and applies velocity loop gains for a specified device using provided tuning parameters.
   */
  public computeVelocityGains = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const deviceRefObj = makeDeviceRefObj(deviceRef);

    const velocityParameters = req.body as { velocityLoopBandwidth: number; velocityDamping: number };

    const props: ComputeAutoTuningGainsRequest = {
      ...deviceRefObj,
      velocityParameters,
    };
    try {
      await this.tuningHandler.computeAutoTuningGains(props, Constants.VELOCITY_TUNING);

      res.status(Constants.HttpStatusOk).send({ message: "Velocity gains computed successfully." });
    } catch (error) {
      this.handleError(res, Constants.VELOCITY_TUNING, Constants.FAILED_TO_COMPUTE_AUTO_TUNING_GAINS, error);
      return;
    }
  };

  private parseQuery(query: Record<string, unknown>) {
    return {
      durationSeconds: Number.parseFloat((query["duration-seconds"] as string) ?? "3.0"),
      torqueAmplitude: Number.parseInt((query["torque-amplitude"] as string) ?? "300", 10),
      startFrequency: Number.parseInt((query["start-frequency"] as string) ?? "2", 10),
      endFrequency: Number.parseInt((query["end-frequency"] as string) ?? "60", 10),
      nextGenSysId: this.mmClient.asBoolean(query["next-gen-sys-id"] as string),
    };
  }

  private sendNotification(title: string, description: string, type: NotificationType): void {
    NotificationHandler.sendSnackBarNotification({
      message: { title, description },
      type,
    });
  }

  private sendResponse(res: Response, status: number, body: unknown): void {
    res.status(status).send(body);
  }

  private handleError(res: Response, title: string, description: string, error: unknown): void {
    this.sendNotification(title, description, NotificationType.error);
    LexiumLogger.error(`${title} - ${description}: ${error}`);
    res.status(Constants.InternalServerError).send({ message: description, error });
  }
}

export default new TuningApi();
