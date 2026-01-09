/*
 * This class contains the APIs which are responsible for performing Device Discovery.
 */

import { Request, Response } from "express";
import { MotionMasterProcess } from "../services/MotionMasterProcess";
import { LexiumLogger } from "../services/LexiumLogger";
import { MotionMasterClientFunctions } from "./MotionMasterClientFunctions";
import { Constants } from "../utility/constants";
import { ServerStatus } from "@LXM38I/se.ia.lexium38i.common.model";
import { SocketBroadcaster } from "../webSockets/SocketBroadcaster";

class StartDiscovery {
  private static _discoveryInstance: StartDiscovery;
  _motionMasterProcess: MotionMasterProcess | undefined;

  motionMasterClientFunctionsInstance: MotionMasterClientFunctions = MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance();

  private constructor() {
    // Private to prevent direct instantiation
  }

  public static init(): StartDiscovery {
    if (!StartDiscovery._discoveryInstance) {
      StartDiscovery._discoveryInstance = new StartDiscovery();
    }
    return StartDiscovery._discoveryInstance;
  }

  public static getInstance(): StartDiscovery {
    if (!StartDiscovery._discoveryInstance) {
      throw new Error("StartMotionMaster not initialized. Call init(io) first.");
    }
    return StartDiscovery._discoveryInstance;
  }

  /*
        This API is responsible for starting the device discovery.
    */
  StartDeviceDiscovery = async (req: Request, res: Response) => {
    const currentSelectedMacAddress: string = req.params["macAddress"];

    try {
      // Send response immediately - API just triggers discovery in background
      res.status(200).json({
        status: "initiated",
        message: "Device discovery started",
        macAddress: currentSelectedMacAddress,
        timestamp: new Date(),
      });

      // Run discovery in background after response is sent
      process.nextTick(async () => {
        try {
          console.log(`[StartDiscovery] Background discovery starting for MAC: ${currentSelectedMacAddress}`);
          SocketBroadcaster.broadcast(Constants.EtherCatDiscoveryStatus, JSON.stringify({ status: "Discovery Started" }));

          this._motionMasterProcess = MotionMasterProcess.getInstance();

          if (
            this._motionMasterProcess.getAlreadyExecutingMasterProcessMacAddress() != null &&
            this._motionMasterProcess.getAlreadyExecutingMasterProcessMacAddress() !== currentSelectedMacAddress
          ) {
            const stopStatus = await this._motionMasterProcess?.stop();
            if (stopStatus) {
              LexiumLogger.info("Motion Master process stopped successfully.");
            } else {
              LexiumLogger.error("Failed to stop Motion Master process before starting new discovery.");
              SocketBroadcaster.broadcast(Constants.EtherCatDiscoveryStatus, JSON.stringify({ status: ServerStatus.Timeout }));
              return;
            }
          }

          this.subscribeEtherCatSystemEvents();
          this.subscribeEtherCatDeviceRunningStatus();

          if (this.motionMasterClientFunctionsInstance.running$.getValue() === false) {
            console.log(`[StartDiscovery] Starting Motion Master process with MAC: ${currentSelectedMacAddress}`);
            LexiumLogger.info("Starting Motion Master process with MAC address: " + currentSelectedMacAddress);

            await this._motionMasterProcess
              .start(currentSelectedMacAddress)
              .then((status) => {
                const masterProcessStatus = status as boolean;
                if (masterProcessStatus) {
                  console.log("[StartDiscovery] Motion Master process started successfully");
                } else {
                  console.log("[StartDiscovery] Motion Master process failed to start");
                  SocketBroadcaster.broadcast(Constants.EtherCatDiscoveryStatus, JSON.stringify({ status: Constants.DISCOVERY_FAILED }));
                }
              })
              .catch((error) => {
                console.error("[StartDiscovery] Error starting process:", error);
                LexiumLogger.error("Error starting Motion Master process:", error);
                SocketBroadcaster.broadcast(Constants.EtherCatDiscoveryStatus, JSON.stringify({ status: Constants.DISCOVERY_FAILED, errorMessage: String(error) }));
              });
          } else {
            console.log("[StartDiscovery] Motion Master process already running");
          }
        } catch (error) {
          console.error("[StartDiscovery] Background task error:", error);
          LexiumLogger.error("Start Device Discovery background task failed:", error);
          SocketBroadcaster.broadcast(Constants.EtherCatDiscoveryStatus, JSON.stringify({ status: Constants.DISCOVERY_FAILED, errorMessage: String(error) }));
        }
      });
    } catch (error) {
      console.error("[StartDiscovery] Error sending response:", error);
      LexiumLogger.error("Start Device Discovery failed:", error);
      if (!res.headersSent) {
        res.status(500).json({ status: "error", message: error instanceof Error ? error.message : String(error) });
      }
    }
  };

