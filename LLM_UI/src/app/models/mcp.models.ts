export interface ServoDevice {
  id: string;
  model?: string;
  port?: string;
  status?: 'online' | 'offline';
}

export interface MoveCommand {
  position: number;
  speed?: number;
  accel?: number;
  decel?: number;
  unit?: 'mm' | 'deg' | 'steps';
}

export interface JogCommand {
  direction: 'positive' | 'negative';
  speed?: number;
  durationMs?: number;
}

export interface TrajectoryPoint {
  timeMs: number;
  position: number;
  speed?: number;
}

export interface Trajectory {
  points: TrajectoryPoint[];
  loop?: boolean;
}

export interface ParamKV {
  name: string;
  value: string | number | boolean;
}

export interface Status {
  id: string;
  state?: 'idle' | 'moving' | 'homing' | 'error' | 'stopped';
  position?: number;
  velocity?: number;
  torque?: number;
  errors?: string[];
  ts?: string;
}

export interface Diagnostics {
  id: string;
  firmware?: string;
  temperatureC?: number;
  faultCodes?: string[];
  supplyVoltage?: number;
}

export interface PingResult {
  ok: true;
  now: string;
}

export interface MCPResponse<T = any> {
  content?: Array<{ type: string; text: string }>;
  structuredContent?: T;
}

export interface MCPRequest {
  jsonrpc: '2.0';
  method: string;
  params?: {
    name: string;
    arguments?: any;
  };
  id: number;
}

export interface MCPInitializeRequest {
  jsonrpc: '2.0';
  method: 'initialize';
  params: {
    protocolVersion: string;
    capabilities: {};
    clientInfo: {
      name: string;
      version: string;
    };
  };
  id: number;
}

export interface MCPListToolsRequest {
  jsonrpc: '2.0';
  method: 'tools/list';
  params?: {};
  id: number;
}

export interface MCPCallToolRequest {
  jsonrpc: '2.0';
  method: 'tools/call';
  params: {
    name: string;
    arguments?: any;
  };
  id: number;
}
