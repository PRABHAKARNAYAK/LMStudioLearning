import { IParameter } from "@LXM38I/se.ia.lexium38i.common.model";

/**
 * Represents information about a motion trajectory, including its type, target position,
 * and associated input parameters.
 *
 * @property trajectoryType - The type or name of the trajectory.
 * @property position - The target position for the trajectory.
 * @property inputParameters - An array of input parameters relevant to the trajectory.
 */
export interface TrajectoryType {
  trajectoryType: string;
  position: number;
  inputParameters: IParameter[];
}

/**
 * Represents information about a tuning trajectory, including the types of trajectories
 * and the parameters being monitored during the tuning process.
 *
 * @property trajectoryTypes - An array of available trajectory types for tuning.
 * @property monitoringParameters - An array of parameters that are monitored during the trajectory.
 */
export interface TuningTrajectoryInfo {
  trajectoryTypes: TrajectoryType[];
  monitoringParameters: IParameter[];
}
