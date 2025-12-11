import express from "express";
import request from "supertest";
let MotionMasterClientFunctions: any;

// Mock dependencies to isolate the test
jest.mock("motion-master-client", () => ({
  createMotionMasterClient: jest.fn().mockReturnValue({
    reqResSocket: { url: "http://mock-req-res" },
    pubSubSocket: { url: "http://mock-pub-sub" },
    whenReady: jest.fn().mockResolvedValue(true),
    closeSockets: jest.fn(),
    request: {
      getDeviceParameters: jest.fn().mockReturnValue({
        toPromise: () => Promise.resolve({ parameters: [] }),
      }),
      getDeviceParameterValues: jest.fn().mockReturnValue({
        toPromise: () => Promise.resolve({ values: [] }),
      }),
      upload: jest.fn().mockResolvedValue({ value: 123 }),
      getDevices: jest.fn().mockReturnValue({
        toPromise: () => Promise.resolve([]),
      }),
      quickStop: jest.fn().mockResolvedValue(undefined),
    },
    monitor: {
      unsubscribeAll: jest.fn(),
      systemEvent$: {
        subscribe: jest.fn(),
      },
    },
  }),
  ensureDeviceRef: jest.fn((ref) => ref),
  makeDeviceRefObj: jest.fn((ref) => ({ deviceRef: ref })),
  splitParameterId: jest.fn((id) => [0x1000, 0x00]),
}));

jest.mock("../../webSockets/SocketBroadcaster", () => ({
  SocketBroadcaster: {
    broadcast: jest.fn(),
  },
}));

jest.mock("../../services/NotificationHandler", () => ({
  __esModule: true,
  default: { sendSnackBarNotification: jest.fn() },
}));

