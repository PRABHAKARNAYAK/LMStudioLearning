
import { MotionClient } from './types';
import { mockClient } from './mock';
import { createRealClient } from './real';

let cached: MotionClient | null = null;

export async function getClient(): Promise<MotionClient> {
  if (cached) return cached;
  const mode = (process.env.MMC_MODE || 'mock').toLowerCase();
  if (mode === 'real') {
    try { cached = await createRealClient(); return cached; } catch (e) { console.warn('[MMC] Failed to init real client:', e); }
  }
  cached = mockClient; return cached;
}
