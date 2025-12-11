import { Router } from "express";
import { tools, executeToolCall } from "../tools/synapticonTools";
const router = Router();
function env() {
  return {
    base: process.env.LMSTUDIO_BASE_URL || "http://localhost:1234/v1",
    key: process.env.LMSTUDIO_API_KEY || "lm-studio",
    model: process.env.LMSTUDIO_MODEL || "meta-llama-3.1-8b-instruct",
  } as const;
}
router.post("/chat-tools", async (req, res) => {
  const { question } = req.body as { question: string };
  const { base, key, model } = env();
  const messages: any[] = [
    { role: "system", content: "You are a Synapticon servo-drive assistant. Use tools when needed. Informational only." },
    { role: "user", content: question },
  ];
  const first = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, tools, tool_choice: "auto", temperature: 0.2 }),
  }).then((r) => r.json());
  console.log("First response:", JSON.stringify(first));
  const msg = first?.choices?.[0]?.message;
  const toolCalls = msg?.tool_calls || [];
  if (!toolCalls.length) return res.json({ answer: msg?.content || "" });
  const toolResults: any[] = [];
  for (const call of toolCalls) {
    const args = JSON.parse(call.function?.arguments || "{}");
    const result = await executeToolCall(call.function?.name, args);
    toolResults.push({ role: "tool", tool_call_id: call.id, name: call.function?.name, content: JSON.stringify(result) });
  }
  const second = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, temperature: 0.2, messages: [...messages, msg, ...toolResults] }),
  }).then((r) => r.json());
  const final = second?.choices?.[0]?.message?.content || "";
  res.json({ answer: final, debug: { first, second } });
});
export default router;
