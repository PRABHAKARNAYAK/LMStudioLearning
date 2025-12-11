import fs from "node:fs";
import { IParameter } from "@LXM38I/se.ia.lexium38i.common.model";
import { Parameter } from "../generated/source/assets/protos/GroupInfo_pb";
import ethercatSlaveInformationParser from "../services/ethercatSlaveInformationParser";
import { DeviceParameterValuesStatus, DeviceRef } from "motion-master-client";
import { MotionMasterClientFunctions } from "../controllers/MotionMasterClientFunctions";
import { LexiumLogger } from "./LexiumLogger";

const LEXIUM38I_PRODUCT_NUMBER = 1025;

/**
 * Singleton handler for processing device parameters.
 * Provides methods to read JSON data, process monitoring parameters,
 * convert between IParameter and Parameter types, and fetch parameter values.
 */
export class ParametersProcessingHandler {
  private static instance: ParametersProcessingHandler;
  private readonly motionMasterClientFunctionsInstance = MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance();

  private constructor() {}

  public static getInstance(): ParametersProcessingHandler {
    if (!ParametersProcessingHandler.instance) {
      ParametersProcessingHandler.instance = new ParametersProcessingHandler();
    }
    return ParametersProcessingHandler.instance;
  }

  /**
   * Reads and parses JSON data from a file.
   * @param filePath - Path to the JSON file.
   * @returns Parsed JSON data as type T.
   * @throws If reading or parsing fails.
   */
  public getJsonData<T>(filePath: string): T {
    try {
      const data = fs.readFileSync(filePath, "utf8");
      return JSON.parse(data) as T;
    } catch (error) {
      LexiumLogger.error(`Error reading/parsing file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Processes an array of monitoring parameters for a given device.
   * Updates each parameter in-place with its latest value from the device.
   * @param params - Array of IParameter objects to process.
   * @param deviceRef - Reference to the target device.
   */
  public async processDeviceInputParameters(params: IParameter[], deviceRef: DeviceRef): Promise<void> {
    await Promise.all(
      params.map(async (param, i) => {
        if (param.index !== "") {
          params[i] = await this.processParameter(param, deviceRef);
        }
      })
    );
  }

  /**
   * Processes a single parameter for a given device.
   * Converts IParameter to Parameter, fetches its latest value from the device,
   * and returns an updated IParameter with the current value.
   * @param param - The IParameter to process.
   * @param deviceRef - Reference to the target device.
   * @returns Updated IParameter with the latest value.
   */
  public async processParameter(param: IParameter, deviceRef: DeviceRef): Promise<IParameter> {
    const parameter = this.createParameterFromIParameter(param);
    const parameterIds = `${this.replaceHashWithZero(param.index)}:${param.sub_index ?? "00"}`;
    const parameterValuesStatus = await this.motionMasterClientFunctionsInstance.getDeviceParameterValues(deviceRef, parameterIds, true, true);
    return this.mapParameterToIParameter(parameter, parameterValuesStatus);
  }

  /**
   * Converts an IParameter object to a Protocol Buffer Parameter object.
   * Sets the index and subIndex, then applies device-specific ESI extension.
   * @param parameter - The IParameter to convert.
   * @returns The extended Parameter object.
   */
  public createParameterFromIParameter(parameter: IParameter): Parameter {
    const paramObj = new Parameter();
    paramObj.setIndex(parameter.index);
    paramObj.setSubIndex(parameter.sub_index || "");
    paramObj.setReadonly(parameter.readOnly || false);
    paramObj.setUnit(parameter.unit || "");
    return ethercatSlaveInformationParser.getInstance().deviceParameterEsiExtension(LEXIUM38I_PRODUCT_NUMBER, paramObj);
  }

  /**
   * Replaces the hash symbol (#) in a hex string with zero (0).
   * Used to normalize parameter index formats for device communication.
   * @param hexString - The hex string to modify.
   * @returns The modified string with # replaced by 0.
   */
  public replaceHashWithZero(hexString: string): string {
    return hexString.replace("#", "0");
  }

  /**
   * Maps a Protocol Buffer Parameter object and its value status to an IParameter object.
   * Copies all relevant fields and sets the current value from DeviceParameterValuesStatus.
   * @param parameter - The Protocol Buffer Parameter to map.
   * @param parameterValuesStatus - The status containing parameter values.
   * @returns The mapped IParameter object with updated value.
   */
  public mapParameterToIParameter(parameter: Parameter, parameterValuesStatus: DeviceParameterValuesStatus): IParameter {
    return {
      name: parameter.getName(),
      index: parameter.getIndex(),
      sub_index: parameter.getSubIndex(),
      unit: parameter.getUnit(),
      min: parameter.getMin(),
      max: parameter.getMax(),
      defaultData: parameter.getDefaultdata(),
      mandatory: parameter.getMandatory(),
      description: parameter.getDescription(),
      inputType: parameter.getInputtype(),
      isSmm: parameter.getIssmm(),
      bitSize: parameter.getBitsize(),
      esiType: parameter.getEsitype(),
      canBeMappedAsRxPdo: parameter.getCanbemappedasrxpdo(),
      canBeMappedAsTxPdo: parameter.getCanbemappedastxpdo(),
      recordDescription: parameter.getRecorddescription(),
      options: parameter.getOptions(),
      group: parameter.getGroup(),
      typeValue: parameter.getTypevalue(),
      originalOptions: parameter.getOriginaloptions(),
      value: this.fetchParameterValue(parameter.getIndex(), Number.parseInt(parameter.getSubIndex(), 16).toString(), parameterValuesStatus),
      readOnly: parameter.getReadonly(),
    };
  }

  private fetchParameterValue(index: string, subIndex: string, parameterValueStatus: DeviceParameterValuesStatus): number {
    const indexParsed = this.parseHexString(index);
    const subIndexParsed = this.normalizeSubIndex(subIndex);
    const parameter = parameterValueStatus?.parameterValues?.find(
      (parameterItem) => parameterItem.index?.toString() === indexParsed.toString() && parameterItem.subindex?.toString() === subIndexParsed
    );
    if (parameter?.success) {
      if (parameter.floatValue !== undefined && parameter.floatValue !== null) {
        return Number.parseFloat(parameter.floatValue.toFixed(6));
      }
      return parameter.uintValue ?? parameter.intValue ?? 0;
    }
    return 0;
  }

  private parseHexString(hexString: string): number {
    return Number.parseInt(hexString.replace("#", "").replace("x", ""), 16);
  }

  private normalizeSubIndex(subIndex: string): string {
    return !subIndex || Number.isNaN(Number(subIndex)) ? "0" : subIndex.replace(/^0+/, "") || "0";
  }
}
