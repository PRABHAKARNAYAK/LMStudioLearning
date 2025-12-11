import { Cia402State, PositionProfileConfig } from "motion-master-client";

// Helper to create a fresh mock client for each test
function createMockClient() {
  return {
    request: {
      resetTargets: jest.fn().mockResolvedValue(undefined),
      downloadMany: jest.fn().mockResolvedValue(undefined),
      transitionToCia402State: jest.fn().mockResolvedValue(undefined),
      applySetPoint: jest.fn().mockResolvedValue(undefined),
      whenTargetReached: jest.fn().mockResolvedValue(undefined),
      upload: jest.fn().mockResolvedValue(undefined),
    },
  };
}

describe("ProfileModesHandler", () => {
  // --- New tests for startTorqueProfileMode ---
  it("should start torque profile mode successfully", async () => {
    const handler = ProfileModesHandler.getInstance();
    const config = { target: 55, slope: 7 };
    await handler.startTorqueProfileMode("dev8", config);
    expect(mockClient.request.resetTargets).toHaveBeenCalledWith("dev8");
    expect(mockClient.request.downloadMany).toHaveBeenCalledWith([
      ["dev8", 0x6060, 0, 4],
      ["dev8", 0x6071, 0, 55],
      ["dev8", 0x6087, 0, 7],
    ]);
    expect(mockClient.request.transitionToCia402State).toHaveBeenCalledWith("dev8", Cia402State.OPERATION_ENABLED);
    expect(NotificationHandler.sendSnackBarNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({ title: expect.any(String) }),
        type: expect.any(Number),
      })
    );
  });

  it("should handle error in startTorqueProfileMode and send error notification", async () => {
    const handler = ProfileModesHandler.getInstance();
    mockClient.request.resetTargets.mockImplementationOnce(() => {
      throw new Error("fail-torque");
    });
    const config = { target: 2, slope: 3 };
    await handler.startTorqueProfileMode("dev9", config);
    expect(NotificationHandler.sendSnackBarNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.any(Number),
        message: expect.objectContaining({ title: expect.any(String) }),
      })
    );
  });

  it("should throw if client is not connected in startTorqueProfileMode", async () => {
    jest.resetModules();
    jest.doMock("../../controllers/MotionMasterClientFunctions", () => ({
      MotionMasterClientFunctions: {
        getMotionMasterClientFunctionsInstance: () => ({ client: null }),
      },
    }));
    const ProfileModesHandlerLocal = require("../../services/ProfileModesHandler").ProfileModesHandler;
    const handlerLocal = ProfileModesHandlerLocal.getInstance();
    const config = { target: 2, slope: 3 };
    await expect(handlerLocal.startTorqueProfileMode("dev10", config)).resolves.toBeUndefined();
  });
  let ProfileModesHandler: any;
  let mockClient: ReturnType<typeof createMockClient>;
  let NotificationHandler: any;

  beforeEach(() => {
    jest.resetModules();
    mockClient = createMockClient();

    jest.doMock("../../controllers/MotionMasterClientFunctions", () => ({
      MotionMasterClientFunctions: {
        getMotionMasterClientFunctionsInstance: () => ({ client: mockClient }),
      },
    }));
    jest.doMock("../../services/LexiumLogger", () => ({
      LexiumLogger: {
        init: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        verbose: jest.fn(),
        silly: jest.fn(),
      },
    }));
    jest.doMock("../../services/NotificationHandler", () => ({
      __esModule: true,
      default: { sendSnackBarNotification: jest.fn() },
    }));

    ProfileModesHandler = require("../../services/ProfileModesHandler").ProfileModesHandler;
    NotificationHandler = require("../../services/NotificationHandler").default;
  });

  it("should be a singleton", () => {
    const instance1 = ProfileModesHandler.getInstance();
    const instance2 = ProfileModesHandler.getInstance();
    expect(instance1).toBe(instance2);
  });

  it("should start position profile mode with absolute target", async () => {
    // Arrange
    const handler = ProfileModesHandler.getInstance();
    mockClient.request.upload.mockResolvedValue(100);
    const config: PositionProfileConfig = {
      target: 100,
      velocity: 10,
      acceleration: 5,
      deceleration: 5,
      relative: false,
    };
    // Act
    await handler.startPositionProfileMode("dev1", config);
    // Assert
    expect(mockClient.request.resetTargets).toHaveBeenCalledWith("dev1");
    expect(mockClient.request.downloadMany).toHaveBeenCalledWith([
      ["dev1", 0x6060, 0, 1],
      ["dev1", 0x6067, 0, 10],
      ["dev1", 0x607a, 0, 100],
      ["dev1", 0x6081, 0, 10],
      ["dev1", 0x6083, 0, 5],
      ["dev1", 0x6084, 0, 5],
    ]);
    expect(mockClient.request.transitionToCia402State).toHaveBeenCalledWith("dev1", Cia402State.OPERATION_ENABLED);
    expect(mockClient.request.applySetPoint).toHaveBeenCalledWith("dev1");
    // For absolute moves, whenTargetReached may not be called, so do not assert it here
    expect(mockClient.request.whenTargetReached).not.toHaveBeenCalled();
  });

  it("should start position profile mode with relative target", async () => {
    const handler = ProfileModesHandler.getInstance();
    mockClient.request.upload.mockResolvedValueOnce(50); // actual position
    const config: PositionProfileConfig = {
      target: 20,
      velocity: 10,
      acceleration: 5,
      deceleration: 5,
      relative: true,
    };
    await handler.startPositionProfileMode("dev2", config);
    expect(mockClient.request.upload).toHaveBeenCalledWith("dev2", 0x6064, 0);
    expect(mockClient.request.downloadMany).toHaveBeenCalledWith([
      ["dev2", 0x6060, 0, 1],
      ["dev2", 0x6067, 0, 10],
      ["dev2", 0x607a, 0, 70], // 50 + 20
      ["dev2", 0x6081, 0, 10],
      ["dev2", 0x6083, 0, 5],
      ["dev2", 0x6084, 0, 5],
    ]);
  });

  it("should throw if client is not connected", async () => {
    jest.resetModules();
    jest.doMock("../../controllers/MotionMasterClientFunctions", () => ({
      MotionMasterClientFunctions: {
        getMotionMasterClientFunctionsInstance: () => ({ client: null }),
      },
    }));
    const ProfileModesHandlerLocal = require("../../services/ProfileModesHandler").ProfileModesHandler;
    const handlerLocal = ProfileModesHandlerLocal.getInstance();
    const config: PositionProfileConfig = {
      target: 10,
      velocity: 1,
      acceleration: 1,
      deceleration: 1,
      relative: false,
    };
    await expect(handlerLocal.startPositionProfileMode("dev3", config)).resolves.toBeUndefined();
  });

  it("should handle errors and send error notification", async () => {
    const handler = ProfileModesHandler.getInstance();
    mockClient.request.resetTargets.mockImplementationOnce(() => {
      throw new Error("fail");
    });
    const config: PositionProfileConfig = {
      target: 10,
      velocity: 1,
      acceleration: 1,
      deceleration: 1,
      relative: false,
    };
    await handler.startPositionProfileMode("dev4", config);
    expect(NotificationHandler.sendSnackBarNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.anything(),
        message: expect.objectContaining({ title: expect.any(String) }),
      })
    );
  });

  // --- New tests for startVelocityProfileMode ---
  it("should start velocity profile mode successfully", async () => {
    const handler = ProfileModesHandler.getInstance();
    const config = { target: 123, acceleration: 10, deceleration: 5 };
    await handler.startVelocityProfileMode("dev5", config);
    expect(mockClient.request.resetTargets).toHaveBeenCalledWith("dev5");
    expect(mockClient.request.downloadMany).toHaveBeenCalledWith([
      ["dev5", 0x6060, 0, 3],
      ["dev5", 0x60ff, 0, 123],
      ["dev5", 0x6083, 0, 10],
      ["dev5", 0x6084, 0, 5],
    ]);
    expect(mockClient.request.transitionToCia402State).toHaveBeenCalledWith("dev5", Cia402State.OPERATION_ENABLED);
    expect(NotificationHandler.sendSnackBarNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({ title: expect.any(String) }),
        type: expect.any(Number),
      })
    );
  });

  it("should handle error in startVelocityProfileMode and send error notification", async () => {
    const handler = ProfileModesHandler.getInstance();
    mockClient.request.resetTargets.mockImplementationOnce(() => {
      throw new Error("fail-velocity");
    });
    const config = { target: 1, acceleration: 2, deceleration: 3 };
    await handler.startVelocityProfileMode("dev6", config);
    expect(NotificationHandler.sendSnackBarNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.anything(),
        message: expect.objectContaining({ title: expect.any(String) }),
      })
    );
  });

  it("should throw if client is not connected in startVelocityProfileMode", async () => {
    jest.resetModules();
    jest.doMock("../../controllers/MotionMasterClientFunctions", () => ({
      MotionMasterClientFunctions: {
        getMotionMasterClientFunctionsInstance: () => ({ client: null }),
      },
    }));
    const ProfileModesHandlerLocal = require("../../services/ProfileModesHandler").ProfileModesHandler;
    const handlerLocal = ProfileModesHandlerLocal.getInstance();
    const config = { target: 1, acceleration: 2, deceleration: 3 };
    await expect(handlerLocal.startVelocityProfileMode("dev7", config)).resolves.toBeUndefined();
  });
});
