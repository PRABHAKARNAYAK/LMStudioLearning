import fs from "node:fs";
import path from "node:path";
import { IParameter } from "@LXM38I/se.ia.lexium38i.common.model";
import { LexiumLogger } from "./LexiumLogger";

const brakeFilePath = path.join(__dirname, "./assets/Brake.json");
const motorTransmissionFilePath = path.join(__dirname, "./assets/MotorTransmission.json");

type SearchableParameter = {
  parameter: IParameter;
  sourceId: string;
};

type ParameterCriteria = Record<string, string>;

interface ParameterFileData {
  id?: string;
  sub_groups?: Array<{
    parameters?: IParameter[];
  }>;
}

export class ParameterManagerService {
  private static instance: ParameterManagerService;
  private parameters: SearchableParameter[] = [];

  private constructor() {
    this.initialize();
  }

  public static getInstance(): ParameterManagerService {
    if (!ParameterManagerService.instance) {
      ParameterManagerService.instance = new ParameterManagerService();
    }
    return ParameterManagerService.instance;
  }

  public getParameterInfo(criteria: string): IParameter | undefined {
    if (!this.parameters.length) {
      this.populateParameters();
    }

    const matches = this.getMatchingParameters(criteria);
    return matches.length ? matches[0].parameter : undefined;
  }

  private initialize(): void {
    LexiumLogger.init();
    LexiumLogger.info("Initializing Parameter Manager Service");
    LexiumLogger.info(`File Path: ${brakeFilePath}`);
    LexiumLogger.info(`File Path: ${motorTransmissionFilePath}`);
    this.populateParameters();
  }

  private populateParameters(): boolean {
    this.parameters = this.readJsonData();

    if (!this.parameters.length) {
      LexiumLogger.error("No parameter data found for Parameter Manager Service");
      return false;
    }

    LexiumLogger.info(`Parameter entries loaded successfully. Count: ${this.parameters.length}`);
    return true;
  }

  private readJsonData(): SearchableParameter[] {
    const brakeParameters = this.readParametersFromFile(brakeFilePath);
    const motorTransmissionParameters = this.readParametersFromFile(motorTransmissionFilePath);

    return [...brakeParameters, ...motorTransmissionParameters];
  }

  private readParametersFromFile(filePath: string): SearchableParameter[] {
    try {
      const fileData = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(fileData) as ParameterFileData;
      const sourceId = parsed.id ?? "";

      if (!parsed.sub_groups?.length) {
        return [];
      }

      return parsed.sub_groups.flatMap((subGroup) =>
        (subGroup.parameters ?? []).map((parameter) => ({
          parameter,
          sourceId,
        })),
      );
    } catch (error) {
      LexiumLogger.error(`Failed to read parameter data from ${filePath}:`, error);
      return [];
    }
  }

  private getMatchingParameters(criteriaInput: string): SearchableParameter[] {
    const normalizedInput = criteriaInput.trim();
    if (!normalizedInput) {
      return [];
    }

    const parsedCriteria = this.parseKeyValueCriteria(normalizedInput);
    if (Object.keys(parsedCriteria).length > 0) {
      return this.parameters.filter((item) => this.matchesCriteria(item, parsedCriteria));
    }

    const indexAndSubIndex = this.parseIndexAndSubIndex(normalizedInput);
    const parsedIndex = indexAndSubIndex.index;
    if (parsedIndex !== undefined) {
      const exactIndexMatches = this.parameters.filter((item) => this.matchesIndexAndSubIndex(item.parameter, parsedIndex, indexAndSubIndex.subIndex));

      if (exactIndexMatches.length > 0) {
        return exactIndexMatches;
      }
    }

    const exactNameMatches = this.parameters.filter((item) => this.compareAsString(item.parameter.name, normalizedInput, true));
    if (exactNameMatches.length > 0) {
      return exactNameMatches;
    }

    return this.parameters.filter((item) => this.matchesTextSearch(item, normalizedInput));
  }

  private parseKeyValueCriteria(input: string): ParameterCriteria {
    const criteria: ParameterCriteria = {};
    const parts = input
      .split(/[,;]+/)
      .map((part) => part.trim())
      .filter(Boolean);

    for (const part of parts) {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      const rawKey = part.slice(0, separatorIndex).trim();
      const rawValue = part.slice(separatorIndex + 1).trim();
      if (!rawKey || !rawValue) {
        continue;
      }

      const normalizedKey = this.normalizeCriteriaKey(rawKey);
      if (normalizedKey) {
        criteria[normalizedKey] = rawValue;
      }
    }

    return criteria;
  }

