import { SystemIdentificationHandler } from "../../services/SystemIdentificationHandler";
import NotificationHandler from "../../services/NotificationHandler";
import { MotionMasterClientFunctions } from "../../controllers/MotionMasterClientFunctions";
import { NotificationType } from "../../model/notificationInfo";
import { DeviceRef, StartSystemIdentificationRequest, SystemIdentificationStatus } from "motion-master-client";
import { throwError } from "rxjs";

jest.mock("../../services/NotificationHandler");
jest.mock("../../controllers/MotionMasterClientFunctions");

const mockDeviceRef: DeviceRef = { id: "device1" } as unknown as DeviceRef;
const mockRequest: StartSystemIdentificationRequest = { param: "value" } as StartSystemIdentificationRequest;
const mockStatus: SystemIdentificationStatus = { request: "succeeded", success: { message: "Success" } } as SystemIdentificationStatus;

const mockClient = {
  request: {
    getDecodedFile: jest.fn(),
    startSystemIdentification: jest.fn(),
  },
};

(MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance as jest.Mock).mockReturnValue({ client: mockClient });

beforeEach(() => {
  jest.clearAllMocks();
  // Reset TuningHandler singleton for test isolation
  // @ts-ignore
  SystemIdentificationHandler.instance = undefined;
});

describe("TuningHandler", () => {
  it("should retrieve system identification data successfully", async () => {
    const { of } = require("rxjs");
    (mockClient.request.getDecodedFile as jest.Mock).mockReturnValue(of("csv-content"));
    const handler = SystemIdentificationHandler.getInstance();
    const result = await handler.getSystemIdentificationData(mockDeviceRef);
    expect(result).toBe("csv-content");
    expect(mockClient.request.getDecodedFile).toHaveBeenCalledWith(mockDeviceRef, "plant_model.csv");
  });

  it("should handle error when retrieving system identification data", async () => {
    (mockClient.request.getDecodedFile as jest.Mock).mockReturnValue(throwError(() => new Error("file error")));
    const handler = SystemIdentificationHandler.getInstance();
    let result;
    try {
      result = await handler.getSystemIdentificationData(mockDeviceRef);
    } catch (e) {
      result = "";
    }
    expect(result).toBe("");
    expect(NotificationHandler.sendSnackBarNotification).toHaveBeenCalledWith(expect.objectContaining({ type: NotificationType.error }));
  });

  it("should start tuning procedure and resolve on success", async () => {
    const subscribeMock = jest.fn(({ next }: any) => {
      next(mockStatus);
    });
    (mockClient.request.startSystemIdentification as jest.Mock).mockReturnValue({ subscribe: subscribeMock });
    const { of } = require("rxjs");
    (mockClient.request.getDecodedFile as jest.Mock).mockReturnValue(of("csv-content"));
    const handler = SystemIdentificationHandler.getInstance();
    await expect(handler.startSystemIdentificationProcedure(mockDeviceRef, mockRequest)).resolves.toBe("csv-content");
  });

  it("should send notification and reject on tuning procedure error", async () => {
    const subscribeMock = jest.fn(({ error }: any) => {
      error(new Error("procedure error"));
    });
    (mockClient.request.startSystemIdentification as jest.Mock).mockReturnValue({ subscribe: subscribeMock });
    const handler = SystemIdentificationHandler.getInstance();
    await expect(handler.startSystemIdentificationProcedure(mockDeviceRef, mockRequest)).rejects.toThrow("procedure error");
    expect(NotificationHandler.sendSnackBarNotification).toHaveBeenCalledWith(expect.objectContaining({ type: NotificationType.error }));
  });

  it("should reject if MotionMaster client is not initialized for getSystemIdentificationData", async () => {
    (MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance as jest.Mock).mockReturnValue({ client: null });
    const handler = SystemIdentificationHandler.getInstance();
    const result = await handler.getSystemIdentificationData(mockDeviceRef);
    expect(result).toBe("");
    expect(mockClient.request.getDecodedFile).not.toHaveBeenCalled();
    expect(NotificationHandler.sendSnackBarNotification).toHaveBeenCalledWith(expect.objectContaining({ type: NotificationType.error }));
  });

  it("should reject if MotionMaster client is not initialized for startTuningProcedure", async () => {
    (MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance as jest.Mock).mockReturnValue({ client: null });
    const handler = SystemIdentificationHandler.getInstance();
    await expect(handler.startSystemIdentificationProcedure(mockDeviceRef, mockRequest)).rejects.toThrow(
      "Connection to device is interrupted. Please perform a rescan and try again."
    );
  });
});
