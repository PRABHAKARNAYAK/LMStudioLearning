export interface AlarmInfo {
  code: string;
  title?: string;
  typical_causes?: string[];
  recommended_checks?: string[];
  manual_ref?: string;
}
export interface ParamInfo {
  name: string;
  description?: string;
  unit?: string;
  min?: number;
  max?: number;
  default?: number | string;
  manual_ref?: string;
}
export interface ManualChunk {
  snippet: string;
  source: string;
  page?: number;
}
function base() {
  const url = process.env.EXT_API_BASE || "http://localhost:4000";
  return url.replace(/\/$/, "");
}
async function get(path: string) {
  const r = await fetch(`${base()}${path}`);
  if (!r.ok) throw new Error(`External API ${r.status}: ${await r.text()}`);
  return r.json();
}
export async function fetchAlarmInfo(code: string, model?: string, firmware?: string): Promise<AlarmInfo> {
  const q = new URLSearchParams({ model: model || "", firmware: firmware || "" }).toString();
  const js = await get(`/api/synapticon/alarms/${encodeURIComponent(code)}${q ? `?${q}` : ""}`);
  return {
    code: js.code || code,
    title: js.title || js.name,
    typical_causes: js.causes || js.typical_causes || [],
    recommended_checks: js.actions || js.recommended_checks || [],
    manual_ref: js.manual_ref || js.citation,
  };
}
export async function fetchParamInfo(name: string): Promise<ParamInfo> {
  const js = await get(`/api/synapticon/params/${encodeURIComponent(name)}`);
  return {
    name: js.name || name,
    description: js.description,
    unit: js.unit,
    min: typeof js.min === "number" ? js.min : undefined,
    max: typeof js.max === "number" ? js.max : undefined,
    default: js.default,
    manual_ref: js.manual_ref || js.citation,
  };
}
export async function searchManuals(q: string, k: number = 5): Promise<ManualChunk[]> {
  const js = await get(`/api/synapticon/manuals/search?q=${encodeURIComponent(q)}&k=${k}`);
  const arr = js.items || js || [];
  return arr.map((it: any) => ({ snippet: it.snippet || it.text || "", source: it.source || it.title || "unknown", page: it.page || it.page_number }));
}
