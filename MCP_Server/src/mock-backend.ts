import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Mock servo devices
const mockDevices = [
  { id: "servo-01", model: "Lexium 38i", port: "COM3", status: "online" },
  { id: "servo-02", model: "Lexium 38i", port: "COM4", status: "online" },
  { id: "servo-Prabhakar", model: "Lexium 38i", port: "COM5", status: "online" },
];

// Mock device states
const deviceStates = new Map<string, any>();
mockDevices.forEach((device) => {
  deviceStates.set(device.id, {
    id: device.id,
    state: "idle",
    position: 0,
    velocity: 0,
    torque: 0,
    errors: [],
    ts: new Date().toISOString(),
  });
});

// Scan devices
app.get("/api/servo/scan", (req, res) => {
  res.json({ devices: mockDevices });
});

// Get status
app.get("/api/servo/:id/status", (req, res) => {
  const { id } = req.params;
  const state = deviceStates.get(id);

  if (!state) {
    return res.status(404).json({ error: "Device not found" });
  }

  // Update timestamp
  state.ts = new Date().toISOString();
  res.json(state);
});

// Home device
app.post("/api/servo/:id/home", (req, res) => {
  const { id } = req.params;
  const state = deviceStates.get(id);

  if (!state) {
    return res.status(404).json({ error: "Device not found" });
  }

  // Simulate homing
  state.state = "homing";
  setTimeout(() => {
    state.state = "idle";
    state.position = 0;
  }, 2000);

  res.json({ result: "Homing sequence started" });
});

// Move to position
app.post("/api/servo/:id/move", (req, res) => {
  const { id } = req.params;
  const { position, speed, unit } = req.body;
  const state = deviceStates.get(id);

  if (!state) {
    return res.status(404).json({ error: "Device not found" });
  }

  // Simulate movement
  const jobId = `job-${Date.now()}`;
  state.state = "moving";

  setTimeout(() => {
    state.position = position;
    state.velocity = 0;
    state.state = "idle";
  }, 3000);

  res.json({ acknowledged: true, jobId });
});

// Jog
app.post("/api/servo/:id/jog", (req, res) => {
  const { id } = req.params;
  const { direction, speed, durationMs } = req.body;
  const state = deviceStates.get(id);

  if (!state) {
    return res.status(404).json({ error: "Device not found" });
  }

  // Simulate jog
  state.state = "moving";
  state.velocity = direction === "positive" ? speed || 50 : -(speed || 50);

  setTimeout(() => {
    const delta = (state.velocity * (durationMs || 1000)) / 1000;
    state.position += delta;
    state.velocity = 0;
    state.state = "idle";
  }, durationMs || 1000);

  res.json({ acknowledged: true });
});

// Stop
app.post("/api/servo/:id/stop", (req, res) => {
  const { id } = req.params;
  const { immediate } = req.body;
  const state = deviceStates.get(id);

  if (!state) {
    return res.status(404).json({ error: "Device not found" });
  }

  state.state = immediate ? "stopped" : "idle";
  state.velocity = 0;

  res.json({ acknowledged: true });
});

// Set parameter
app.post("/api/servo/:id/param", (req, res) => {
  const { id } = req.params;
  const { name, value } = req.body;
  const state = deviceStates.get(id);

  if (!state) {
    return res.status(404).json({ error: "Device not found" });
  }

  // Store parameter (in real system would write to device)
  console.log(`Setting ${name}=${value} on ${id}`);

  res.json({ acknowledged: true });
});

// Get diagnostics
app.get("/api/servo/:id/diagnostics", (req, res) => {
  const { id } = req.params;

  if (!deviceStates.has(id)) {
    return res.status(404).json({ error: "Device not found" });
  }

  res.json({
    id,
    firmware: "1.2.3",
    temperatureC: 45 + Math.random() * 10,
    supplyVoltage: 24.0 + Math.random() * 0.5,
    faultCodes: [],
  });
});

// Execute trajectory
app.post("/api/servo/:id/trajectory", (req, res) => {
  const { id } = req.params;
  const { points, loop } = req.body;
  const state = deviceStates.get(id);

  if (!state) {
    return res.status(404).json({ error: "Device not found" });
  }

  const jobId = `traj-${Date.now()}`;
  state.state = "moving";

  // Simulate trajectory execution
  if (points && points.length > 0) {
    const totalTime = points[points.length - 1].timeMs;
    setTimeout(() => {
      state.position = points[points.length - 1].position;
      state.velocity = 0;
      state.state = "idle";
    }, totalTime);
  }

  res.json({ acknowledged: true, jobId });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Mock Servo API running on http://localhost:${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`  GET  /api/servo/scan`);
  console.log(`  GET  /api/servo/:id/status`);
  console.log(`  POST /api/servo/:id/home`);
  console.log(`  POST /api/servo/:id/move`);
  console.log(`  POST /api/servo/:id/jog`);
  console.log(`  POST /api/servo/:id/stop`);
  console.log(`  POST /api/servo/:id/param`);
  console.log(`  GET  /api/servo/:id/diagnostics`);
  console.log(`  POST /api/servo/:id/trajectory`);
});
