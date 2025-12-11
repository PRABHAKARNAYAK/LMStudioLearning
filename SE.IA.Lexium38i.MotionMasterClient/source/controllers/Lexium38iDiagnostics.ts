/*
This class in responsible for starting the Diagnostics of the device,
using the motion-master-client APIs.
*/
import { Cia402State, DataMonitoring, DeviceRef, ensureDeviceRef, MotionMasterMessage, ParameterValueType } from "motion-master-client";
import { LexiumLogger } from "../services/LexiumLogger";
import { MotionMasterClientFunctions } from "./MotionMasterClientFunctions";
import { Request, Response } from "express";
import { DiagnosticsDataService } from "../services/DiagnosticsDataService";
import { Constants } from "../utility/constants";
import { SocketBroadcaster } from "../webSockets/SocketBroadcaster";
import { DiagnosticsData } from "@LXM38I/se.ia.lexium38i.common.model";
import { lastValueFrom } from "rxjs";
import { Cia402StateMapper } from "../model/Cia402StateMapper";
import { NotificationInfo, NotificationType } from "../model/notificationInfo";

/**
 * Diagnostics controller: starts/stops monitoring, emits fault/warning & state updates via WebSocket.
 * Maintains per-device state (currentDeviceRef, diagnostics snapshot) and minimizes status polling.
 * Provides APIs for current diagnostics, device status and fault reset.
 *
 * @property {LexiumLogger} logger - Logger instance for logging messages.
 * @property {MotionMasterClientFunctions} motionMasterClientFunctionsInstance - Instance of MotionMasterClientFunctions for device communication.
 * @property {DeviceRef} currentDeviceRef - Reference to the current device being monitored.
 * @property {DataMonitoring} dataMonitoring - Data monitoring instance for collecting diagnostic data.
 * @property {DiagnosticsData | null} currentDiagnosticData - Current diagnostic data being tracked.
 * @property {boolean} isFaultOccured - Flag indicating if a fault has occurred.
 * @property {boolean} isWarningOccured - Flag indicating if a warning has occurred.
 * @property {ParameterValueType | undefined} previousStatusWord - Previous status word for change detection.
 * @property {Record<Cia402State, string>} cia402StateMap - Mapping of Cia402State to human-readable strings.
 */
class Lexium38iDiagnostics {
  private readonly motionMasterClientFunctionsInstance: MotionMasterClientFunctions = MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance();
  private currentDeviceRef: DeviceRef;
  private dataMonitoring: DataMonitoring;
  private currentDiagnosticData: DiagnosticsData | null;
  private isFaultOccured = false;
  private isWarningOccured = false;
  private previousStatusWord: ParameterValueType | undefined;

  //This API Starts the Diagnostics of the Lexium 38i device.
  startDiagnostics = async (req: Request, res: Response) => {
    LexiumLogger.info("Diagnostics Service Start Called.");
    const faultErrorReportIndex = 0x203f;
    const faultErrorCodeIndex = 0x603f;
    const statusWordIndex = 0x6041;
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    LexiumLogger.info("Diagnostics Service starting for deviceRef: ", deviceRef);
    try {
      //Stop runnin Monitoring/Diagnostics if the device reference changes
      this.stopDiagnostics();
      this.currentDeviceRef = deviceRef;
      if (this.motionMasterClientFunctionsInstance.client) {
        this.dataMonitoring = this.motionMasterClientFunctionsInstance.client.createDataMonitoring(
          [
            [this.currentDeviceRef, statusWordIndex, 0],
            [this.currentDeviceRef, faultErrorCodeIndex, 0],
            [this.currentDeviceRef, faultErrorReportIndex, 1],
          ],
          10000
        );
        // To receive and collect data, you must subscribe to the returned observable.
        this.dataMonitoring.start().subscribe(async (data) => {
          this.isDeviceInFaultOrWarning(data[Constants.STATUS_WORD_DATA_INDEX]);
          LexiumLogger.info(
            `Diagnostics Status Word Data: isFault=${this.isFaultOccured}, isWarning=${this.isWarningOccured}, errorReport=${data[Constants.ERROR_REPORT_DATA_INDEX]}`
          );
          /*
          This call is added to monitor the device state changes.
          Call emitDeviceStatus only if status word (data[0]) changed since last call.
          This is to avoid flooding the network with getCia402State requests.
          */
          if (this.previousStatusWord !== data[Constants.STATUS_WORD_DATA_INDEX]) {
            this.emitDeviceStatus();
            this.previousStatusWord = data[Constants.STATUS_WORD_DATA_INDEX];
          }
          if (this.isFaultOccured || this.isWarningOccured) {
            this.emitErrorDetail(data[Constants.FAULT_ERROR_CODE_INDEX], data[Constants.ERROR_REPORT_DATA_INDEX], this.isFaultOccured);
          } else {
            if (this.currentDiagnosticData != null) {
              this.currentDiagnosticData = null;
              //Send empty data to clear the previous fault/warning info on UI.
              const emptyDiag = {
                containsDiagnosticsData: false,
                id: "",
                errorCode: "",
                remedy: "",
                errorCodeList: [],
                explanation: 0,
                longForm: 0,
                errorReport: "",
                group: "",
                isFault: false,
              };
              SocketBroadcaster.broadcast(Constants.DiagnosticInfo, emptyDiag);
              SocketBroadcaster.broadcast(Constants.ErrorWarningStateChange, false);
            }
          }
        });
      }
      LexiumLogger.info("Diagnostics service is running response: ", true);
      res.send({ success: true });
    } catch (error) {
      LexiumLogger.error("Error occurred while starting diagnostics: ", error);
      res.status(500).send({ success: false });
    }
  };

