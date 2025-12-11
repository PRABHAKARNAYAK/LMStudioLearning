import { IParameter } from "@LXM38I/se.ia.lexium38i.common.model";

/**
 * Represents the default set of monitoring parameters for the system.
 * Contains an array of `IParameter` objects that define the parameters to be monitored.
 */
export type DefaultMonitoringParameters = {
  monitoringParameters: IParameter[];
};
