import { Cia402State, DataMonitoring, DeviceRef, ParameterValueType } from "motion-master-client";
import { MotionMasterClientFunctions } from "../controllers/MotionMasterClientFunctions";
import { LexiumLogger } from "./LexiumLogger";
import { SocketBroadcaster } from "../webSockets/SocketBroadcaster";
import { Constants } from "../utility/constants";
import { IParameter } from "@LXM38I/se.ia.lexium38i.common.model";
import { lastValueFrom } from "rxjs";
import { Cia402StateMapper } from "../model/Cia402StateMapper";

type ParameterTuple = [deviceRef: DeviceRef, index: number, subIndex: number];

/**
 * Configuration object for monitoring parameters within the MotionMasterClient service.
 *
 * @property monitoringList - Array of parameter tuples to be monitored.
 * @property dataMonitoring - Optional configuration for data monitoring behavior.
 * @property previousMonitoredData - Map storing previously monitored parameter values, keyed by parameter identifier.
 * @property emitId - Unique identifier used for emitting monitoring events.
 */
interface MonitoringConfig {
  monitoringList: ParameterTuple[];
  dataMonitoring: DataMonitoring | undefined;
  previousMonitoredData: Map<string, ParameterValueType>;
  emitId: string;
}

/**
 * Singleton class responsible for monitoring device parameters in real-time.
 *
 * `ParametersMonitoringHandler` manages the lifecycle of parameter monitoring sessions for devices,
 * including starting, stopping, and emitting changes in monitored data. It supports both default and control panel monitoring modes,
 * tracks previous parameter values to detect changes, and handles special cases such as CIA402 state updates.
 *
 * Usage:
 * - Use `getInstance()` to obtain the singleton instance.
 * - Call `startDefaultMonitoring()` or `startMonitoring()` to begin monitoring parameters for a device.
 * - The class emits changes via IO events when monitored data updates.
 *
 * Internal mechanisms include mapping parameters to tuples, managing monitoring configurations,
 * and integrating with MotionMaster client functions for data acquisition.
 */
export default class ParametersMonitoringHandler {
  private deviceRef: DeviceRef;

  private readonly motionMasterClientFunctionsInstance = MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance();

  private static instance: ParametersMonitoringHandler;

  private readonly configs: Record<string, MonitoringConfig> = {
    controlPanel: {
      monitoringList: [],
      previousMonitoredData: new Map(),
      emitId: Constants.ControlPanelMonitoringDataChange,
      dataMonitoring: undefined,
    },
    default: {
      monitoringList: [],
      previousMonitoredData: new Map(),
      emitId: Constants.DefaultMonitoringDataChange,
      dataMonitoring: undefined,
    },
    tuningPanel: {
      monitoringList: [],
      previousMonitoredData: new Map(),
      emitId: Constants.TuningPanelMonitoringDataChange,
      dataMonitoring: undefined,
    },
    trajectoryPanel: {
      monitoringList: [],
      previousMonitoredData: new Map(),
      emitId: Constants.TRAJECTORY_PANEL_MONITORING_DATA_CHANGE,
      dataMonitoring: undefined,
    },
  };

  private constructor() {}

  public static getInstance(): ParametersMonitoringHandler {
    if (!ParametersMonitoringHandler.instance) {
      ParametersMonitoringHandler.instance = new ParametersMonitoringHandler();
    }
    return ParametersMonitoringHandler.instance;
  }

  /**
   * Starts default monitoring for a device using the provided parameters.
   *
   * @param deviceRef - Reference to the device to monitor.
   * @param defaultMonitoringParams - Array of parameters to monitor by default.
   */
  public startDefaultMonitoring(deviceRef: string, defaultMonitoringParams: IParameter[]): void {
    this.startMonitoringInternal("default", deviceRef, defaultMonitoringParams);
  }

  /**
   * Starts control panel monitoring for a device using the provided parameters.
   *
   * @param deviceRef - Reference to the device to monitor.
   * @param monitoringParams - Array of parameters to monitor for the control panel.
   */
  public startMonitoring(deviceRef: DeviceRef, monitoringParams: IParameter[]): void {
    this.startMonitoringInternal("controlPanel", deviceRef, monitoringParams);
  }

  /**
   * Starts monitoring of position tuning parameters for the specified device.
   *
   * @param deviceRef - Reference to the device whose parameters are to be monitored.
   * @param monitoringParams - Array of parameters to monitor during position tuning.
   */
  public startTuningMonitoring(deviceRef: DeviceRef, monitoringParams: IParameter[]): void {
    this.startMonitoringInternal("tuningPanel", deviceRef, monitoringParams);
  }

  /**
   * Starts monitoring of trajectory parameters for the specified device.
   *
   * @param deviceRef - Reference to the device whose trajectory parameters are to be monitored.
   * @param monitoringParams - Array of parameters to monitor during the trajectory.
   */
  public startTrajectoryMonitoring(deviceRef: DeviceRef, monitoringParams: IParameter[]): void {
    this.startMonitoringInternal("trajectoryPanel", deviceRef, monitoringParams, false);
  }

