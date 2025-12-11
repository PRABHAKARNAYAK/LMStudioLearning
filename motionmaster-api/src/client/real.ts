
import { MotionClient, AlarmInfo, ParamInfo } from './types';
import { pathToFileURL } from 'url';

async function loadModule(spec: string) {
  if (spec.startsWith('file:')) return (await import(spec));
  if (/^[A-Za-z]:\\/.test(spec)) { const url = pathToFileURL(spec).href; return (await import(url)); }
  return (await import(spec));
}

export async function createRealClient(): Promise<MotionClient> {
  const modSpec = process.env.MMC_MODULE || '';
  if (!modSpec) throw new Error('MMC_MODULE not set');
  const mod = await loadModule(modSpec);
  const Cls = mod.MotionMasterClient || mod.default;
  if (!Cls) throw new Error('MotionMasterClient export not found in module');
  const client = new Cls({ host: process.env.MMC_HOST || '127.0.0.1', port: Number(process.env.MMC_PORT || 502) });
  const api: MotionClient = {
    async getAlarmInfo(code: string, opts?: { model?: string; firmware?: string }): Promise<AlarmInfo> {
      const r = await client.getAlarmInfo(code, opts);
      return { code, title: r.title, causes: r.causes, checks: r.checks, citation: r.citation };
    },
    async getParamInfo(name: string): Promise<ParamInfo> {
      const r = await client.getParamInfo(name);
      return { name, description: r.description, unit: r.unit, min: r.min, max: r.max, default: r.default, citation: r.citation };
    },
    async searchManuals(q: string, k: number = 5) {
      if (typeof client.searchManuals === 'function') return client.searchManuals(q, k);
      return [];
    }
  };
  return api;
}
