import { Group, SubGroup, Property, Parameter } from "../generated/source/assets/protos/GroupInfo_pb";
import { HomingProcedureConfig, DataMonitoring, DeviceParameterValuesStatus, DeviceRef, ParameterValueType } from "motion-master-client";
import { Request, Response, NextFunction } from "express";
import path from "node:path";
import { MotionMasterClientFunctions } from "./MotionMasterClientFunctions";
import { SocketBroadcaster } from "../webSockets/SocketBroadcaster";
import { Constants } from "../utility/constants";
import ethercatSlaveInformationParser from "../services/ethercatSlaveInformationParser";
import { ControlPanelInfo, HomingModeGroup, OperatingMode, OperatingModeInfoType, ProfileOperatingMode } from "../model/ControlPanelInfo";
import { LexiumLogger } from "../services/LexiumLogger";
import ParametersMonitoringHandler from "../services/ParametersMonitoringHandler";
import { DefaultMonitoringParameters } from "../model/DefaultMonitoringParameters";
import { IGroup, IGroupNodeInfo, IParameter, ISubGroup } from "@LXM38I/se.ia.lexium38i.common.model";
import { ParametersProcessingHandler } from "../services/ParametersProcessingHandler";
import { HomingHandler } from "../services/HomingHandler";
import { HomingProcedureStatusMapper } from "../model/HomingProcedureStatusMapper";
import { NodeGroups, NodeGroup, NodeSubGroup, NodeParameter } from "../model/Lexium38iGroups";

const groupInfoJsonFilePath = path.join(__dirname, "./assets/Lexium38iGroupInfo.json");

const lexium38iProductNumber = 1025;
const internalServerError = 500;

class Lexium38iParameterInfoApi {
  private readonly motionMasterClientFunctionsInstance = MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance();
  private readonly parametersProcessingHandler = ParametersProcessingHandler.getInstance();

  private readonly parametersMonitoringHandler = ParametersMonitoringHandler.getInstance();
  private readonly homingHandler = HomingHandler.getInstance();

  private deviceParameterValuesStatus: DeviceParameterValuesStatus;
  private parameterList: [deviceRef: DeviceRef, index: number, subIndex: number][] = [];
  private parametersHex: string[] = [];
  private groupInfoMapper: IGroup = { id: "", sub_groups: [] };
  private groupDataMonitoring?: DataMonitoring;
  private previousMonitoredData: string | null = null;
  private _parameterIds = "";

  /**
   * Handles the HTTP request to retrieve information about a selected group for a specific device.
   *
   * @param req - The Express request object containing `deviceRef` and `groupId` parameters.
   * @param res - The Express response object used to send the group information or error response.
   * @param _next - The Express next middleware function (unused).
   * @returns A promise that resolves when the response is sent.
   *
   * @remarks
   * This method calls `getGroupInfo` to fetch group details and sends them in the response.
   * If an error occurs, it delegates error handling to `handleError`.
   */
  public getSelectedGroupInfo = async (req: Request, res: Response, _next: NextFunction) => {
    const deviceRef = req.params["deviceRef"];
    const selectedGroupId = req.params["groupId"];
    try {
      const groupInfo = await this.getGroupInfo(deviceRef, selectedGroupId);
      res.send(groupInfo);
    } catch (error) {
      this.handleError(res, error, `Error While getting the groupInfo ${selectedGroupId}`);
    }
  };

  /**
   * Handles the HTTP request to retrieve information about group nodes.
   *
   * This method asynchronously fetches group node information and sends it in the response.
   * If an error occurs during retrieval, it sends an error response with a relevant message.
   *
   * @param _req - The Express request object (unused).
   * @param res - The Express response object used to send the group node information.
   * @param _next - The Express next middleware function (unused).
   */
  public getGroupNodesInfo = async (_req: Request, res: Response, _next: NextFunction) => {
    try {
      const groupInfo = await this.getNodeInfo();
      res.send(groupInfo);
    } catch (error) {
      this.handleError(res, error, "Error While getting the groupNodesInfo");
    }
  };

