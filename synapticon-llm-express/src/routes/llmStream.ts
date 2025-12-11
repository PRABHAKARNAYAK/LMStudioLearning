import { Router } from "express";
const router = Router();
function env() {
  return {
    base: process.env.LMSTUDIO_BASE_URL || "http://localhost:1234/v1",
    key: process.env.LMSTUDIO_API_KEY || "lm-studio",
    model: process.env.LMSTUDIO_MODEL || "meta-llama-3.1-8b-instruct",
  } as const;
}
router.post("/chat-stream", async (req, res) => {
  const { messages } = req.body;
  const { base, key, model } = env();
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, stream: true, temperature: 0.2 }),
    });
    if (!r.ok || !r.body) {
      res.write(`event: error
data: ${await r.text()}

`);
      return res.end();
    }
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value));
    }
    res.end();
  } catch (e: any) {
    res.write(`event: error
data: ${e.message}

`);
    res.end();
  }
});
export default router;
