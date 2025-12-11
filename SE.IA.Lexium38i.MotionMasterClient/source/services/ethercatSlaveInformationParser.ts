import { Parameter } from "../generated/source/assets/protos/GroupInfo_pb";
import path from "node:path";

const ecatmod = require("ecatmod");
const esiFilePath = path.join(__dirname, "./assets/Lexium38iEsi.xml");

/**
 * Singleton class responsible for parsing EtherCAT Slave Information (ESI) files and providing
 * device parameter extensions based on ESI data. This class loads and processes ESI XML files,
 * extracts device and module information, and maps device parameters to their corresponding
 * ESI dictionary objects, including metadata such as name, unit, min/max values, options, and
 * mapping capabilities. Use {@link EthercatSlaveInformationParser.getInstance} to access the singleton instance.
 */
export default class EthercatSlaveInformationParser {
  esi: any;
  private static ethercatSlaveInformationParserInstance: EthercatSlaveInformationParser;

  private constructor() {
    // Private to prevent direct instantiation
    this.ParseEsiFile();
  }

  /**
   * Returns the singleton instance of the EthercatSlaveInformationParser class.
   * Ensures that only one instance of the parser exists throughout the application.
   *
   * @returns {EthercatSlaveInformationParser} The singleton instance of the parser.
   */
  public static getInstance(): EthercatSlaveInformationParser {
    if (!EthercatSlaveInformationParser.ethercatSlaveInformationParserInstance) {
      EthercatSlaveInformationParser.ethercatSlaveInformationParserInstance = new EthercatSlaveInformationParser();
    }

    return EthercatSlaveInformationParser.ethercatSlaveInformationParserInstance;
  }

