import express from "express";
import request from "supertest";
let ControlPanelApi: any;

// Mock dependencies to isolate the test
jest.mock("../../services/ProfileModesHandler", () => {
  return {
    ProfileModesHandler: {
      getInstance: () => ({
        startPositionProfileMode: jest.fn().mockResolvedValue(undefined),
      }),
    },
  };
});
jest.mock("../../services/NotificationHandler", () => ({
  __esModule: true,
  default: { sendSnackBarNotification: jest.fn() },
}));

describe("ControlPanelApi", () => {
  let app: express.Application;

  beforeEach(() => {
    jest.resetModules();
    ControlPanelApi = require("../../controllers/ControlPanelApi").default;
    app = express();
    app.use(express.json());
    // Create minimal routes for the tested methods
    app.post("/api/control-panel/:deviceRef/start-position-profile", (req, res, next) => ControlPanelApi.startPositionProfile(req, res, next));
    app.post("/api/control-panel/:deviceRef/start-velocity-profile", (req, res, next) => ControlPanelApi.startVelocityProfile(req, res, next));
    app.post("/api/control-panel/:deviceRef/start-torque-profile", (req, res, next) => ControlPanelApi.startTorqueProfile(req, res, next));
  });

  it("should respond 200 and success message on valid POST for position profile", async () => {
    const deviceRef = "testDevice";
    const body = {
      target: 1000,
      velocity: 100,
      acceleration: 10,
      deceleration: 10,
      relative: false,
    };
    const res = await request(app).post(`/api/control-panel/${deviceRef}/start-position-profile`).send(body);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
    expect(typeof res.body.message).toBe("string");
  });

  it("should respond 200 and success message on valid POST for velocity profile", async () => {
    jest.resetModules();
    const profileModesHandlerModule = require("../../services/ProfileModesHandler");
    profileModesHandlerModule.ProfileModesHandler.getInstance = () => ({
      startVelocityProfileMode: jest.fn().mockResolvedValue(undefined),
    });
    ControlPanelApi = require("../../controllers/ControlPanelApi").default;
    const testApp = express();
    testApp.use(express.json());
    testApp.post("/api/control-panel/:deviceRef/start-velocity-profile", (req, res, next) => ControlPanelApi.startVelocityProfile(req, res, next));
    const deviceRef = "devVel";
    const body = { target: 10, acceleration: 2, deceleration: 2 };
    const res = await request(testApp).post(`/api/control-panel/${deviceRef}/start-velocity-profile`).send(body);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
    expect(typeof res.body.message).toBe("string");
  });

  it("should respond 200 and success message on valid POST for torque profile", async () => {
    jest.resetModules();
    const profileModesHandlerModule = require("../../services/ProfileModesHandler");
    profileModesHandlerModule.ProfileModesHandler.getInstance = () => ({
      startTorqueProfileMode: jest.fn().mockResolvedValue(undefined),
    });
    ControlPanelApi = require("../../controllers/ControlPanelApi").default;
    const testApp = express();
    testApp.use(express.json());
    testApp.post("/api/control-panel/:deviceRef/start-torque-profile", (req, res, next) => ControlPanelApi.startTorqueProfile(req, res, next));
    const deviceRef = "devTorque";
    const body = { target: 5, slope: 1 };
    const res = await request(testApp).post(`/api/control-panel/${deviceRef}/start-torque-profile`).send(body);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
    expect(typeof res.body.message).toBe("string");
  });

  it("should respond 500 if an error is thrown in position profile", async () => {
    jest.resetModules();
    const profileModesHandlerModule = require("../../services/ProfileModesHandler");
    const spy = jest.spyOn(profileModesHandlerModule.ProfileModesHandler, "getInstance").mockReturnValue({
      startPositionProfileMode: jest.fn(async () => {
        throw new Error("fail");
      }),
    });
    ControlPanelApi = require("../../controllers/ControlPanelApi").default;
    const errorApp = express();
    errorApp.use(express.json());
    errorApp.post("/api/control-panel/:deviceRef/start-position-profile", (req, res, next) => {
      ControlPanelApi.startPositionProfile(req, res, next);
    });
    const deviceRef = "testDevice";
    const body = {
      target: 1000,
      velocity: 100,
      acceleration: 10,
      deceleration: 10,
      relative: false,
    };
    const res = await request(errorApp).post(`/api/control-panel/${deviceRef}/start-position-profile`).send(body);
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toBe("fail");
    spy.mockRestore();
  });

  it("should respond 500 if an error is thrown in velocity profile", async () => {
    jest.resetModules();
    const profileModesHandlerModule = require("../../services/ProfileModesHandler");
    profileModesHandlerModule.ProfileModesHandler.getInstance = () => ({
      startVelocityProfileMode: jest.fn(async () => {
        throw new Error("fail-vel");
      }),
    });
    ControlPanelApi = require("../../controllers/ControlPanelApi").default;
    const errorApp = express();
    errorApp.use(express.json());
    errorApp.post("/api/control-panel/:deviceRef/start-velocity-profile", (req, res, next) => {
      ControlPanelApi.startVelocityProfile(req, res, next);
    });
    const deviceRef = "devVel";
    const body = { target: 10, acceleration: 2, deceleration: 2 };
    const res = await request(errorApp).post(`/api/control-panel/${deviceRef}/start-velocity-profile`).send(body);
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toBe("fail-vel");
  });

  it("should respond 500 if an error is thrown in torque profile", async () => {
    jest.resetModules();
    const profileModesHandlerModule = require("../../services/ProfileModesHandler");
    profileModesHandlerModule.ProfileModesHandler.getInstance = () => ({
      startTorqueProfileMode: jest.fn(async () => {
        throw new Error("fail-torque");
      }),
    });
    ControlPanelApi = require("../../controllers/ControlPanelApi").default;
    const errorApp = express();
    errorApp.use(express.json());
    errorApp.post("/api/control-panel/:deviceRef/start-torque-profile", (req, res, next) => {
      ControlPanelApi.startTorqueProfile(req, res, next);
    });
    const deviceRef = "devTorque";
    const body = { target: 5, slope: 1 };
    const res = await request(errorApp).post(`/api/control-panel/${deviceRef}/start-torque-profile`).send(body);
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toBe("fail-torque");
  });
});
