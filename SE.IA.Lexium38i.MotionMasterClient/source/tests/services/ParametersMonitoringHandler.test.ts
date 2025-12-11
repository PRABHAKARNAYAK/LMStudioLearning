import ParametersMonitoringHandler from "../../services/ParametersMonitoringHandler";
import { Constants } from "../../utility/constants";
import { createMockIParameter } from "../testUtils/mockIParameter";

jest.mock("../../controllers/MotionMasterClientFunctions");
jest.mock("../../webSockets/SocketBroadcaster");
jest.mock("../../model/Cia402StateMapper");

const mockClient = {
  createDataMonitoring: jest.fn(() => ({ start: jest.fn(() => ({ subscribe: jest.fn() })) })),
  request: {
    getCia402State: jest.fn(),
  },
};
(require("../../controllers/MotionMasterClientFunctions").MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance as jest.Mock).mockReturnValue({ client: mockClient });

describe("ParametersMonitoringHandler", () => {
  let handler: ParametersMonitoringHandler;

  const mockDeviceRef = "device-1";
  const mockParams = [createMockIParameter("0x6041", "0"), createMockIParameter("0x6064", "0")];

  beforeEach(() => {
    handler = ParametersMonitoringHandler.getInstance();
  });

  it("should be a singleton", () => {
    const handler2 = ParametersMonitoringHandler.getInstance();
    expect(handler).toBe(handler2);
  });

  it("should start default monitoring", () => {
    const spy = jest.spyOn<any, any>(handler, "startMonitoringInternal");
    handler.startDefaultMonitoring(mockDeviceRef, mockParams);
    expect(spy).toHaveBeenCalledWith("default", mockDeviceRef, mockParams);
    spy.mockRestore();
  });

  it("should start control panel monitoring", () => {
    const spy = jest.spyOn<any, any>(handler, "startMonitoringInternal");
    handler.startMonitoring(mockDeviceRef, mockParams);
    expect(spy).toHaveBeenCalledWith("controlPanel", mockDeviceRef, mockParams);
    spy.mockRestore();
  });

  it("should start position tuning monitoring", () => {
    const spy = jest.spyOn<any, any>(handler, "startMonitoringInternal");
    handler.startTuningMonitoring(mockDeviceRef, mockParams);
    expect(spy).toHaveBeenCalledWith("tuningPanel", mockDeviceRef, mockParams);
    spy.mockRestore();
  });

  it("should start trajectory monitoring", () => {
    const spy = jest.spyOn<any, any>(handler, "startMonitoringInternal");
    handler.startTrajectoryMonitoring(mockDeviceRef, mockParams);
    expect(spy).toHaveBeenCalledWith("trajectoryPanel", mockDeviceRef, mockParams, false);
    spy.mockRestore();
  });

  it("should return SWITCH_ON_DISABLED if getCia402State fails", async () => {
    // Simulate missing getCia402State method to trigger fallback
    const originalClient = (handler as any).motionMasterClientFunctionsInstance.client;
    (handler as any).motionMasterClientFunctionsInstance.client = { request: {} };
    const result = await handler.getCia402State();
    expect(result).toBe(Constants.SWITCH_ON_DISABLED);
    // Restore original client
    (handler as any).motionMasterClientFunctionsInstance.client = originalClient;
  });
});