  private normalizeCriteriaKey(key: string): string {
    const normalized = key.trim().toLowerCase();

    switch (normalized) {
      case "subindex":
      case "sub_index":
      case "sub-index":
        return "sub_index";
      case "idx":
      case "index":
        return "index";
      case "param":
      case "parameter":
      case "name":
        return "name";
      case "source":
      case "sourceid":
      case "id":
        return "sourceId";
      case "inputtype":
      case "input_type":
      case "input-type":
        return "inputType";
      case "recorddescription":
      case "record_description":
      case "record-description":
        return "recordDescription";
      default:
        return normalized;
    }
  }

  private matchesCriteria(item: SearchableParameter, criteria: ParameterCriteria): boolean {
    return Object.entries(criteria).every(([key, expected]) => this.matchesSingleCriterion(item, key, expected));
  }

  private matchesSingleCriterion(item: SearchableParameter, key: string, expected: string): boolean {
    const parameter = item.parameter;

    switch (key) {
      case "name":
        return this.compareAsString(parameter.name, expected);
      case "index":
        return this.normalizeIndex(parameter.index) === this.normalizeIndex(expected);
      case "sub_index":
        return this.normalizeSubIndex(parameter.sub_index) === this.normalizeSubIndex(expected);
      case "sourceId":
        return this.compareAsString(item.sourceId, expected);
      default:
        if (key in parameter) {
          const typedKey = key as keyof IParameter;
          return this.compareAsString(parameter[typedKey], expected);
        }
        return false;
    }
  }

  private parseIndexAndSubIndex(input: string): { index?: string; subIndex?: string } {
    const normalized = input.trim();

    for (const separator of [":", "/"]) {
      if (normalized.includes(separator)) {
        const [rawIndex, rawSubIndex] = normalized.split(separator).map((part) => part.trim());
        if (this.isLikelyHexIndex(rawIndex) && this.isLikelyHexSubIndex(rawSubIndex)) {
          return { index: rawIndex, subIndex: rawSubIndex };
        }
      }
    }

    if (this.isLikelyHexIndex(normalized)) {
      return { index: normalized };
    }

    return {};
  }

  private isLikelyHexIndex(value: string): boolean {
    const normalized = this.normalizeIndex(value);
    return normalized.length >= 3 && normalized.length <= 8;
  }

  private isLikelyHexSubIndex(value: string): boolean {
    const normalized = this.normalizeSubIndex(value);
    return normalized.length >= 1 && normalized.length <= 2;
  }

  private matchesIndexAndSubIndex(parameter: IParameter, index: string, subIndex?: string): boolean {
    const indexMatch = this.normalizeIndex(parameter.index) === this.normalizeIndex(index);
    if (!indexMatch) {
      return false;
    }

    if (subIndex === undefined) {
      return true;
    }

    return this.normalizeSubIndex(parameter.sub_index) === this.normalizeSubIndex(subIndex);
  }

  private matchesTextSearch(item: SearchableParameter, input: string): boolean {
    const parameter = item.parameter;

    return [
      parameter.name,
      parameter.index,
      parameter.sub_index,
      parameter.group,
      parameter.description,
      parameter.recordDescription,
      parameter.inputType,
      parameter.unit,
      parameter.esiType,
      item.sourceId,
    ].some((value) => this.compareAsString(value, input));
  }

  private compareAsString(actual: unknown, expected: string, exact = false): boolean {
    if (actual === undefined || actual === null) {
      return false;
    }
    if (!["string", "number", "boolean", "bigint"].includes(typeof actual)) {
      return false;
    }

    let normalizedActual = "";
    if (typeof actual === "string") {
      normalizedActual = actual.trim().toLowerCase();
    } else if (typeof actual === "number" || typeof actual === "boolean" || typeof actual === "bigint") {
      normalizedActual = actual.toString().trim().toLowerCase();
    }

    if (!normalizedActual) {
      return false;
    }

    const normalizedExpected = expected.trim().toLowerCase();

    if (!normalizedExpected) {
      return false;
    }

    return exact ? normalizedActual === normalizedExpected : normalizedActual.includes(normalizedExpected);
  }

  private normalizeIndex(index?: string): string {
    if (!index) {
      return "";
    }

    const lowered = index.toLowerCase();
    const withoutPrefix = this.stripHexPrefix(lowered);
    return [...withoutPrefix].filter((char) => this.isHexChar(char)).join("");
  }

  private normalizeSubIndex(subIndex?: string): string {
    if (!subIndex) {
      return "0";
    }

    const lowered = subIndex.toLowerCase();
    const withoutPrefix = this.stripHexPrefix(lowered);
    const normalized = [...withoutPrefix].filter((char) => this.isHexChar(char)).join("");

    return normalized.replace(/^0+/, "") || "0";
  }

  private stripHexPrefix(value: string): string {
    if (value.startsWith("#x") || value.startsWith("0x")) {
      return value.slice(2);
    }
    if (value.startsWith("x")) {
      return value.slice(1);
    }
    return value;
  }

  private isHexChar(char: string): boolean {
    return (char >= "0" && char <= "9") || (char >= "a" && char <= "f");
  }
}