  /**
   * Attempts to reset the fault state for the selected device.
   * Sends a notification and response indicating success or failure.
   * @param req Express request containing deviceRef
   * @param res Express response
   */
  resetFault = async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    if (!this.motionMasterClientFunctionsInstance.client) {
      res.status(Constants.InternalServerError).send({ success: false, message: "Client not initialized." });
      return;
    }

    let messageInfo: string = "";
    let notificationType;

    try {
      await this.motionMasterClientFunctionsInstance.client.request.resetFault(deviceRef);

      // Wait for 3 seconds before checking the device state after reset
      await new Promise((resolve, _reject) => setTimeout(resolve, Constants.FAULT_RESET_WAIT_TIME_MS));

      const currentStatus: Cia402State = await lastValueFrom(this.motionMasterClientFunctionsInstance.client.request.getCia402State(deviceRef));

      const isFault = currentStatus === Cia402State.FAULT;
      messageInfo = isFault ? Constants.ErrorResetFailed : Constants.ErrorResetSuccessful;
      notificationType = isFault ? NotificationType.error : NotificationType.success;
      res.status(Constants.HttpStatusOk).send({ success: !isFault, message: messageInfo });
    } catch (error: unknown) {
      messageInfo = Constants.ErrorResetFailed;
      notificationType = NotificationType.error;
      LexiumLogger.error(`Fault reset failed for deviceRef: ${deviceRef}`, error);
      res.status(500).send({ success: false, message: messageInfo });
    } finally {
      this.sendNotification(notificationType, messageInfo);
    }
  };

  /*This API provides the Error and Warning Data for the Selected device 
    for which the Data monitoring has been started
    */
  getErrorAndWarningData = async (req: Request, res: Response) => {
    LexiumLogger.info("Getting Error and Warning Data for deviceRef", this.currentDeviceRef);
    if (this.currentDiagnosticData != null) {
      LexiumLogger.info("Current Diagnostic Data: ", this.currentDiagnosticData);
      res.send(this.currentDiagnosticData);
    } else {
      res.status(204).send();
    }
  };

  /**
   * This API provides the Device Diagnostic Stats for the Selected device
   * for which the Data monitoring has been started and returns true if the device is in a fault state
   */
  getDeviceDiagnosticStatus = async (req: Request, res: Response) => {
    LexiumLogger.info("Getting Device Diagnostic Stats for deviceRef", this.currentDeviceRef);
    if (this.currentDiagnosticData != null) {
      LexiumLogger.info("Current Diagnostic Data: ", this.currentDiagnosticData);
      res.send(true);
    } else {
      LexiumLogger.info("No current diagnostic data available.");
      res.status(204).send();
    }
  };

  /**
   * Gets the current CIA402 state of the selected device and sends it in the response.
   * Returns the mapped device state string, or does nothing if the client or device reference is missing.
   * @param _req Express request (unused)
   * @param res Express response
   */
  getCia402StateOfDevice = async (_req: Request, res: Response) => {
    const client = this.motionMasterClientFunctionsInstance.client;
    if (!client || !this.currentDeviceRef) {
      return;
    }
    await lastValueFrom(client.request.getCia402State(this.currentDeviceRef))
      .then((currentStatus: Cia402State) => {
        const deviceCia402State = Cia402StateMapper.cia402StateMap[currentStatus] ?? Constants.SWITCH_ON_DISABLED;
        res.send({
          state: deviceCia402State,
        });
      })
      .catch((err: unknown) => {
        LexiumLogger.error("Failed to get device state", err);
      });
  };

  // Stops the Diagnostics monitoring for the started on device selection change.
  private stopDiagnostics() {
    if (this.dataMonitoring != null) {
      this.dataMonitoring?.stop();
      this.currentDiagnosticData = null;
    }
  }

  /**
   * Checks if the device is in fault or warning.
   */
  private isDeviceInFaultOrWarning(diagnosticData: ParameterValueType) {
    const faultIndex = 3;
    const warningIndex = 7;
    // Convert the number to a 16-bit binary string
    const binaryString = diagnosticData.toString(2).padStart(16, "0");
    // Convert the binary string to an array of numbers (bits)
    const binaryArray = binaryString.split("").map((bit) => Number(bit));
    // Optionally reverse if your bit mapping requires it
    binaryArray.reverse();
    if (binaryArray.length > 0) {
      // Check for faults
      const faultBit = binaryArray[faultIndex];
      const warningBit = binaryArray[warningIndex];
      if (faultBit === 1) {
        this.isFaultOccured = true;
      } else {
        this.isFaultOccured = false;
      }
      if (warningBit === 1) {
        this.isWarningOccured = true;
      } else {
        this.isWarningOccured = false;
      }
    }
  }

  /**
   * Emit the error details to front end.
   */
  private emitErrorDetail(errorCodeDecimal: ParameterValueType, errorReport: ParameterValueType, isFault: boolean) {
    const diagnosticData: DiagnosticsData | null = DiagnosticsDataService.getInstance().getDiagnosticsDataForError(errorCodeDecimal.toString(), errorReport.toString());
    if (diagnosticData != null) {
      diagnosticData.isFault = isFault;
      diagnosticData.containsDiagnosticsData = true;
      // Update fields with alternate text if they are empty
      diagnosticData.explanation = diagnosticData.explanation !== "" ? diagnosticData.explanation : "-";
      diagnosticData.longForm = diagnosticData.longForm !== "" ? diagnosticData.longForm : "-";
      diagnosticData.remedy = diagnosticData.remedy !== "" ? diagnosticData.remedy : Constants.ERROR_REMEDY_ALTERNATE_TEXT;
    }
    LexiumLogger.info("emitErrorDetail API Called ErrorWarningStateChange events.");
    //emit the data if the fault has been changed. Else do not send.
    if (this.currentDiagnosticData != null) {
      //TODO : Check for the future logic.
      if (diagnosticData?.id != this.currentDiagnosticData.id) {
        LexiumLogger.info("Diagnostic data has changed. Emitting updated fault error Info and ErrorWarningStateChange events.");
        this.currentDiagnosticData = { ...diagnosticData };
        SocketBroadcaster.broadcast(Constants.ErrorWarningStateChange, true);
        SocketBroadcaster.broadcast(Constants.DiagnosticInfo, this.currentDiagnosticData);
        LexiumLogger.info(String(this.currentDiagnosticData?.errorCode));
        LexiumLogger.info(JSON.stringify(this.currentDiagnosticData?.errorCodeList));
        LexiumLogger.info(this.currentDiagnosticData?.id);
      }
    } else {
      LexiumLogger.info("Setting up the CurrentDiagnostics data Emitting first instance.", diagnosticData);
      this.currentDiagnosticData = { ...diagnosticData };
      SocketBroadcaster.broadcast(Constants.DiagnosticInfo, this.currentDiagnosticData);
      SocketBroadcaster.broadcast(Constants.ErrorWarningStateChange, true);
      LexiumLogger.info(String(this.currentDiagnosticData?.errorCode));
      LexiumLogger.info(JSON.stringify(this.currentDiagnosticData?.errorCodeList));
      LexiumLogger.info(this.currentDiagnosticData?.id);
      LexiumLogger.info("isFault " + isFault);
    }
  }

  /**
   * Get the current device state as a string.
   * Emits "DeviceStateChange" event with the state string.
   * Logs the current device state.
   */
  private async emitDeviceStatus() {
    const client = this.motionMasterClientFunctionsInstance.client;
    if (!client || !this.currentDeviceRef) {
      return; // Safety guard
    }

    await lastValueFrom(client.request.getCia402State(this.currentDeviceRef))
      .then((currentStatus: Cia402State) => {
        const deviceCurrentStatus = Cia402StateMapper.cia402StateMap[currentStatus] ?? Constants.SWITCH_ON_DISABLED;
        SocketBroadcaster.broadcast(Constants.SOCKET_ON_CIA402_STATE_CHANGE, deviceCurrentStatus);
      })
      .catch((err: unknown) => {
        LexiumLogger.error("Failed to get device state", err);
      });
  }

  /**
   * Sends a notification message via WebSocket.
   * @param notificationType Type of notification (success, error, etc.)
   * @param messageInfo Message description to send
   */
  private sendNotification(notificationType: NotificationType, messageInfo: string) {
    const notificationInfo: NotificationInfo = {
      type: notificationType,
      message: { description: messageInfo },
    };
    SocketBroadcaster.broadcast(Constants.SnackBarNotificationReceived, JSON.stringify(notificationInfo));
  }
}

export default new Lexium38iDiagnostics();
