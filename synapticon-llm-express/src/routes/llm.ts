import { Router } from "express";
const router = Router();
function env() {
  return {
    base: process.env.LMSTUDIO_BASE_URL || "http://localhost:1234/v1",
    key: process.env.LMSTUDIO_API_KEY || "lm-studio",
    model: process.env.LMSTUDIO_MODEL || "meta-llama-3.1-8b-instruct",
  } as const;
}
router.post("/chat", async (req, res) => {
  const { question, context } = req.body;
  const { base, key, model } = env();
  const messages: any[] = [
    { role: "system", content: "You are a Synapticon servo-drive assistant; informational only; include safety notes and citations; never suggest unsafe actions." },
  ];
  if (context)
    messages.push({
      role: "user",
      content: `Context
${context}`,
    });
  messages.push({ role: "user", content: question });
  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: model, messages, temperature: 0.2 }),
    });
    if (!r.ok) return res.status(r.status).send(await r.text());
    const data = await r.json();
    res.json({ answer: data?.choices?.[0]?.message?.content || "", raw: data });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
export default router;
