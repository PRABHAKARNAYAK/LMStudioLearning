import { TuningHandler } from "../../services/TuningHandler";
import { MotionMasterClientFunctions } from "../../controllers/MotionMasterClientFunctions";
import { ParametersProcessingHandler } from "../../services/ParametersProcessingHandler";
import ParametersMonitoringHandler from "../../services/ParametersMonitoringHandler";
import NotificationHandler from "../../services/NotificationHandler";
import { DeviceRef, StartFullAutoTuningRequest } from "motion-master-client";

jest.mock("../../controllers/MotionMasterClientFunctions");
jest.mock("../../services/ParametersProcessingHandler");
jest.mock("../../services/ParametersMonitoringHandler");
jest.mock("../../services/NotificationHandler");
jest.mock("../../controllers/MotionMasterClientFunctions");
jest.mock("../../services/ParametersProcessingHandler");
jest.mock("../../services/ParametersMonitoringHandler");
jest.mock("../../services/NotificationHandler");

const mockDeviceRef = { id: "device1" } as unknown as DeviceRef;
const mockTuningMode = "Auto";
const mockPositionTuningData = {
  tuningModes: [
    {
      tuningMode: mockTuningMode,
      inputParameters: ["param1"],
      monitoringParameters: ["param2"],
    },
  ],
};

describe("TuningHandler", () => {
  let handler: TuningHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton for fresh mocks
    TuningHandler.resetInstance();
    (ParametersProcessingHandler.getInstance as jest.Mock).mockReturnValue({
      getJsonData: jest.fn().mockReturnValue(mockPositionTuningData),
      processDeviceInputParameters: jest.fn(),
    });
    (ParametersMonitoringHandler.getInstance as jest.Mock).mockReturnValue({
      startTuningMonitoring: jest.fn(),
    });
    handler = TuningHandler.getInstance();
  });

  it("should retrieve and process tuning info", async () => {
    const result = await handler.getParsedTuningInfo(mockDeviceRef, "file.json", mockTuningMode);
    expect(result).toEqual(mockPositionTuningData);
    expect(ParametersProcessingHandler.getInstance().processDeviceInputParameters).toHaveBeenCalledWith(["param1"], mockDeviceRef);
    expect(ParametersProcessingHandler.getInstance().processDeviceInputParameters).toHaveBeenCalledWith(["param2"], mockDeviceRef);
    expect(ParametersMonitoringHandler.getInstance().startTuningMonitoring).toHaveBeenCalledWith(mockDeviceRef, ["param2"]);
  });

  it("should handle error in getParsedTuningInfo", async () => {
    (ParametersProcessingHandler.getInstance().getJsonData as jest.Mock).mockImplementation(() => {
      throw new Error("fail");
    });
    await expect(handler.getParsedTuningInfo(mockDeviceRef, "file.json")).rejects.toThrow("fail");
  });

  it("should start full auto tuning and resolve on success", async () => {
    const mockSubscribe = ({ next }: { next: (status: any) => void }) => {
      next({ request: "succeeded", dampingRatio: 1, settlingTime: 2, bandwidth: 3 });
    };
    (MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance as jest.Mock).mockReturnValue({
      client: { request: { startFullAutoTuning: jest.fn().mockReturnValue({ subscribe: mockSubscribe }) } },
    });
    TuningHandler.resetInstance();
    handler = TuningHandler.getInstance();
    const result = await handler.startFullAutoTuning({} as StartFullAutoTuningRequest, "title");
    expect(result).toEqual({ dampingRatio: 1, settlingTime: 2, bandwidth: 3 });
  });

  it("should reject if mmClient is not initialized", async () => {
    (MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance as jest.Mock).mockReturnValue({ client: null });
    TuningHandler.resetInstance();
    handler = TuningHandler.getInstance();
    await expect(handler.startFullAutoTuning({} as StartFullAutoTuningRequest, "title")).rejects.toThrow();
  });

  it("should reject on tuning failure", async () => {
    const mockSubscribe = ({ next }: { next: (status: any) => void }) => {
      next({ request: "failed", error: { message: "fail" } });
    };
    (MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance as jest.Mock).mockReturnValue({
      client: { request: { startFullAutoTuning: jest.fn().mockReturnValue({ subscribe: mockSubscribe }) } },
    });
    TuningHandler.resetInstance();
    handler = TuningHandler.getInstance();
    await expect(handler.startFullAutoTuning({} as StartFullAutoTuningRequest, "title")).rejects.toThrow("fail");
  });

  it("should send notifications for status changes", async () => {
    const mockSubscribe = ({ next }: { next: (status: any) => void }) => {
      next({ request: "started" });
      next({ request: "running" });
      next({ request: "succeeded", dampingRatio: 1, settlingTime: 2, bandwidth: 3 });
    };
    (MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance as jest.Mock).mockReturnValue({
      client: { request: { startFullAutoTuning: jest.fn().mockReturnValue({ subscribe: mockSubscribe }) } },
    });
    TuningHandler.resetInstance();
    handler = TuningHandler.getInstance();
    await handler.startFullAutoTuning({} as StartFullAutoTuningRequest, "title");
    expect(NotificationHandler.sendSnackBarNotification).toHaveBeenCalled();
  });

  describe("computeAutoTuningGains", () => {
    it("should resolve when computation is successful", async () => {
      const mockSubscribe = ({ next }: { next: (status: any) => void }) => {
        next({ request: "succeeded" });
      };
      (MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance as jest.Mock).mockReturnValue({
        client: { request: { computeAutoTuningGains: jest.fn().mockReturnValue({ subscribe: mockSubscribe }) } },
      });
      TuningHandler.resetInstance();
      handler = TuningHandler.getInstance();
      await expect(handler.computeAutoTuningGains({} as any, "title")).resolves.toBeUndefined();
    });

    it("should reject if mmClient is not initialized", async () => {
      (MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance as jest.Mock).mockReturnValue({ client: null });
      TuningHandler.resetInstance();
      handler = TuningHandler.getInstance();
      await expect(handler.computeAutoTuningGains({} as any, "title")).rejects.toThrow();
    });

    it("should reject on computation failure", async () => {
      const mockSubscribe = ({ next }: { next: (status: any) => void }) => {
        next({ request: "failed", error: { message: "fail" } });
      };
      (MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance as jest.Mock).mockReturnValue({
        client: { request: { computeAutoTuningGains: jest.fn().mockReturnValue({ subscribe: mockSubscribe }) } },
      });
      TuningHandler.resetInstance();
      handler = TuningHandler.getInstance();
      await expect(handler.computeAutoTuningGains({} as any, "title")).rejects.toThrow("fail");
    });

    it("should reject on error event", async () => {
      const mockSubscribe = ({ next, error }: { next: (status: any) => void; error: (err: any) => void }) => {
        error({ message: "error event" });
      };
      (MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance as jest.Mock).mockReturnValue({
        client: { request: { computeAutoTuningGains: jest.fn().mockReturnValue({ subscribe: mockSubscribe }) } },
      });
      TuningHandler.resetInstance();
      handler = TuningHandler.getInstance();
      await expect(handler.computeAutoTuningGains({} as any, "title")).rejects.toThrow("error event");
    });
  });
});