  /**
   * Retrieves and sends control panel information for a specified device.
   *
   * @param req - Express request object containing the device reference in params.
   * @param res - Express response object used to send the control panel data.
   * @param _next - Express next middleware function (unused).
   * @returns A promise that resolves when the control panel information is sent in the response.
   * @summary Fetches parsed control panel data for a device and returns it in the HTTP response.
   */
  public getControlPanelInfo = async (req: Request, res: Response, _next: NextFunction) => {
    const deviceRef = req.params["deviceRef"];
    const selectedMode = req.query.selectedMode as string | undefined;

    try {
      const controlPanelData = await this.getParsedControlPanelInfo(deviceRef, selectedMode);
      res.send(controlPanelData);
    } catch (error) {
      this.handleError(res, error, `Error While getting control panel info for device ${deviceRef}`);
    }
  };

  /**
   * Handles the HTTP request to retrieve the default monitoring parameters for a specified device.
   *
   * @param req - The Express request object containing the device reference in the route parameters.
   * @param res - The Express response object used to send the default monitoring parameters or an error message.
   * @param _next - The Express next middleware function (unused).
   * @returns A Promise that resolves when the response is sent.
   */
  public getDefaultParameterInfo = async (req: Request, res: Response, _next: NextFunction) => {
    const deviceRef = req.params["deviceRef"];
    try {
      const defaultMonitoringParams = await this.getParsedDefaultMonitoringInfo(deviceRef);
      res.send(defaultMonitoringParams);
    } catch (error) {
      this.handleError(res, error, `Error While getting the default monitoringInfo for selected device ${deviceRef}`);
    }
  };

  /**
   * Initiates the homing procedure for a specified device using the provided configuration.
   *
   * @param req - Express request object containing the device reference in params and homing configuration in the body.
   * @param res - Express response object used to send the result of the operation.
   * @param _next - Express next middleware function (unused).
   * @returns A promise that resolves when the homing procedure is started or an error response is sent.
   *
   * @summary Starts the homing procedure for a device with the given configuration and handles success or failure responses.
   */
  public startHoming = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const deviceRef = req.params["deviceRef"];
      const homingProcedureConfig = req.body as HomingProcedureConfig;

      this.homingHandler.startHomingProcedure(deviceRef, homingProcedureConfig);

