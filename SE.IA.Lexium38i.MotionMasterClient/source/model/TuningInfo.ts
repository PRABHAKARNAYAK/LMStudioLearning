import { IParameter } from "@LXM38I/se.ia.lexium38i.common.model";
import { TuningMode } from "./TuningMode";

export interface TuningInfo {
  tuningModes: TuningModeInfo[];
}

/**
 * Represents the configuration for a position tuning mode.
 *
 * @remarks
 * This interface defines the structure for specifying a tuning mode,
 * including its name, input parameters, and monitoring parameters.
 *
 * @property tuningMode - The name or identifier of the tuning mode.
 * @property inputParameters - An array of parameters required for tuning input.
 * @property monitoringParameters - An array of parameters used for monitoring during tuning.
 */
export interface TuningModeInfo {
  tuningMode: TuningMode;
  inputParameters: IParameter[];
  monitoringParameters: IParameter[];
}