  /**
   * Extends a given device parameter with additional information from the ESI (EtherCAT Slave Information) dictionary.
   *
   * @param productCode - The product code of the device to look up in the ESI.
   * @param deviceParameter - The parameter to be extended with ESI data.
   * @returns A new {@link Parameter} instance populated with metadata and constraints from the ESI dictionary.
   *
   * @remarks
   * This method searches for the device and its modules in the ESI data using the provided product code.
   * It then attempts to find the corresponding object or sub-item in the device's dictionary and populates the output parameter
   * with relevant information such as name, description, unit, min/max values, options, and mapping capabilities.
   * If no matching object is found, the output parameter is returned with minimal information.
   */
  public deviceParameterEsiExtension(productCode: number, deviceParameter: Parameter): Parameter {
    const output: Parameter = new Parameter();
    output.setIndex(deviceParameter.getIndex());
    output.setSubIndex(deviceParameter.getSubIndex() || "");
    output.setReadonly(deviceParameter.getReadonly() || false);
    const ecatInfo = this.esi.value;

    const ecatDevice = ecatInfo?.descriptions?.devices?.device.find((d: any) => {
      return this.parseHexString(d.type?.productCode) === productCode;
    });

    let dictionary = ecatDevice?.profile[0]?.dictionary; // assuming device has only 1 profile

    // device has no dictionary
    // TODO: this might be a problem if device has no dictionary, but device parameter exists in one of its modules,
    // also a problem if two devices have the same product code
    if (!dictionary) {
      console.warn("No matching device in ESI found by product code!", productCode);
      return output;
    }

    let object = dictionary.objects.findByIndex(deviceParameter.getIndex());

    if (!object) {
      const deviceModules = ecatInfo.descriptions?.getDeviceModules(ecatDevice);

      if (deviceModules) {
        for (const module of deviceModules) {
          object = module.profile?.dictionary?.objects?.findByIndex(deviceParameter.getIndex());
          if (object) {
            dictionary = module.profile.dictionary;
            if (["#x22d20001", "#x22d20002"].includes(module.type?.moduleIdent?.toLowerCase())) {
              //output.isSmm = true;
              output.setIssmm(true);
            }
            break;
          }
        }
      }
    }

    if (!object) {
      // no object found in device or modules dictionaries
      return output;
    }

    if (dictionary.isObjectOfDataTypeVariable(object)) {
      output.setMandatory(dictionary.adoptedObjectFlag(object, "category") === "m");
      output.setMin(dictionary.minAllowedValueForObject(object));
      output.setMax(dictionary.maxAllowedValueForObject(object));
      output.setName(object.name[0].value);
      output.setDefaultdata(dictionary.defaultDataToNumberForObject(object));
      output.setUnit(object.info.unit ? object.info.unitSymbol : deviceParameter.getUnit() || "");
      output.setBitsize(object.bitSize);
      output.setEsitype(object.type);
      output.setDescription(dictionary.getDescriptionForObject(object));

      const options = dictionary.getOptionsForObject(object);
      if (options) {
        output.setOptions(JSON.stringify(options.replace(/\r?\n|\r/g, "")));
      }

      output.setCanbemappedasrxpdo(["r", "tr"].includes(dictionary.adoptedObjectFlag(object, "pdoMapping")));
      output.setCanbemappedastxpdo(["t", "tr"].includes(dictionary.adoptedObjectFlag(object, "pdoMapping")));
    } else {
      output.setGroup(object.nameValue);

      const subItem = dictionary.findObjectSubItemBySubIndex(object, Number.parseInt(deviceParameter.getSubIndex(), 16));
      const subItemType = dictionary.subItemTypeForObjectSubItem(object, subItem);

      output.setMandatory(dictionary.adoptedObjectSubItemFlag(object, subItem, "category") === "m");
      output.setMin(dictionary.minAllowedValueForObjectSubItem(object, subItem));
      output.setMax(dictionary.maxAllowedValueForObjectSubItem(object, subItem));

      if (subItem.info.displayName) {
        output.setName(subItem.info.displayName);
      } else {
        output.setName(subItem.name);
      }

      output.setDefaultdata(dictionary.defaultDataToNumberForObjectSubItem(object, subItem));
      output.setUnit(subItem.info.unit ? subItem.info.unitSymbol : deviceParameter.getUnit() || "");
      output.setBitsize(subItemType.bitSize);
      output.setEsitype(subItemType.type);

      const objectDescription = dictionary.getDescriptionForObject(object);

      if (deviceParameter.getSubIndex() === "0") {
        output.setDescription(objectDescription);
      } else {
        if (dictionary.isObjectOfDataTypeArray(object)) {
          output.setDescription(objectDescription);
          const options = dictionary.getOptionsForObject(object);
          if (options) {
            output.setOptions(JSON.stringify(options.replace(/\r?\n|\r/g, "")));
          }
        } else {
          if (dictionary.isObjectOfDataTypeRecord(object)) {
            output.setRecorddescription(objectDescription);
          }
          output.setDescription(dictionary.getDescriptionForObjectSubItem(object, subItem));
          const options = dictionary.getOptionsForObjectSubItem(object, subItem);
          if (options) {
            output.setOptions(JSON.stringify(options.replace(/\r?\n|\r/g, "")));
          }
        }
      }

      output.setCanbemappedasrxpdo(["r", "tr"].includes(dictionary.adoptedObjectSubItemFlag(object, subItem, "pdoMapping")));
      output.setCanbemappedastxpdo(["t", "tr"].includes(dictionary.adoptedObjectSubItemFlag(object, subItem, "pdoMapping")));
    }

    // fix issue with dictionary that returns undefined as string
    if (output.getDescription() === "undefined") {
      output.setDescription("");
    }

    // output.typeValue = deviceParameter.typeValue;

    // Set form input type based on parameter type value.
    if (output.getTypevalue() === "stringValue" || output.getTypevalue() === "rawValue") {
      output.setInputtype("text");
    } else {
      output.setInputtype("number");
    }

    if (output.getOptions()) {
      output.setInputtype("select");
    }

    output.setOriginaloptions(output.getOptions());

    return output;
  }

  private parseHexString(hexString: string): number {
    const cleanedHex = hexString.replace("#", "").replace("x", "");
    console.log(cleanedHex);
    console.log(parseInt(cleanedHex, 16));
    return parseInt(cleanedHex, 16);
  }

  private ParseEsiFile(): any {
    try {
      Object.defineProperty(exports, "__esModule", { value: true });
      Object.assign(globalThis, { WebSocket: require("ws") });
      const fs = require("fs");
      (global as any)._jsonix_xmldom = require("xmldom");
      (global as any)._jsonix_xmlhttprequest = require("xmlhttprequest");
      const contents = fs.readFileSync(esiFilePath, "utf8");
      this.esi = ecatmod.unmarshalEsiString(contents);
      ecatmod.applyToEsi(this.esi);
    } catch (error) {
      console.log("Error parsing ESI file" + error);
    }
  }
}
