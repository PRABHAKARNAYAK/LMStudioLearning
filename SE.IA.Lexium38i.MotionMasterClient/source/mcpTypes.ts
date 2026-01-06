import { z } from "zod";

// Device-related types
export const DeviceInfo = z.object({
  deviceRef: z.string(),
  model: z.string().optional(),
  status: z.enum(["online", "offline", "error"]).optional(),
});
export type DeviceInfo = z.infer<typeof DeviceInfo>;

// Parameter types
export const ParameterInfo = z.object({
  name: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
  unit: z.string().optional(),
});
export type ParameterInfo = z.infer<typeof ParameterInfo>;

export const GroupInfo = z.object({
  groupId: z.string(),
  deviceRef: z.string(),
  parameters: z.array(ParameterInfo).optional(),
});
export type GroupInfo = z.infer<typeof GroupInfo>;

// Profile commands
export const ProfileCommand = z.object({
  deviceRef: z.string(),
  profileType: z.enum(["position", "velocity", "torque"]),
  parameters: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});
export type ProfileCommand = z.infer<typeof ProfileCommand>;

// Control panel response
export const ControlPanelInfo = z.object({
  deviceRef: z.string(),
  state: z.enum(["idle", "running", "paused", "error"]).optional(),
  position: z.number().optional(),
  velocity: z.number().optional(),
  torque: z.number().optional(),
});
export type ControlPanelInfo = z.infer<typeof ControlPanelInfo>;

// Diagnostics types
export const DiagnosticsData = z.object({
  deviceRef: z.string(),
  errors: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  faultCode: z.number().optional(),
  cia402State: z.string().optional(),
});
export type DiagnosticsData = z.infer<typeof DiagnosticsData>;

// Tuning types
export const TuningInfo = z.object({
  deviceRef: z.string(),
  tuningType: z.enum(["position", "velocity", "torque"]),
  kp: z.number().optional(),
  ki: z.number().optional(),
  kd: z.number().optional(),
});
export type TuningInfo = z.infer<typeof TuningInfo>;

export const SystemIdentificationData = z.object({
  deviceRef: z.string(),
  identified: z.boolean().optional(),
  parameters: z.record(z.number()).optional(),
});
export type SystemIdentificationData = z.infer<typeof SystemIdentificationData>;

export const TrajectoryPoint = z.object({
  timeMs: z.number().int().nonnegative(),
  position: z.number(),
  velocity: z.number().optional(),
});
export type TrajectoryPoint = z.infer<typeof TrajectoryPoint>;

export const SignalGeneratorConfig = z.object({
  deviceRef: z.string(),
  profileType: z.enum(["position", "velocity", "torque"]),
  amplitude: z.number().optional(),
  frequency: z.number().optional(),
  waveform: z.enum(["sine", "square", "triangle"]).optional(),
});
export type SignalGeneratorConfig = z.infer<typeof SignalGeneratorConfig>;

// Operation results
export const OperationResult = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.any().optional(),
});
export type OperationResult = z.infer<typeof OperationResult>;
