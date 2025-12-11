import { fetchAlarmInfo, fetchParamInfo, searchManuals } from "./adapters/synapticonApi";
export const tools = [
  {
    type: "function",
    function: {
      name: "get_alarm_info",
      description: "Alarm description and typical causes (read-only).",
      parameters: { type: "object", properties: { code: { type: "string" }, model: { type: "string" }, firmware: { type: "string" } }, required: ["code"] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_param_info",
      description: "Parameter metadata (read-only).",
      parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    },
  },
  {
    type: "function",
    function: {
      name: "search_manuals",
      description: "Search manuals for citations (read-only).",
      parameters: { type: "object", properties: { q: { type: "string" }, k: { type: "number", default: 5 } }, required: ["q"] },
    },
  },
] as const;
export async function executeToolCall(name: string, args: any) {
  switch (name) {
    case "get_alarm_info":
      return await fetchAlarmInfo(args.code, args.model, args.firmware);
    case "get_param_info":
      return await fetchParamInfo(args.name);
    case "search_manuals":
      return { items: await searchManuals(args.q, args.k ?? 5) };
    default:
      throw new Error(`Unknown tool ${name}`);
  }
}
