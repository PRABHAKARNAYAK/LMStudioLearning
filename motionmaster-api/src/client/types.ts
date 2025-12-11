
export interface AlarmInfo { code: string; title?: string; causes?: string[]; checks?: string[]; citation?: string; }
export interface ParamInfo { name: string; description?: string; unit?: string; min?: number; max?: number; default?: number|string; citation?: string; }
export interface MotionClient {
  getAlarmInfo(code: string, opts?: { model?: string; firmware?: string }): Promise<AlarmInfo>;
  getParamInfo(name: string): Promise<ParamInfo>;
  searchManuals?(q: string, k?: number): Promise<{ snippet: string; source: string; page?: number }[]>;
}