  /*
    This API returns the current discovery status and discovered devices
  */
  GetDiscoveryStatus = async (req: Request, res: Response) => {
    try {
      const devicesArray = this.motionMasterClientFunctionsInstance.previouslyDiscoveredDevices || [];
      const isRunning = this.motionMasterClientFunctionsInstance.running$.getValue();
      const isServerRunning = this.motionMasterClientFunctionsInstance.isMotionMasterServerRunning;

      console.log("[StartDiscovery] GetDiscoveryStatus called");
      console.log(`[StartDiscovery] isRunning=${isRunning}, isServerRunning=${isServerRunning}, deviceCount=${devicesArray.length}`);
      console.log(`[StartDiscovery] Devices:`, JSON.stringify(devicesArray));

      const statusData = {
        isRunning,
        isServerRunning,
        currentMacAddress: this._motionMasterProcess?.getAlreadyExecutingMasterProcessMacAddress(),
        discoveredDevices: devicesArray,
        deviceCount: devicesArray.length,
        message: "Discovered devices",
        timestamp: new Date(),
      };

      console.log(`[StartDiscovery] Returning status with ${devicesArray.length} devices: ${JSON.stringify(statusData)}`);
      LexiumLogger.info(`GetDiscoveryStatus: returning ${devicesArray.length} discovered devices`);
      res.status(200).json(statusData);
    } catch (error) {
      console.log("[StartDiscovery] GetDiscoveryStatus exception:", error);
      LexiumLogger.error("Get Discovery Status failed with exception", error);
      res.status(500).json({ status: "error", message: error instanceof Error ? error.message : String(error) });
    }
  };

  private subscribeEtherCatDeviceRunningStatus() {
    try {
      this.motionMasterClientFunctionsInstance.running$.subscribe(async (running: boolean) => {
        LexiumLogger.info("server running status: " + running);
        if (!running) {
          // Handle negative use cases: broadcast failure status.
          SocketBroadcaster.broadcast(
            Constants.EtherCatDiscoveryStatus,
            JSON.stringify({ status: Constants.DISCOVERY_FAILED, errorMessage: "Motion Master Server is not running." })
          );
          return;
        }

        this.motionMasterClientFunctionsInstance.isMotionMasterServerRunning = true;
        LexiumLogger.info("data running: Motion Master Server Running successfully");
        SocketBroadcaster.broadcast(Constants.EtherCatDiscoveryStatus, JSON.stringify({ status: "Motion Master Server running successfully" }));
        this.motionMasterClientFunctionsInstance.disconnectClient();

        const clientStatus = await this.motionMasterClientFunctionsInstance.connectClient(Constants.EtherCatLocalHostIp);

        if (!clientStatus.status) {
          SocketBroadcaster.broadcast(Constants.EtherCatDiscoveryStatus, JSON.stringify({ status: "Unable to initialize client with the current MAC address." }));
          SocketBroadcaster.broadcast(Constants.EtherCatDiscoveryStatus, JSON.stringify({ status: ServerStatus.Timeout }));
          return;
        }

        const clientStatusData = {
          connectionStatus: clientStatus,
          timestamp: new Date(),
        };
        SocketBroadcaster.broadcast(Constants.EtherCatSystemLogInfo, JSON.stringify({ systemLogInfo: clientStatusData }));

        const hasSystemEventInfo = this.motionMasterClientFunctionsInstance.currentSystemEventInfo != null;
        if (hasSystemEventInfo) {
          SocketBroadcaster.broadcast(Constants.EtherCatDiscoveryStatus, JSON.stringify({ status: "System event available. Notifying discovered devices..." }));
          await this.motionMasterClientFunctionsInstance.notifyDiscoveredDevices(this.motionMasterClientFunctionsInstance.currentSystemEventInfo);
          // Devices are broadcast via Socket.io from notifyDiscoveredDevices method
          LexiumLogger.info("Device discovery triggered via system event");
        } else {
          SocketBroadcaster.broadcast(Constants.EtherCatDiscoveryStatus, JSON.stringify({ status: "No current system event info available. Discovery might time out..." }));
          await this.motionMasterClientFunctionsInstance.updateDiscoveredDevices();
          // Note: updateDiscoveredDevices broadcasts devices via Socket.io internally
          LexiumLogger.info("Device discovery updated via updateDiscoveredDevices");
        }
      });
    } catch (error) {
      LexiumLogger.error("Error subscribing to EtherCat device running status:", error);
    }
  }

  private subscribeEtherCatSystemEvents() {
    this.motionMasterClientFunctionsInstance.stdout$.subscribe((chunk) => {
      LexiumLogger.info(`data stdout: ${JSON.stringify({ stdout: chunk })}\n\n`);
      SocketBroadcaster.broadcast(Constants.EtherCatSystemLogInfo, JSON.stringify({ stdout: chunk }));
    });
  }
}

export { StartDiscovery };
