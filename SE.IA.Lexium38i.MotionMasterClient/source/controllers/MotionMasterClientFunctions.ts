/*
This class in responsible for performing the online device actions,
using the motion-master-client APIs.
*/

import { Request, Response } from "express";
import {
  createMotionMasterClient,
  DeviceParameterValuesStatus,
  DeviceRef,
  ensureDeviceRef,
  makeDeviceRefObj,
  MotionMasterClient,
  MotionMasterMessage,
  splitParameterId,
} from "motion-master-client";
import { BehaviorSubject, lastValueFrom, Subject } from "rxjs";
import { DeviceInfo, DeviceStatus } from "../model/DeviceInfo";
import { ServerStatus } from "@LXM38I/se.ia.lexium38i.common.model";
import { Constants } from "../utility/constants";
import { SocketBroadcaster } from "../webSockets/SocketBroadcaster";
import { NotificationType } from "../model/notificationInfo";
import NotificationHandler from "../services/NotificationHandler";

export class MotionMasterClientFunctions {
  public client: MotionMasterClient | undefined;
  public reqResUrl: string = "";
  public pubSubUrl: string = "";
  public isMotionMasterServerRunning: boolean = false;
  public running$ = new BehaviorSubject<boolean>(false);
  public stdout$ = new Subject<string>();
  public lastConnectedMacAddress: string | undefined;
  public currentSystemEventInfo: MotionMasterMessage.Status.SystemEvent;
  public previouslyDiscoveredDevices: DeviceInfo[] = [];
  private static instance: MotionMasterClientFunctions;
  private lastSystemEventInfo: MotionMasterMessage.Status.SystemEvent | undefined;

  private constructor() {}

  public static getMotionMasterClientFunctionsInstance(): MotionMasterClientFunctions {
    if (!MotionMasterClientFunctions.instance) {
      MotionMasterClientFunctions.instance = new MotionMasterClientFunctions();
    }
    return MotionMasterClientFunctions.instance;
  }

  public connect = async (req: Request, res: Response) => {
    if (this.client) {
      res.status(409).send({
        message: "Client has already been created. Please disconnect (GET /api/disconnect) before creating a new client.",
      });
      return;
    }
    const hostname = req.params["hostname"] ?? "127.0.0.1";
    const status = await this.connectClient(hostname);
    if (this.client) {
      res.send({ reqResUrl: this.reqResUrl, pubSubUrl: this.pubSubUrl });
    } else {
      res.status(500).send({ message: status.statusMessage });
    }
  };

  public disconnect = async (req: Request, res: Response) => {
    console.log(`Client is disconnecting.`);
    this.disconnectClient();
    res.status(204).send();
  };

  public async connectClient(hostname: string = Constants.EtherCatLocalHostIp): Promise<{ status: boolean; statusMessage: string }> {
    let statusMessage = "";
    let status = false;
    this.client ??= createMotionMasterClient(hostname);
    try {
      SocketBroadcaster.broadcast(Constants.EtherCatSystemLogInfo, JSON.stringify({ systemLogInfo: "Client Waiting started", date: new Date().toString() }));
      await this.ensureClientReady();
      SocketBroadcaster.broadcast(Constants.EtherCatSystemLogInfo, JSON.stringify({ systemLogInfo: "Client Waiting done", date: new Date().toString() }));
      this.reqResUrl = this.client.reqResSocket.url ?? "";
      this.pubSubUrl = this.client.pubSubSocket.url ?? "";
      this.subscribeToSystemEvents();
      status = true;
      statusMessage = "Connection successful";
    } catch (err) {
      this.client = undefined;
      status = false;
      statusMessage = "Connection failed with error: " + this.errmsg(err);
    }
    return { status, statusMessage };
  }