      res.status(Constants.HttpStatusOk).send({ message: "Homing procedure started." });
    } catch (error) {
      const errorMsg = (error as Error)?.message;
      const notificationInfo = HomingProcedureStatusMapper.requestStatus["failed"];
      SocketBroadcaster.broadcast(Constants.HomingProcedureCompleted, true);
      notificationInfo.message.description = errorMsg;
      this.handleError(res, error, JSON.stringify(notificationInfo));
    }
  };

  /**
   * Retrieves detailed information about a specific group for a given device reference.
   *
   * This method loads group data from a JSON file, resets parameter tracking, populates group information,
   * fetches device parameter values, and starts parameter monitoring. It returns a mapped group info object.
   *
   * @param deviceRef - The reference identifier for the target device.
   * @param groupId - The identifier of the group to retrieve information for.
   * @returns A promise that resolves to the group information object.
   */
  public async getGroupInfo(deviceRef: string, groupId: string): Promise<IGroup> {
    const groupInfo = new Group();
    try {
      const nodeGroupsData = this.parametersProcessingHandler.getJsonData<NodeGroups>(groupInfoJsonFilePath).Groups;
      if (nodeGroupsData[groupId]) {
        this.resetParameterTracking();
        this.populateGroupInfo(groupInfo, nodeGroupsData[groupId], deviceRef);
      }
      const parameterIds = this.getParameterIdsString();
      this.deviceParameterValuesStatus = await this.motionMasterClientFunctionsInstance.getDeviceParameterValues(deviceRef, parameterIds);
      this.groupInfoMapper = {
        id: groupInfo.getId(),
        sub_groups: this.getSubGroups(groupInfo),
      };
      this.startParameterMonitoring();
    } catch (error) {
      LexiumLogger.error("Error parsing Lexium38iGroupInfo.JSON:", error);
    }
    return this.groupInfoMapper;
  }

  private resetParameterTracking() {
    this.parameterList = [];
    this.parametersHex = [];
    this._parameterIds = "";
  }

  private populateGroupInfo(groupInfo: Group, jsonGroupInfo: NodeGroup, deviceRef: string) {
    const groupTitles = new Set<string>();
    groupInfo.setId(jsonGroupInfo.Id);

    jsonGroupInfo.SubGroups.forEach((subGroup: NodeSubGroup) => {
      const groupSubGroup = new SubGroup();
      groupSubGroup.setTitle(subGroup.Title);

      subGroup.Parameters.forEach((parameterNode: NodeParameter) => {
        const groupParameter = this.createAndTrackParameter(parameterNode, deviceRef);
        groupSubGroup.addParameters(groupParameter);

        const groupName = groupParameter.getGroup();
        if (groupName && !groupTitles.has(groupName)) {
          groupTitles.add(groupName);
          const groupProperty = new Property();
          groupProperty.setTitle(groupName);
          if (groupParameter.getRecorddescription()) {
            groupProperty.setDescription(groupParameter.getRecorddescription());
          }
          groupSubGroup.addProperties(groupProperty);
        }
      });

      groupInfo.addSubGroups(groupSubGroup);
    });
  }

  private createAndTrackParameter(parameterNode: NodeParameter, deviceRef: string): Parameter {
    const index = this.parametersProcessingHandler.replaceHashWithZero(parameterNode.Index);
    const subIndex = parameterNode.SubIndex ?? "00";
    this.parametersHex.push(`${parameterNode.Index}:${parameterNode.SubIndex ?? ""}`);
    this.parameterList.push([deviceRef, Number(index), Number.parseInt(subIndex, 16)]);
    this._parameterIds += `${index}:${subIndex},`;

    let groupParameter = new Parameter();
    groupParameter.setIndex(parameterNode.Index);
    groupParameter.setSubIndex(parameterNode.SubIndex || "");
    groupParameter.setReadonly(parameterNode.readOnly || false);
    groupParameter = ethercatSlaveInformationParser.getInstance().deviceParameterEsiExtension(lexium38iProductNumber, groupParameter);

    return groupParameter;
  }

  private getParameterIdsString(): string {
    const ids = this._parameterIds.slice(0, -1);
    this._parameterIds = "";
    return ids;
  }

  private async getNodeInfo(): Promise<IGroupNodeInfo[]> {
    const groupNodesInfo: IGroupNodeInfo[] = [];
    try {
      const nodeGroupsData = this.parametersProcessingHandler.getJsonData<NodeGroups>(groupInfoJsonFilePath);
      for (const nodeGroup of Object.values(nodeGroupsData)) {
        const subGroups = nodeGroup.SubGroups.map((subGroup: NodeSubGroup) => subGroup.Title).filter(Boolean);
        groupNodesInfo.push({ id: nodeGroup.Id, subGroups });
      }
    } catch (error) {
      LexiumLogger.error("Error parsing Lexium38iGroupInfo.JSON:", error);
    }
    return groupNodesInfo;
  }

  private async getParsedControlPanelInfo(deviceRef: string, selectedMode?: string) {
    const controlPanelInfoJsonFilePath = path.join(__dirname, "./assets/ControlPanelInfo.json");
    const controlPanelData = this.parametersProcessingHandler.getJsonData<ControlPanelInfo>(controlPanelInfoJsonFilePath);

    for (const mode of controlPanelData.operatingModes) {
      await this.processControlPanelInputParameters(mode, deviceRef);

      await this.processControlPanelMonitoringParameters(mode, deviceRef, selectedMode);
    }
    return controlPanelData;
  }

  private async processControlPanelInputParameters(mode: OperatingModeInfoType, deviceRef: string) {
    if (mode.mode === OperatingMode.Homing && (mode as HomingModeGroup)) {
      await this.homingHandler.processHomingModeGroup(mode as HomingModeGroup, deviceRef);
    } else {
      const profileMode = mode as ProfileOperatingMode;
      if (profileMode) {
        await this.parametersProcessingHandler.processDeviceInputParameters(profileMode.inputParameters, deviceRef);
      }
    }
  }

  private async processControlPanelMonitoringParameters(mode: OperatingModeInfoType, deviceRef: string, selectedMode: string | undefined) {
    if (mode?.monitoringParameters?.length) {
      await this.parametersProcessingHandler.processDeviceInputParameters(mode.monitoringParameters, deviceRef);
      if (selectedMode && mode?.mode.toString() === selectedMode) {
        this.parametersMonitoringHandler.startMonitoring(deviceRef, mode.monitoringParameters);
      }
    }
  }

  private async getParsedDefaultMonitoringInfo(deviceRef: string) {
    const defaultMonitoringParamsFilePath = path.join(__dirname, "./assets/DefaultMonitoringParameters.json");
    const defaultMonitoringParams = this.parametersProcessingHandler.getJsonData<DefaultMonitoringParameters>(defaultMonitoringParamsFilePath);

    await this.parametersProcessingHandler.processDeviceInputParameters(defaultMonitoringParams.monitoringParameters, deviceRef);

    this.parametersMonitoringHandler.startDefaultMonitoring(deviceRef, defaultMonitoringParams.monitoringParameters);
    return defaultMonitoringParams;
  }

  private startParameterMonitoring() {
    if (this.parameterList.length) {
      this.groupDataMonitoring?.stop();
      this.groupDataMonitoring = this.motionMasterClientFunctionsInstance.client?.createDataMonitoring(this.parameterList, Constants.ParameterMonitoringInterval);
      this.groupDataMonitoring?.start().subscribe((response: ParameterValueType[]) => {
        this.handleParameterUpdates(response);
      });
    }
  }

  private handleParameterUpdates(data: ParameterValueType[]) {
    if (this.parametersHex.length === data.length) {
      try {
        const monitoredData = this.parametersHex.map((parameter, index) => `${parameter}:${data[index]}`);

        let previousDataArr: string[] = [];
        if (this.previousMonitoredData) {
          previousDataArr = Array.isArray(JSON.parse(this.previousMonitoredData)) ? JSON.parse(this.previousMonitoredData) : [];
        }

        const updatedData: string[] = monitoredData.filter((item, idx) => item !== previousDataArr[idx]);
        if (updatedData.length > 0) {
          SocketBroadcaster.broadcast(Constants.EtherCatParametersMonitoredData, JSON.stringify(updatedData));
          this.previousMonitoredData = JSON.stringify(monitoredData);
        }
      } catch (error) {
        LexiumLogger.error("Error in monitored data processing:", error);
      }
    }
  }

  private getSubGroups(groupInfo: Group): ISubGroup[] {
    return groupInfo.getSubGroupsList().map((subGroupItem: SubGroup) => ({
      parameters: this.getParameters(subGroupItem),
    }));
  }

  private getParameters(subGroupItem: SubGroup): IParameter[] {
    return subGroupItem.getParametersList().map((parameter: Parameter) => this.parametersProcessingHandler.mapParameterToIParameter(parameter, this.deviceParameterValuesStatus));
  }

  private handleError(res: Response, error: unknown, message: string) {
    const errorMsg = `${(error as Error).message} ${message}`;
    LexiumLogger.error(errorMsg);
    res.status(internalServerError).json({ message: errorMsg });
  }
}

export default new Lexium38iParameterInfoApi();
