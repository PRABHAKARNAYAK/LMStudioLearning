
import { MotionClient, AlarmInfo, ParamInfo } from './types';

const ALARMS: Record<string, AlarmInfo> = {
  'E123': {
    code: 'E123',
    title: 'Overvoltage during deceleration',
    causes: [
      'Braking resistor not sized/connected correctly',
      'Regeneration energy not dissipated',
      'Line voltage spikes'
    ],
    checks: [
      'Verify braking resistor wiring and value',
      'Check deceleration ramps and inertia',
      'Inspect supply quality and grounding'
    ],
    citation: 'Synapticon Sample Manual p.118'
  }
};

const PARAMS: Record<string, ParamInfo> = {
  'Pn200': {
    name: 'Pn200',
    description: 'Velocity loop proportional gain (Kvp). Higher values reduce speed error but may cause oscillation.',
    unit: '—',
    min: 0,
    max: 1000,
    default: 100,
    citation: 'Synapticon Sample Manual p.221'
  }
};

export const mockClient: MotionClient = {
  async getAlarmInfo(code: string) {
    const up = String(code).toUpperCase();
    return ALARMS[up] || { code: up, title: 'Unknown alarm', causes: [], checks: [], citation: 'Refer to official manual' };
  },
  async getParamInfo(name: string) {
    const key = String(name);
    return PARAMS[key] || { name: key, description: 'Unknown parameter', unit: '—', citation: 'Refer to official manual' };
  },
  async searchManuals(q: string, k: number = 5) {
    return [];
  }
};
