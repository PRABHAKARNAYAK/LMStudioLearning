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
    try {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      const currentSelectedMacAddress: string = req.params["macAddress"]; //To Do: the macAddress should be retrieved from the solution dataspace.

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
          //ToDo: Notify user on the issue happened for restarting the device discovery!!!
          // Later the status will be sent as Error.
          LexiumLogger.info("No current system event info available.");
          SocketBroadcaster.broadcast(Constants.EtherCatDiscoveryStatus, JSON.stringify({ status: ServerStatus.Timeout }));
        }
      }
      this.subscribeEtherCatSystemEvents();
      this.subscribeEtherCatDeviceRunningStatus();
      if (this.motionMasterClientFunctionsInstance.running$.getValue() === false) {
        LexiumLogger.info("Starting Motion Master process with MAC address: " + currentSelectedMacAddress);
        this._motionMasterProcess
          .start(currentSelectedMacAddress)
          .then((status) => {
            const masterProcessStatus = status as boolean;
            if (!masterProcessStatus) {
              SocketBroadcaster.broadcast(Constants.EtherCatDiscoveryStatus, JSON.stringify({ status: Constants.DISCOVERY_FAILED }));
            }
          })
          .catch((error) => {
            LexiumLogger.error("Error starting Motion Master process:", error);
            SocketBroadcaster.broadcast(Constants.EtherCatDiscoveryStatus, JSON.stringify({ status: Constants.DISCOVERY_FAILED, errorMessage: error }));
          });
      }
    } catch (error) {
      LexiumLogger.error("Start Device Discovery failed with exception ", error);
      SocketBroadcaster.broadcast(Constants.EtherCatDiscoveryStatus, JSON.stringify({ status: Constants.DISCOVERY_FAILED, errorMessage: error }));
    }
    res.status(200).send({ message: "Motion Master started!" });
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
        } else {
          SocketBroadcaster.broadcast(Constants.EtherCatDiscoveryStatus, JSON.stringify({ status: "No current system event info available. Discovery might time out..." }));
          await this.motionMasterClientFunctionsInstance.updateDiscoveredDevices();
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
