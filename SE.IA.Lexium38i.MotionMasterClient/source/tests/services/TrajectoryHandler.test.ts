import { TrajectoryHandler } from "../../services/TrajectoryHandler";
import { ParametersProcessingHandler } from "../../services/ParametersProcessingHandler";
import ParametersMonitoringHandler from "../../services/ParametersMonitoringHandler";
import { MotionMasterClientFunctions } from "../../controllers/MotionMasterClientFunctions";
import { Constants } from "../../utility/constants";

jest.mock("../../services/ParametersProcessingHandler");
jest.mock("../../services/ParametersMonitoringHandler");
jest.mock("../../controllers/MotionMasterClientFunctions");

const mockClient = {
  client: {
    request: {
      setSignalGeneratorParameters: jest.fn(() => ({
        subscribe: jest.fn(),
      })),
      startSignalGenerator: jest.fn(() => ({
        subscribe: jest.fn(),
      })),
      stopSignalGenerator: jest.fn(() => ({
        subscribe: jest.fn(),
      })),
    },
  },
};

(MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance as jest.Mock).mockReturnValue(mockClient);

const mockProcessDeviceInputParameters = jest.fn();
const mockGetJsonData = jest.fn();

(ParametersProcessingHandler.getInstance as jest.Mock).mockReturnValue({
  getJsonData: mockGetJsonData,
  processDeviceInputParameters: mockProcessDeviceInputParameters,
});

(ParametersMonitoringHandler.getInstance as jest.Mock).mockReturnValue({
  startTrajectoryMonitoring: jest.fn(),
});

describe("TrajectoryHandler", () => {
  let handler: TrajectoryHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = TrajectoryHandler.getInstance();
  });

  describe("getTuningTrajectoryInfo", () => {
    it("should process and return tuning trajectory info", async () => {
      const fakeTrajectoryData = {
        trajectoryTypes: [{ inputParameters: ["param1"] }, { inputParameters: ["param2"] }],
        monitoringParameters: ["monitor1"],
      };
      mockGetJsonData.mockReturnValue(fakeTrajectoryData);
      const result = await handler.getTuningTrajectoryInfo("dev1", "file.json");
      expect(mockGetJsonData).toHaveBeenCalledWith("file.json");
      expect(mockProcessDeviceInputParameters).toHaveBeenCalledWith(["param1"], "dev1");
      expect(mockProcessDeviceInputParameters).toHaveBeenCalledWith(["param2"], "dev1");
      expect(mockProcessDeviceInputParameters).toHaveBeenCalledWith(["monitor1"], "dev1");
      expect(result).toBe(fakeTrajectoryData);
    });
  });

  describe("startSignalGenerator", () => {
    it("should throw if client is not connected", async () => {
      // Simulate disconnected client by setting client to an object without 'client' property
      (mockClient as any).client = undefined;
      await expect(handler.startSignalGenerator("dev1", { profileType: "3", trajectoryType: "0", trajectoryData: {} })).rejects.toThrow(Constants.ClientNotConnected);
      // Restore mockClient.client
      (mockClient as any).client = {
        request: {
          setSignalGeneratorParameters: jest.fn(() => ({ subscribe: jest.fn() })),
          startSignalGenerator: jest.fn(() => ({ subscribe: jest.fn() })),
          stopSignalGenerator: jest.fn(() => ({ subscribe: jest.fn() })),
        },
      };
    });
    it("should throw for unknown profileType", async () => {
      await expect(handler.startSignalGenerator("dev1", { profileType: "unknown", trajectoryType: "0", trajectoryData: {} })).rejects.toThrow(
        "Unknown profileType detected while fetching the strategy: unknown"
      );
    });
  });

  describe("stopSignalGenerator", () => {
    it("should throw if client is not connected", async () => {
      (mockClient as any).client = undefined;
      await expect(handler.stopSignalGenerator("dev1")).rejects.toThrow(Constants.ClientNotConnected);
      (mockClient as any).client = {
        request: {
          setSignalGeneratorParameters: jest.fn(() => ({ subscribe: jest.fn() })),
          startSignalGenerator: jest.fn(() => ({ subscribe: jest.fn() })),
          stopSignalGenerator: jest.fn(() => ({ subscribe: jest.fn() })),
        },
      };
    });
  });
});
