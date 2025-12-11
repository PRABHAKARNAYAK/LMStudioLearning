import { IParameter } from "@LXM38I/se.ia.lexium38i.common.model";

/**
 * Represents information about the control panel, including available operating modes.
 *
 * @remarks
 * This interface is used to encapsulate the set of operating modes that can be configured or displayed on the control panel.
 *
 * @property operatingModes - An array of operating mode information objects, each describing a specific mode supported by the control panel.
 */
export interface ControlPanelInfo {
  operatingModes: OperatingModeInfoType[];
}

/**
 * Represents information about an operating mode supported by the control panel.
 * This type can be either a `HomingModeGroup` (for homing operations) or a `ProfileOperatingMode`
 * (for position, velocity, or torque modes).
 */
export type OperatingModeInfoType = HomingModeGroup | ProfileOperatingMode;

/**
 * Represents the operating mode profile for a control panel.
 *
 * @property mode - The numeric identifier for the operating mode.
 * @property description - A human-readable description of the operating mode.
 * @property inputParameters - The list of input parameters required for this mode.
 * @property monitoringParameters - The list of parameters monitored in this mode.
 */
export interface ProfileOperatingMode {
  mode: number;
  description: string;
  inputParameters: IParameter[];
  monitoringParameters: IParameter[];
}

/**
 * Represents the configuration and parameters for the homing mode group.
 * Contains information about available homing methods, selected method, and related monitoring parameters.
 */
export interface HomingModeGroup {
  mode: OperatingMode.Homing;
  homingMethods: HomingMethodInfo[];
  monitoringParameters: IParameter[];
  homingMethod: IParameter;
  homeOffset: IParameter;
}

/**
 * Represents information about a homing method used in motion control.
 *
 * @remarks
 * This interface provides details about a specific homing method, including its type,
 * a human-readable description, and the input parameters required for configuration.
 *
 * @property homingMethod - The type of homing method being described.
 * @property description - A textual description of the homing method.
 * @property inputParameters - An array of parameters required to configure the homing method.
 */
export interface HomingMethodInfo {
  homingMethod: HomingMethod;
  description: string;
  inputParameters: IParameter[];
}

/**
 * Represents the available operating modes for the control panel.
 *
 * - `Homing`: Used for referencing or zeroing the system.
 * - `Position`: Controls the position of the actuator.
 * - `Velocity`: Controls the speed of the actuator.
 * - `Torque`: Controls the torque output of the actuator.
 */
export enum OperatingMode {
  Homing,
  Position,
  Velocity,
  Torque,
}

/**
 * Represents the available homing methods for a motion control system.
 * Each enum value corresponds to a specific homing procedure, identified by its numeric code.
 * The homing method determines how the system establishes its reference position.
 */
export enum HomingMethod {
  Minus4 = -4,
  Minus3 = -3,
  Minus2 = -2,
  Minus1 = -1,
  Zero = 0,
  One = 1,
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
  Ten = 10,
  Eleven = 11,
  Twelve = 12,
  Thirteen = 13,
  Fourteen = 14,
  Fifteen = 15,
  Sixteen = 16,
  Seventeen = 17,
  Eighteen = 18,
  Nineteen = 19,
  Twenty = 20,
  TwentyOne = 21,
  TwentyTwo = 22,
  TwentyThree = 23,
  TwentyFour = 24,
  TwentyFive = 25,
  TwentySix = 26,
  TwentySeven = 27,
  TwentyEight = 28,
  TwentyNine = 29,
  Thirty = 30,
  ThirtyOne = 31,
  ThirtyTwo = 32,
  ThirtyThree = 33,
  ThirtyFour = 34,
  ThirtyFive = 35,
  ThirtySeven = 37,
}