  public getDeviceParameters = async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const deviceRefObj = makeDeviceRefObj(deviceRef);
    const { parameters } = await lastValueFrom(
      this.client!.request.getDeviceParameters({
        ...deviceRefObj,
        loadFromCache: true,
        sendProgress: false,
      })
    );
    res.send(parameters);
  };

  public async getDeviceParameterValues(
    devicePosition: DeviceRef,
    parameterIds: string,
    sendProgress: boolean = false,
    loadFromCache: boolean = false
  ): Promise<DeviceParameterValuesStatus> {
    const requestTimeout = 30000;
    let resp: any = {};
    let parameterValuesStatus: DeviceParameterValuesStatus;
    const deviceRef = ensureDeviceRef(devicePosition);
    const parameters = parameterIds.split(",").reduce((arr, parameterId) => {
      const [index, subindex] = splitParameterId(parameterId.trim());
      arr.push({ index, subindex, loadFromCache });
      return arr;
    }, [] as MotionMasterMessage.Request.GetDeviceParameterValues.IParameter[]);

    const deviceRefObj = makeDeviceRefObj(deviceRef);

    if (this.client) {
      parameterValuesStatus = await lastValueFrom(this.client.request.getDeviceParameterValues({ ...deviceRefObj, parameters, sendProgress }, requestTimeout));
      SocketBroadcaster.broadcast(Constants.EtherCatSystemLogInfo, JSON.stringify({ systemLogInfo: "getDeviceParameterValues ", parameterValuesStatus }));
      resp = parameterValuesStatus;
    }

    return resp;
  }

  public upload = async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const index = parseInt(req.params["index"], 16);
    const subindex = parseInt(req.params["subindex"], 16);

    const value = await this.client!.request.upload(deviceRef, index, subindex);

    res.send({ value });
  };

  public disconnectClient() {
    this.client?.closeSockets();
    this.client = undefined;
  }

  /*
          * This method is used to notify the UI on the discovered devices.
          * Here we validate if the system event state is Initialzed then we trigger the getDevices and 
          * update the discovered devices event.
  
      */
  public async notifyDiscoveredDevices(systemEventInfo: MotionMasterMessage.Status.SystemEvent) {
    SocketBroadcaster.broadcast(Constants.EtherCatSystemEventInfo, JSON.stringify(systemEventInfo));

    if (
      this.lastSystemEventInfo != null &&
      this.lastSystemEventInfo.state === MotionMasterMessage.Status.SystemEvent.State.INITIALIZED &&
      systemEventInfo.state !== MotionMasterMessage.Status.SystemEvent.State.INITIALIZED
    ) {
      if (this.previouslyDiscoveredDevices?.length > 0) {
        SocketBroadcaster.broadcast(Constants.EtherCatSystemLogInfo, JSON.stringify({ systemLogInfo: this.previouslyDiscoveredDevices }));
        // Set all previously online devices to offline and emit once with the updated collection
        const updatedDevices = this.previouslyDiscoveredDevices.map((device: DeviceInfo) => {
          if (device.status === DeviceStatus.Online) {
            return { ...device, status: DeviceStatus.Offline };
          }
          return device;
        });
        // Update the statuses in the original array
        this.previouslyDiscoveredDevices = updatedDevices;

        // Emit the status update for all devices at once
        SocketBroadcaster.broadcast(
          Constants.EtherCatDeviceStatus,
          JSON.stringify(
            updatedDevices.map((device) => ({
              serialNumber: device.hardwareDescription?.device.serialNumber,
              status: device.status,
            }))
          )
        );
      }
    }

    this.lastSystemEventInfo = systemEventInfo;
    await this.updateDiscoveredDevices();
  }

  public async updateDiscoveredDevices() {
    await lastValueFrom(this.client!.request.getDevices(90000))
      .then((devices) => {
        devices.forEach((device) => {
          const deviceInfo: DeviceInfo = {
            ...device,
            status: DeviceStatus.Online, // Default status is Online
          };
          this.previouslyDiscoveredDevices.push(deviceInfo);
        });
        SocketBroadcaster.broadcast(Constants.EtherCatDiscoveredDevices, JSON.stringify(devices));
        SocketBroadcaster.broadcast(Constants.EtherCatSlavesReInitialized, JSON.stringify(devices));
      })
      .catch((error) => {
        console.error("Error getting devices:", error);
        SocketBroadcaster.broadcast(Constants.EtherCatDiscoveryStatus, JSON.stringify({ status: ServerStatus.Timeout }));
      });
  }

  /*
   * This method is used to perform quick stop on the device.
   */
  public async quickStop(deviceRef: DeviceRef): Promise<void> {
    try {
      await this.client?.request.quickStop(deviceRef);
      NotificationHandler.sendSnackBarNotification({
        message: { title: Constants.QUICK_STOP, description: `Quick stop performed successfully.` },
        type: NotificationType.success,
      });
    } catch (error) {
      NotificationHandler.sendSnackBarNotification({
        message: { title: Constants.QUICK_STOP, description: `Failed to send quick stop command. ${(error as Error).message}` },
        type: NotificationType.error,
      });
    }
  }

  public asBoolean(value: string | undefined) {
    if (!value) {
      return false;
    }
    return value.toLowerCase() === "true" || value === "1";
  }

  private async ensureClientReady() {
    const maxRetries = 3;
    const delayMs = 1500;
    let attempt = 0;
    let ready = false;
    if (!this.client) {
      throw new Error(Constants.ClientNotConnected);
    }

    while (attempt < maxRetries && !ready) {
      try {
        ready = await this.client.whenReady(delayMs);
      } catch (err) {
        attempt++;
        if (attempt >= maxRetries) {
          throw err;
        }
        await new Promise<void>((resolve: () => void) => setTimeout(resolve, delayMs));
      }
    }
  }

  private errmsg(err: unknown) {
    return err instanceof Error ? err.message : "Unknown error";
  }

  /*
   * Here we subscribe to the motion-master-client system events,
   * Based on the updated in the system events we notify the UI on the device status.
   */
  private async subscribeToSystemEvents() {
    if (this.client != null) {
      this.client.monitor.unsubscribeAll();
      this.client.monitor.systemEvent$.subscribe(async (eventInfo) => {
        const systemEventInfo = eventInfo as MotionMasterMessage.Status.SystemEvent;
        if (systemEventInfo != null) {
          this.currentSystemEventInfo = systemEventInfo;
          await this.notifyDiscoveredDevices(systemEventInfo);
        }
      });
    }
  }
}
