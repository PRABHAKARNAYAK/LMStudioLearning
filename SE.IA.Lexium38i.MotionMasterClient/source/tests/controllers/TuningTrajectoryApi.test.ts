import request from "supertest";
import express from "express";

jest.mock("../../services/NotificationHandler", () => ({
  __esModule: true,
  default: {
    sendSnackBarNotification: jest.fn(),
  },
}));
import NotificationHandler from "../../services/NotificationHandler";
import { Constants } from "../../utility/constants";

let mockGetTuningTrajectoryInfo: jest.Mock;
let mockStartSignalGenerator: jest.Mock;
let mockStopSignalGenerator: jest.Mock;
let TuningTrajectoryApi: any;
let app: express.Express;

beforeAll(() => {
  jest.resetModules();
  mockGetTuningTrajectoryInfo = jest.fn();
  mockStartSignalGenerator = jest.fn();
  mockStopSignalGenerator = jest.fn();

  // Dynamically require the module to get the class reference
  const trajectoryHandlerModule = require("../../services/TrajectoryHandler");
  jest.spyOn(trajectoryHandlerModule.TrajectoryHandler, "getInstance").mockReturnValue({
    getTuningTrajectoryInfo: mockGetTuningTrajectoryInfo,
    startSignalGenerator: mockStartSignalGenerator,
    stopSignalGenerator: mockStopSignalGenerator,
  });
  jest.spyOn(NotificationHandler, "sendSnackBarNotification").mockImplementation(jest.fn());

  // Import after mocks so singleton uses the mock
  TuningTrajectoryApi = require("../../controllers/TuningTrajectoryApi").default;

  app = express();
  app.use(express.json());
  app.get("/trajectory/:deviceRef/:profileType", (req, res, next) => TuningTrajectoryApi.getTuningTrajectoryInfo(req, res, next));
  app.post("/trajectory/:deviceRef/start", (req, res, next) => TuningTrajectoryApi.startSignalGenerator(req, res, next));
  app.post("/trajectory/:deviceRef/stop", (req, res, next) => TuningTrajectoryApi.stopSignalGenerator(req, res, next));
});

describe("TuningTrajectoryApi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return trajectory info for valid request", async () => {
    mockGetTuningTrajectoryInfo.mockResolvedValue({ foo: "bar" });
    const res = await request(app).get("/trajectory/device1/3");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ foo: "bar" });
    expect(mockGetTuningTrajectoryInfo).toHaveBeenCalledWith("device1", expect.any(String));
  });

  it("should handle error in getTuningTrajectoryInfo", async () => {
    mockGetTuningTrajectoryInfo.mockRejectedValue(new Error("fail"));
    const res = await request(app).get("/trajectory/device1/3");
    expect(res.status).toBe(Constants.InternalServerError);
    expect(res.body.message).toMatch(/Failed to load position trajectory info/);
  });

  it("should start signal generator", async () => {
    mockStartSignalGenerator.mockResolvedValue(undefined);
    const res = await request(app).post("/trajectory/device1/start").send({ profileType: "3", trajectoryType: "0", trajectoryData: {} });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/started successfully/);
    expect(mockStartSignalGenerator).toHaveBeenCalledWith("device1", expect.any(Object));
  });

  it("should handle error in startSignalGenerator", async () => {
    mockStartSignalGenerator.mockRejectedValue(new Error("fail"));
    const res = await request(app).post("/trajectory/device1/start").send({ profileType: "3", trajectoryType: "0", trajectoryData: {} });
    expect(res.status).toBe(Constants.InternalServerError);
    expect(res.body.message).toMatch(/Failed to start signal generator/);
  });

  it("should stop signal generator", async () => {
    mockStopSignalGenerator.mockResolvedValue(undefined);
    const res = await request(app).post("/trajectory/device1/stop");
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/stopped successfully/);
    expect(mockStopSignalGenerator).toHaveBeenCalledWith("device1");
  });

  it("should handle error in stopSignalGenerator", async () => {
    mockStopSignalGenerator.mockRejectedValue(new Error("fail"));
    const res = await request(app).post("/trajectory/device1/stop");
    expect(res.status).toBe(Constants.InternalServerError);
    expect(res.body.message).toMatch(/Failed to stop signal generator/);
  });
});