describe("MotionMasterClientFunctions", () => {
  let app: express.Application;
  let instance: any;

  beforeEach(() => {
    jest.resetModules();
    const { MotionMasterClientFunctions: MMCFClass } = require("../../controllers/MotionMasterClientFunctions");
    MotionMasterClientFunctions = MMCFClass;
    instance = MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance();
    instance.client = undefined; // Reset client state
    app = express();
    app.use(express.json());
    // Create minimal routes for the tested methods
    app.get("/api/connect/:hostname", (req, res) => instance.connect(req, res));
    app.get("/api/disconnect", (req, res) => instance.disconnect(req, res));
    app.get("/api/device/:deviceRef/parameters", (req, res) => instance.getDeviceParameters(req, res));
    app.get("/api/device/:deviceRef/upload/:index/:subindex", (req, res) => instance.upload(req, res));
  });

  it("should respond 200 and connection URLs on valid connect request", async () => {
    const hostname = "192.168.1.100";
    const res = await request(app).get(`/api/connect/${hostname}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("reqResUrl");
    expect(res.body).toHaveProperty("pubSubUrl");
    expect(typeof res.body.reqResUrl).toBe("string");
    expect(typeof res.body.pubSubUrl).toBe("string");
  });

  it("should respond 409 if client is already connected", async () => {
    const hostname = "192.168.1.100";
    // First connection
    await request(app).get(`/api/connect/${hostname}`);
    // Second connection attempt
    const res = await request(app).get(`/api/connect/${hostname}`);
    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toContain("Client has already been created");
  });

  it("should respond 500 if connection fails", async () => {
    jest.resetModules();
    const mockClient = {
      reqResSocket: { url: "http://mock-req-res" },
      pubSubSocket: { url: "http://mock-pub-sub" },
      whenReady: jest.fn().mockRejectedValue(new Error("Connection failed")),
      closeSockets: jest.fn(),
    };
    jest.mock("motion-master-client", () => ({
      createMotionMasterClient: jest.fn().mockReturnValue(mockClient),
      ensureDeviceRef: jest.fn((ref) => ref),
      makeDeviceRefObj: jest.fn((ref) => ({ deviceRef: ref })),
    }));
    const { MotionMasterClientFunctions: MMCFClass } = require("../../controllers/MotionMasterClientFunctions");
    const testInstance = MMCFClass.getMotionMasterClientFunctionsInstance();
    testInstance.client = undefined;
    const testApp = express();
    testApp.use(express.json());
    testApp.get("/api/connect/:hostname", (req, res) => testInstance.connect(req, res));
    const hostname = "192.168.1.100";
    const res = await request(testApp).get(`/api/connect/${hostname}`);
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("message");
  });

  it("should respond 204 on disconnect request", async () => {
    const hostname = "192.168.1.100";
    // First connect
    await request(app).get(`/api/connect/${hostname}`);
    // Then disconnect
    const res = await request(app).get("/api/disconnect");
    expect(res.status).toBe(204);
  });

  it("should respond 200 and parameters on valid getDeviceParameters request", async () => {
    jest.resetModules();
    const mockLastValueFrom = jest.fn().mockResolvedValue({ parameters: [{ index: 0x1000, subindex: 0 }] });
    jest.mock("rxjs", () => ({
      BehaviorSubject: jest.fn(),
      Subject: jest.fn(),
      lastValueFrom: mockLastValueFrom,
    }));
    const mockClient = {
      reqResSocket: { url: "http://mock-req-res" },
      pubSubSocket: { url: "http://mock-pub-sub" },
      whenReady: jest.fn().mockResolvedValue(true),
      closeSockets: jest.fn(),
      request: {
        getDeviceParameters: jest.fn().mockReturnValue(Promise.resolve()),
      },
      monitor: {
        unsubscribeAll: jest.fn(),
        systemEvent$: { subscribe: jest.fn() },
      },
    };
    jest.mock("motion-master-client", () => ({
      createMotionMasterClient: jest.fn().mockReturnValue(mockClient),
      ensureDeviceRef: jest.fn((ref) => ref),
      makeDeviceRefObj: jest.fn((ref) => ({ deviceRef: ref })),
    }));
    const { MotionMasterClientFunctions: MMCFClass } = require("../../controllers/MotionMasterClientFunctions");
    const testInstance = MMCFClass.getMotionMasterClientFunctionsInstance();
    testInstance.client = mockClient;
    const testApp = express();
    testApp.use(express.json());
    testApp.get("/api/device/:deviceRef/parameters", (req, res) => testInstance.getDeviceParameters(req, res));
    const deviceRef = "0.0";
    const res = await request(testApp).get(`/api/device/${deviceRef}/parameters`);
    expect(res.status).toBe(200);
  });

  it("should respond 200 and value on valid upload request", async () => {
    jest.resetModules();
    const mockClient = {
      reqResSocket: { url: "http://mock-req-res" },
      pubSubSocket: { url: "http://mock-pub-sub" },
      whenReady: jest.fn().mockResolvedValue(true),
      closeSockets: jest.fn(),
      request: {
        upload: jest.fn().mockResolvedValue(42),
      },
      monitor: {
        unsubscribeAll: jest.fn(),
        systemEvent$: { subscribe: jest.fn() },
      },
    };
    jest.mock("motion-master-client", () => ({
      createMotionMasterClient: jest.fn().mockReturnValue(mockClient),
      ensureDeviceRef: jest.fn((ref) => ref),
    }));
    const { MotionMasterClientFunctions: MMCFClass } = require("../../controllers/MotionMasterClientFunctions");
    const testInstance = MMCFClass.getMotionMasterClientFunctionsInstance();
    testInstance.client = mockClient;
    const testApp = express();
    testApp.use(express.json());
    testApp.get("/api/device/:deviceRef/upload/:index/:subindex", (req, res) => testInstance.upload(req, res));
    const deviceRef = "0.0";
    const index = "1000";
    const subindex = "00";
    const res = await request(testApp).get(`/api/device/${deviceRef}/upload/${index}/${subindex}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("value");
  });

  it("should return singleton instance on getMotionMasterClientFunctionsInstance", () => {
    const instance1 = MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance();
    const instance2 = MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance();
    expect(instance1).toBe(instance2);
  });

  it("should return false for asBoolean with undefined input", () => {
    const result = instance.asBoolean(undefined);
    expect(result).toBe(false);
  });

  it("should return true for asBoolean with 'true' input", () => {
    const result = instance.asBoolean("true");
    expect(result).toBe(true);
  });

  it("should return true for asBoolean with '1' input", () => {
    const result = instance.asBoolean("1");
    expect(result).toBe(true);
  });

  it("should return false for asBoolean with 'false' input", () => {
    const result = instance.asBoolean("false");
    expect(result).toBe(false);
  });
});
