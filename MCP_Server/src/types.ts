
import { z } from "zod";

export const ServoDevice = z.object({
  id: z.string(),
  model: z.string().optional(),
  port: z.string().optional(),
  status: z.enum(["online","offline"]).optional(),
});
export type ServoDevice = z.infer<typeof ServoDevice>;

export const MoveCommand = z.object({
  position: z.number(),
  speed: z.number().positive().optional(),
  accel: z.number().positive().optional(),
  decel: z.number().positive().optional(),
  unit: z.enum(["mm","deg","steps"]).optional(),
});
export type MoveCommand = z.infer<typeof MoveCommand>;

export const JogCommand = z.object({
  direction: z.enum(["positive","negative"]),
  speed: z.number().positive().optional(),
  durationMs: z.number().int().positive().optional(),
});
export type JogCommand = z.infer<typeof JogCommand>;

export const TrajectoryPoint = z.object({
  timeMs: z.number().int().nonnegative(),
  position: z.number(),
  speed: z.number().positive().optional(),
});
export type TrajectoryPoint = z.infer<typeof TrajectoryPoint>;

export const Trajectory = z.object({
  points: z.array(TrajectoryPoint).min(1),
  loop: z.boolean().optional(),
});
export type Trajectory = z.infer<typeof Trajectory>;

export const ParamKV = z.object({
  name: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
});
export type ParamKV = z.infer<typeof ParamKV>;

export const Status = z.object({
  id: z.string(),
  state: z.enum(["idle","moving","homing","error","stopped"]).optional(),
  position: z.number().optional(),
  velocity: z.number().optional(),
  torque: z.number().optional(),
  errors: z.array(z.string()).optional(),
  ts: z.string().optional(),
});
export type Status = z.infer<typeof Status>;

export const Diagnostics = z.object({
  id: z.string(),
  firmware: z.string().optional(),
  temperatureC: z.number().optional(),
  faultCodes: z.array(z.string()).optional(),
  supplyVoltage: z.number().optional(),
});
export type Diagnostics = z.infer<typeof Diagnostics>;

export const PingResult = z.object({ ok: z.literal(true), now: z.string() });
export type PingResult = z.infer<typeof PingResult>;