  /**
   * Retrieves the current CIA402 state for the device.
   *
   * Queries the MotionMaster client for the device's CIA402 state, maps it to a human-readable string,
   * and returns the result. If the state cannot be retrieved, returns the default "SWITCH_ON_DISABLED" status.
   *
   * @returns Promise resolving to the mapped CIA402 state string.
   */
  public async getCia402State(): Promise<string> {
    let deviceCurrentStatus = Constants.SWITCH_ON_DISABLED;
    const client = this.motionMasterClientFunctionsInstance.client;
    if (client?.request?.getCia402State) {
      try {
        const currentStatus: Cia402State = await lastValueFrom(client.request.getCia402State(this.deviceRef));
        deviceCurrentStatus = Cia402StateMapper.cia402StateMap[currentStatus] ?? Constants.SWITCH_ON_DISABLED;
        SocketBroadcaster.broadcast(Constants.SOCKET_ON_CIA402_STATE_CHANGE, deviceCurrentStatus);
      } catch (err) {
        LexiumLogger.error("Failed to get device state", err);
      }
    }
    return deviceCurrentStatus;
  }

  private startMonitoringInternal(configKey: keyof typeof this.configs, deviceRef: DeviceRef, params: IParameter[], emitOnlyModifiedValue = true): void {
    const config = this.configs[configKey];
    this.stopMonitoring(config);
    this.setDeviceReference(deviceRef);
    config.monitoringList = this.mapParamsToTuples(params);
    config.dataMonitoring = this.createDataMonitoring(config.monitoringList);
    config.previousMonitoredData.clear();
    config.dataMonitoring?.start().subscribe(async (parameterValues: ParameterValueType[]) => {
      await this.handleMonitoringData(parameterValues, config, emitOnlyModifiedValue);
    });
  }

  private setDeviceReference(deviceRef: DeviceRef): void {
    this.deviceRef = deviceRef;
  }

  private mapParamsToTuples(params: IParameter[]): ParameterTuple[] {
    return params.map(({ index, sub_index }) => [this.deviceRef, Number(index.replace("#", "0")), Number(sub_index)]);
  }

  private createDataMonitoring(monitoringList: ParameterTuple[]): DataMonitoring | undefined {
    return this.motionMasterClientFunctionsInstance.client?.createDataMonitoring(monitoringList, Constants.DeviceMonitoringInterval);
  }

  private async handleMonitoringData(parameterValues: ParameterValueType[], config: MonitoringConfig, emitOnlyModifiedValue = true): Promise<void> {
    const changedData = this.getChangedMonitoredData(parameterValues, config.previousMonitoredData, config.monitoringList, emitOnlyModifiedValue);
    if (changedData.size > 0) {
      await this.handleCia402StateChange(changedData);
      this.emitMonitoredData(config.emitId, changedData);
    }
  }

  private async handleCia402StateChange(changedData: Map<string, ParameterValueType>): Promise<void> {
    if (changedData.has("6041:0")) {
      changedData.set("6041:0", await this.getCia402State());
    }
  }

  private stopMonitoring(config: MonitoringConfig): void {
    if (config.dataMonitoring) {
      config.dataMonitoring.stop();
      LexiumLogger.info(`Stopped monitoring for deviceRef ${this.deviceRef}. Collected data count: ${config.dataMonitoring.data.length}`);
      config.dataMonitoring = undefined;
    }
    config.monitoringList.length = 0;
    config.previousMonitoredData.clear();
  }

  private getChangedMonitoredData(
    parameterValues: ParameterValueType[],
    previousMonitoredData: Map<string, ParameterValueType>,
    monitoringList: ParameterTuple[],
    emitOnlyModifiedValue = true
  ): Map<string, ParameterValueType> {
    const changedData = new Map<string, ParameterValueType>();

    if (parameterValues.length !== monitoringList.length) {
      return changedData;
    }

    for (let idx = 0; idx < parameterValues.length; idx++) {
      let param = parameterValues[idx];
      if (typeof param === "number" && !Number.isInteger(param)) {
        param = Number.parseFloat(param.toFixed(6));
      }
      const [, index, subIndex] = monitoringList[idx];
      const key = `${index.toString(Constants.HEX_RADIX).toUpperCase()}:${subIndex.toString(Constants.HEX_RADIX).toUpperCase()}`;

      if (emitOnlyModifiedValue) {
        const prevData = previousMonitoredData.get(key);
        if (prevData !== param) {
          changedData.set(key, param);
          previousMonitoredData.set(key, param);
        }
      } else {
        changedData.set(key, param);
      }
    }
    return changedData;
  }

  private emitMonitoredData(emitId: string, monitoredData: Map<string, ParameterValueType>): void {
    const dataObj = Object.fromEntries(monitoredData);
    SocketBroadcaster.broadcast(emitId, JSON.stringify(dataObj));
  }
}
