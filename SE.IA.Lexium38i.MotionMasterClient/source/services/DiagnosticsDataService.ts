import { DiagnosticsData, DiagnosticsDataList } from "@LXM38I/se.ia.lexium38i.common.model";
import path from "node:path";
import fs from "node:fs";
import { LexiumLogger } from "./LexiumLogger";
import { Constants } from "../utility/constants";

const errorAndWarningFilePath = path.join(__dirname, "./assets/ErrorAndWarningInfo.json");
const errorAndWarningFileV2Path = path.join(__dirname, "./assets/ErrorAndWarningInfoV2.json");
export class DiagnosticsDataService {
  private static instance: DiagnosticsDataService;
  private unDefineddiagnosticsData: DiagnosticsData;
  private diagnosticsData: DiagnosticsDataList = { list: [] };

  private constructor() {
    this.initializeDiagnosticsService();
  }

  public static getInstance(): DiagnosticsDataService {
    if (!DiagnosticsDataService.instance) {
      DiagnosticsDataService.instance = new DiagnosticsDataService();
    }
    return DiagnosticsDataService.instance;
  }

  private initializeDiagnosticsService() {
    LexiumLogger.init();
    LexiumLogger.info("Initializing Diagnostics Data Service");
    LexiumLogger.info("File Path: " + errorAndWarningFilePath);
    LexiumLogger.info("File Path: " + errorAndWarningFileV2Path);
    this.unDefineddiagnosticsData = {
      containsDiagnosticsData: true,
      errorCode: "Undefined",
      errorCodeList: [],
      errorReport: "Not Found",
      explanation: "-",
      group: "Undefined",
      remedy: Constants.ERROR_REMEDY_ALTERNATE_TEXT,
      id: "Undefined",
      longForm: "-",
      isFault: true,
    };
    this.populateDiagnosticsData();
  }

  // Populates the diagnostics data from the JSON file.
  private populateDiagnosticsData(): boolean {
    let returnValue = false;
    this.diagnosticsData = this.readJsonData();
    if (this.diagnosticsData.list.length === 0) {
      LexiumLogger.error("No diagnostics data found");
    }
    if (this.diagnosticsData.list.length > 0) {
      LexiumLogger.info(" diagnostics data entries loaded with count." + this.diagnosticsData.list.length);
      LexiumLogger.info("Diagnostics data loaded successfully.");
      returnValue = true;
    }
    return returnValue;
  }

  // Gets the diagnostics data by error id (decimal code, hex code, or error report string).
  public getErrorInfoById(errorId: string): DiagnosticsData | undefined {
    if (this.diagnosticsData.list.length === 0) {
      if (!this.populateDiagnosticsData()) {
        LexiumLogger.error("Failed to populate diagnostics data");
        return undefined;
      }
    }

    const normalizedInput = errorId.trim().toLowerCase();

    // Search by errorCode (decimal string match)
    let match = this.diagnosticsData.list.find((item) => String(item.errorCode ?? "").toLowerCase() === normalizedInput);
    console.log("1. Partial match result for input:", errorId, "is", match);
    if (match) return match;

    // Search by hex code (support both '0x1234' and '1234' hex input)
    const hexInput = normalizedInput.startsWith("0x") ? normalizedInput : `0x${normalizedInput}`;
    match = this.diagnosticsData.list.find((item) => item.id?.toLowerCase().startsWith(hexInput));
    console.log("2. Partial match result for input:", errorId, "is", match);
    if (match) return match;

    // Search by errorReport (description string)
    match = this.diagnosticsData.list.find((item) => String(item.errorReport ?? "").toLowerCase() === normalizedInput);
    console.log("3. Partial match result for input:", errorId, "is", match);
    if (match) return match;

    // Partial match on id or errorReport
    match = this.diagnosticsData.list.find(
      (item) =>
        item.id?.toLowerCase().includes(normalizedInput) ||
        String(item.errorReport ?? "")
          .toLowerCase()
          .includes(normalizedInput),
    );
    console.log("4. Partial match result for input:", errorId, "is", match);
    return match;
  }

  //Gets the diagnostics data by error code.
  public getDiagnosticsDataForError(errorCodeDecimal: string, errorDescription: string): DiagnosticsData {
    const diagnosticData = this.unDefineddiagnosticsData;
    diagnosticData.errorCode = errorCodeDecimal;

    diagnosticData.id = `${this.parseDecimalToHexString(errorCodeDecimal)}:${errorDescription}`;
    if (this.diagnosticsData.list.length == 0) {
      if (!this.populateDiagnosticsData()) {
        LexiumLogger.error("Failed to populate diagnostics data");
        return this.unDefineddiagnosticsData;
      }
    }

    return this.diagnosticsData.list.find((item) => item.errorReport === errorDescription) ?? diagnosticData;
  }

  /**
   * Parses a decimal string to a hexadecimal string.
   * @param decimalString The decimal string to parse.
   * @returns The hexadecimal representation of the decimal string.
   */
  private parseDecimalToHexString(decimalString: string): string {
    const decimal = parseInt(decimalString, 10);
    if (isNaN(decimal)) {
      LexiumLogger.error("Invalid decimal string: " + decimalString);
      return "0x0";
    }
    return `0x${decimal.toString(16)}`;
  }

  private readJsonData(): DiagnosticsDataList {
    LexiumLogger.info("Reading Diagnostics Data from JSON file");
    // Read and parse the first JSON file
    const data1 = fs.readFileSync(errorAndWarningFilePath, "utf8");
    const parsed1 = JSON.parse(data1);
    const list1: DiagnosticsData[] = Array.isArray(parsed1) ? parsed1 : (parsed1.list ?? []);
    LexiumLogger.info("Parsed Diagnostics Data from JSON file1: " + list1.length);
    // Read and parse the second JSON file
    const data2 = fs.readFileSync(errorAndWarningFileV2Path, "utf8");
    const parsed2 = JSON.parse(data2);
    const list2: DiagnosticsData[] = Array.isArray(parsed2) ? parsed2 : (parsed2.list ?? []);
    LexiumLogger.info("Parsed Diagnostics Data from JSON file2: " + list2.length);
    // Combine both lists
    const combinedList: DiagnosticsData[] = [...list1, ...list2];
    return { list: combinedList };
  }
}
