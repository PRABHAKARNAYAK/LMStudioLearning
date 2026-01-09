import debug from "debug";
import express, { NextFunction, Request, Response } from "express";
import { lastValueFrom } from "rxjs";
import {
  DeviceRef,
  DeviceParameterIds,
  ensureDeviceRef,
  makeDeviceRefObj,
  ModesOfOperation,
  Cia402State,
  MotionMasterMessage,
  makeParameterId,
  IntegroEncoderCalibration,
  MotionComposerRunner,
  MotionComposer,
} from "motion-master-client";

import { MotionMasterClientFunctions } from "./MotionMasterClientFunctions";
import { Constants } from "../utility/constants";

Object.assign(globalThis, { WebSocket: require("ws") });

const log = debug("mmapi");

const motionMasterClientRoutes = express.Router();

const motionMasterClientFunctionsInstance = MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance();

function errmsg(err: unknown) {
  return err instanceof Error ? err.message : "Unknown error";
}

function asBoolean(value: string | undefined) {
  if (!value) {
    return false;
  }
  return value.toLowerCase() === "true" || value === "1";
}

function createDefaultDataMonitoringParameterIds(deviceRef: DeviceRef): DeviceParameterIds {
  // Local constants for magic numbers
  const CONTROLWORD = 0x6040;
  const MODES_OF_OPERATION = 0x6060;
  const TARGET_TORQUE = 0x6071;
  const TARGET_POSITION = 0x607a;
  const TARGET_VELOCITY = 0x60ff;
  const TORQUE_OFFSET = 0x60b2;
  const TUNING_COMMAND = 0x2701;
  const PHYSICAL_OUTPUTS = 0x60fe;
  const PHYSICAL_OUTPUTS_SUB1 = 0x01;
  const PHYSICAL_OUTPUTS_SUB2 = 0x02;
  const USER_MOSI = 0x2703;
  const VELOCITY_OFFSET = 0x60b1;
  const STATUSWORD = 0x6041;
  const MODES_OF_OPERATION_DISPLAY = 0x6061;
  const POSITION_ACTUAL_VALUE = 0x6064;
  const VELOCITY_ACTUAL_VALUE = 0x606c;
  const TORQUE_ACTUAL_VALUE = 0x6077;
  const UNKNOWN_60F4 = 0x60f4;
  const ANALOG_INPUT_1 = 0x2401;
  const ANALOG_INPUT_2 = 0x2402;
  const ANALOG_INPUT_3 = 0x2403;
  const ANALOG_INPUT_4 = 0x2404;
  const TUNING_STATUS = 0x2702;
  const DIGITAL_INPUTS = 0x60fd;
  const USER_MISO = 0x2704;
  const TIMESTAMP = 0x20f0;
  const POSITION_DEMAND_INTERNAL_VALUE = 0x60fc;
  const VELOCITY_DEMAND_VALUE = 0x606b;
  const TORQUE_DEMAND = 0x6074;

  return [
    // 0x1600: RxPDO Mapping 1
    [deviceRef, CONTROLWORD, 0x00], // Controlword
    [deviceRef, MODES_OF_OPERATION, 0x00], // Modes of operation
    [deviceRef, TARGET_TORQUE, 0x00], // Target Torque
    [deviceRef, TARGET_POSITION, 0x00], // Target position
    [deviceRef, TARGET_VELOCITY, 0x00], // Target velocity
    [deviceRef, TORQUE_OFFSET, 0x00], // Torque offset
    [deviceRef, TUNING_COMMAND, 0x00], // Tuning command
    // 0x1601: RxPDO Mapping 2
    [deviceRef, PHYSICAL_OUTPUTS, PHYSICAL_OUTPUTS_SUB1], // Physical outputs
    [deviceRef, PHYSICAL_OUTPUTS, PHYSICAL_OUTPUTS_SUB2], // Bit mask
    // 0x1602: RxPDO Mapping 3
    [deviceRef, USER_MOSI, 0x00], // User MOSI
    [deviceRef, VELOCITY_OFFSET, 0x00], // Velocity offset
    // 0x1A00: TxPDO Mapping 1
    [deviceRef, STATUSWORD, 0x00], // Statusword
    [deviceRef, MODES_OF_OPERATION_DISPLAY, 0x00], // Modes of operation display
    [deviceRef, POSITION_ACTUAL_VALUE, 0x00], // Position actual value
    [deviceRef, VELOCITY_ACTUAL_VALUE, 0x00], // Velocity actual value
    [deviceRef, TORQUE_ACTUAL_VALUE, 0x00], // Torque actual value
    [deviceRef, UNKNOWN_60F4, 0x00],
    // 0x1A01: TxPDO Mapping 2
    [deviceRef, ANALOG_INPUT_1, 0x00], // Analog input 1
    [deviceRef, ANALOG_INPUT_2, 0x00], // Analog input 2
    [deviceRef, ANALOG_INPUT_3, 0x00], // Analog input 3
    [deviceRef, ANALOG_INPUT_4, 0x00], // Analog input 4
    [deviceRef, TUNING_STATUS, 0x00], // Tuning status
    // 0x1A02: TxPDO Mapping 3
    [deviceRef, DIGITAL_INPUTS, 0x00], // Digital inputs
    // 0x1A03: TxPDO Mapping 4
    [deviceRef, USER_MISO, 0x00], // User MISO
    [deviceRef, TIMESTAMP, 0x00], // Timestamp
    [deviceRef, POSITION_DEMAND_INTERNAL_VALUE, 0x00], // Position demand internal value
    [deviceRef, VELOCITY_DEMAND_VALUE, 0x00], // Velocity demand value
    [deviceRef, TORQUE_DEMAND, 0x00], // Torque demand
  ];
}

// Middleware to parse JSON body
motionMasterClientRoutes.use(express.json({ limit: "10mb" }));

// Middleware to parse raw binary data
motionMasterClientRoutes.use(express.raw({ type: "application/octet-stream", limit: "10mb" }));

// Middleware to handle a non-existing instance of a client
motionMasterClientRoutes.use((req: Request, res: Response, next: NextFunction): void => {
  if (req.path.startsWith("/api/connect") || req.path === "/api/disconnect" || req.path === "/api/version") {
    return next();
  }

  if (!motionMasterClientFunctionsInstance.client) {
    res.status(Constants.BadRequest).send({
      message: "Client has not been created. Please connect using GET /api/connect/:hostname? before making requests to Motion Master.",
    });
    return;
  }

  next();
});

// Middleware to handle errors
motionMasterClientRoutes.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  log(`Error in handler: ${err.message}`);
  res.status(Constants.InternalServerError).send({ message: errmsg(err) });
});

type AsyncHandlerFunction = (req: Request, res: Response, next: NextFunction) => Promise<void>;
// Helper to safely get client instance
function getClientOrSendError(res: Response) {
  const client = motionMasterClientFunctionsInstance.client;
  if (!client) {
    res.status(Constants.BadRequest).send({ message: `${Constants.ClientNotConnected}` });
    return null;
  }
  return client;
}

// Async error handling middleware
const asyncHandler = (fn: AsyncHandlerFunction) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    await fn(req, res, next);
  } catch (err: unknown) {
    if (err instanceof Error) {
      log(`Error in async handler: ${err.message}`);
    }
    res.status(Constants.InternalServerError).send({ message: errmsg(err) });
  }
};

// app.get('/api/version', (_req: Request, res: Response) => {
//   res.send({ version: packageJson.version });
// });

motionMasterClientRoutes.get("/api/connect/:hostname?", motionMasterClientFunctionsInstance.connect);

motionMasterClientRoutes.get("/api/disconnect", motionMasterClientFunctionsInstance.disconnect);

motionMasterClientRoutes.get(
  "/api/devices/:deviceRef/getDeviceParameterValues/:parameterIds",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = req.params["deviceRef"];
    const parameterId = req.params["parameterIds"];

    const status = await motionMasterClientFunctionsInstance.getDeviceParameterValues(deviceRef, parameterId);
    res.send(status);
  })
);

motionMasterClientRoutes.get(
  "/api/system-version",
  asyncHandler(async (_req: Request, res: Response) => {
    const TIMEOUT_MS = 5000;
    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    const status = await lastValueFrom(client.request.getSystemVersion(TIMEOUT_MS));
    res.send({ version: status.version });
  })
);

motionMasterClientRoutes.get(
  "/api/devices",
  asyncHandler(async (_req: Request, res: Response) => {
    const deviceRequestTimeout = 10000;
    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    const devices = await lastValueFrom(client.request.getDevices(deviceRequestTimeout));
    res.send(devices);
  })
);

motionMasterClientRoutes.get(
  "/api/devices/:deviceRef/parameter-info",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const deviceRefObj = makeDeviceRefObj(deviceRef);
    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    const deviceParameterTimeout = 5000;
    const status = await lastValueFrom(client.request.getDeviceParameterInfo(deviceRefObj, deviceParameterTimeout));
    res.send(status?.parameters);
  })
);

motionMasterClientRoutes.get("/api/devices/:deviceRef/upload/:index/:subindex", motionMasterClientFunctionsInstance.upload);

motionMasterClientRoutes.get(
  "/api/devices/:deviceRef/download/:index/:subindex/:value",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const index = Number.parseInt(req.params["index"], 16);
    const subindex = Number.parseInt(req.params["subindex"], 16);
    const value = req.params["value"];

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    await client.request.download(deviceRef, index, subindex, value);
    res.status(204).send();
  })
);

motionMasterClientRoutes.get(
  "/api/devices/:deviceRef/files",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    const value = await lastValueFrom(client.request.getFiles(deviceRef));
    res.send(value);
  })
);

motionMasterClientRoutes.get(
  "/api/devices/:deviceRef/files/unlock",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    await lastValueFrom(client.request.unlockProtectedFiles(deviceRef));
    res.send();
  })
);

motionMasterClientRoutes.get(
  Constants.FILENAME_URL,
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const filename = req.params["filename"];

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    const timeoutDuration = 30000;
    const value = await lastValueFrom(client.request.getDecodedFile(deviceRef, filename, timeoutDuration));
    res.send(value);
  })
);

motionMasterClientRoutes.put(
  Constants.FILENAME_URL,
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const filename = req.params["filename"];
    const buffer: Buffer = req.body as Buffer;
    const content = new Uint8Array(buffer);

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    const requestTimeoutDuration = 30000;
    await lastValueFrom(client.request.setFile(deviceRef, filename, content, true, requestTimeoutDuration));
    res.send();
  })
);

motionMasterClientRoutes.delete(
  Constants.FILENAME_URL,
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const filename = req.params["filename"];

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    await lastValueFrom(client.request.deleteFile(deviceRef, filename));
    res.send();
  })
);

motionMasterClientRoutes.get(
  "/api/devices/:deviceRef/quick-stop",
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const deviceRef = ensureDeviceRef(req.params["deviceRef"]);

      motionMasterClientFunctionsInstance.quickStop(deviceRef);
      res.send({ message: "Quick stop command sent successfully" });
    } catch (error) {
      res.status(Constants.InternalServerError).send({ message: `Failed to send quick stop command. ${(error as Error).message}` });
    }
  })
);

motionMasterClientRoutes.post(
  "/api/devices/:deviceRef/start-firmware-installation",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const deviceRefObj = makeDeviceRefObj(deviceRef);
    const buffer: Buffer = req.body as Buffer;
    const firmwarePackageContent = new Uint8Array(buffer);
    const skipSiiInstallation = asBoolean(req.query["skip-sii-installation"] as string);

    const startDeviceFirmwareInstalationRequest = {
      ...deviceRefObj,
      firmwarePackageContent,
      skipSiiInstallation,
    };

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    const firmwareInstallationTimeout = 120000;
    const status = await lastValueFrom(client.request.startDeviceFirmwareInstallation(startDeviceFirmwareInstalationRequest, firmwareInstallationTimeout));
    if (status.request === "succeeded") {
      res.send();
    } else {
      res.status(Constants.InternalServerError).send(status.error);
    }
  })
);

motionMasterClientRoutes.get(
  "/api/devices/:deviceRef/log",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const deviceRefObj = makeDeviceRefObj(deviceRef);

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    const logRetrievalTimeout = 10000;
    const status = await lastValueFrom(client.request.getDeviceLog(deviceRefObj, logRetrievalTimeout));
    res.send(status.content);
  })
);

motionMasterClientRoutes.get(
  "/api/devices/:deviceRef/start-cogging-torque-recording",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const deviceRefObj = makeDeviceRefObj(deviceRef);
    const skipAutoTuning = asBoolean(req.query["skip-auto-tuning"] as string);

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    const coggingTorqueRecordingInterval = 180000;
    const status = await lastValueFrom(client.request.startCoggingTorqueRecording({ ...deviceRefObj, skipAutoTuning }, coggingTorqueRecordingInterval));
    if (status.request === "succeeded") {
      const torqueDataTimeout = 10000;
      const value = await lastValueFrom(client.request.getCoggingTorqueData(deviceRefObj, torqueDataTimeout));
      res.send(value.table?.data ?? []);
    } else {
      res.status(Constants.InternalServerError).send(status.error);
    }
  })
);

motionMasterClientRoutes.get(
  "/api/devices/:deviceRef/cogging-torque-data",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const deviceRefObj = makeDeviceRefObj(deviceRef);

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    const coggingTorqueDataTimeout = 10000;
    const status = await lastValueFrom(client.request.getCoggingTorqueData(deviceRefObj, coggingTorqueDataTimeout));
    res.send(status.table?.data ?? []);
  })
);

motionMasterClientRoutes.get(
  "/api/devices/:deviceRef/start-offset-detection",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const deviceRefObj = makeDeviceRefObj(deviceRef);

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    const offsetDetectionTimeout = 120000;
    const status = await lastValueFrom(client.request.startOffsetDetection(deviceRefObj, offsetDetectionTimeout));
    if (status.request === "succeeded") {
      const commutationAngleOffsetIndex = 0x2001;
      const commutationAngleOffset = await client.request.upload(deviceRef, commutationAngleOffsetIndex, 0);
      res.send({ commutationAngleOffset });
    } else {
      res.status(Constants.InternalServerError).send(status.error);
    }
  })
);

motionMasterClientRoutes.get(
  "/api/devices/:deviceRef/set-modes-of-operation/:modesOfOperation",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const modesOfOperation = Number.parseInt(req.params["modesOfOperation"] ?? "0", 10) as ModesOfOperation;

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    await lastValueFrom(client.request.setModesOfOperation(deviceRef, modesOfOperation));
    res.send();
  })
);

motionMasterClientRoutes.get(
  "/api/devices/:deviceRef/transition-to-cia402-state/:state",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const state = req.params["state"] as Cia402State;

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    await client.request.transitionToCia402State(deviceRef, state);
    res.send();
  })
);

motionMasterClientRoutes.get(
  "/api/devices/:deviceRef/cia402-state",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    const state = await lastValueFrom(client.request.getCia402State(deviceRef));
    res.send({ state });
  })
);

motionMasterClientRoutes.get(
  "/api/devices/:deviceRef/save-config",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    await lastValueFrom(client.request.saveConfig(deviceRef));
    res.send();
  })
);

motionMasterClientRoutes.put(
  "/api/devices/:deviceRef/load-config",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const buffer: Buffer = req.body as Buffer;
    const content = new Uint8Array(buffer);

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    await lastValueFrom(client.request.loadConfig(deviceRef, content, { count: 20, delay: 500 }));
    res.send();
  })
);

motionMasterClientRoutes.get(
  "/api/devices/:deviceRef/start-full-auto-tuning/velocity",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const deviceRefObj = makeDeviceRefObj(deviceRef);
    const type = MotionMasterMessage.Request.StartFullAutoTuning.Type.VELOCITY;

    const props = {
      ...deviceRefObj,
      type,
    };

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    const autoTuningDuration = 60000;
    const status = await lastValueFrom(client.request.startFullAutoTuning(props, autoTuningDuration));
    if (status.request === "succeeded") {
      const dampingRatio = status.dampingRatio ?? 0;
      const settlingTime = status.settlingTime ?? 0;
      const bandwidth = status.bandwidth ?? 0;
      const pidObj: { [key: string]: number } = {};
      for (let subidx = 1; subidx < 5; subidx++) {
        const velocityControllerIndex = 0x2011;
        pidObj[makeParameterId(velocityControllerIndex, subidx)] = await client.request.upload(deviceRef, velocityControllerIndex, subidx);
      }
      const response = {
        dampingRatio,
        settlingTime,
        bandwidth,
        ...pidObj,
      };
      res.send(response);
    } else {
      res.status(Constants.InternalServerError).send(status.error);
    }
  })
);

motionMasterClientRoutes.get(
  "/api/devices/:deviceRef/start-full-auto-tuning/position/:controllerType",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const deviceRefObj = makeDeviceRefObj(deviceRef);
    const type = MotionMasterMessage.Request.StartFullAutoTuning.Type.POSITION;

    let controllerType: number;
    if (req.params["controllerType"] === "PI_P") {
      controllerType = MotionMasterMessage.Request.StartFullAutoTuning.ControllerType.PI_P;
    } else if (req.params["controllerType"] === "P_PI") {
      controllerType = MotionMasterMessage.Request.StartFullAutoTuning.ControllerType.P_PI;
    } else {
      controllerType = MotionMasterMessage.Request.StartFullAutoTuning.ControllerType.UNSPECIFIED;
    }

    const props = {
      ...deviceRefObj,
      type,
      controllerType,
    };

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    const fullAutoTuningTimeout = 60000;
    const status = await lastValueFrom(client.request.startFullAutoTuning(props, fullAutoTuningTimeout));
    if (status.request === "succeeded") {
      const dampingRatio = status.dampingRatio ?? 0;
      const settlingTime = status.settlingTime ?? 0;
      const bandwidth = status.bandwidth ?? 0;
      const pidObj: { [key: string]: number } = {};
      for (let subidx = 1; subidx < 9; subidx++) {
        const positionControllerIndex = 0x2012;
        pidObj[makeParameterId(positionControllerIndex, subidx)] = await client.request.upload(deviceRef, positionControllerIndex, subidx);
      }
      const response = {
        dampingRatio,
        settlingTime,
        bandwidth,
        ...pidObj,
      };
      res.send(response);
    } else {
      res.status(Constants.InternalServerError).send(status.error);
    }
  })
);

motionMasterClientRoutes.get(
  "/api/devices/:deviceRef/stop-full-auto-tuning",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const deviceRefObj = makeDeviceRefObj(deviceRef);

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    const autoTuneTimeout = 10000;
    const status = await lastValueFrom(client.request.stopFullAutoTuning(deviceRefObj, autoTuneTimeout));
    if (status.request == "succeeded") {
      res.send();
    } else {
      res.status(Constants.InternalServerError).send(status.error);
    }
  })
);

motionMasterClientRoutes.get(
  "/api/devices/:deviceRef/set-halt-bit/:value",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const value = asBoolean(req.params["value"]);

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    await client.request.setHaltBit(deviceRef, value);
    res.send();
  })
);

/**
 * @example curl "http://localhost:63500/api/devices/0/run-torque-profile?target=100&holding-duration=3000&skip-quick-stop=false&target-reach-timeout=5000&slope=50&window=30&window-time=1"
 */
motionMasterClientRoutes.get(
  "/api/devices/:deviceRef/run-torque-profile",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const target = Number.parseInt((req.query["target"] ?? "1000") as string, 10);
    const holdingDuration = Number.parseInt(req.query[Constants.HOLDING_DURATION] as string, 10) || undefined;
    const skipQuickStop = asBoolean(req.query[Constants.SKIP_QUICK_STOP] as string);
    const targetReachTimeout = Number.parseInt(req.query[Constants.TARGET_REACH_TIMEOUT] as string, 10) || undefined;
    const slope = Number.parseInt((req.query["slope"] ?? "50") as string, 10);
    const window = Number.parseInt(req.query["window"] as string, 10) || undefined;
    const windowTime = Number.parseInt(req.query[Constants.WINDOW_TIME] as string, 10) || undefined;

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    const dataMonitoring = client.createDataMonitoring(createDefaultDataMonitoringParameterIds(deviceRef), 1);
    dataMonitoring.start().subscribe();
    try {
      await client.runTorqueProfile(deviceRef, {
        target,
        holdingDuration,
        skipQuickStop,
        targetReachTimeout,
        slope,
        window,
        windowTime,
      });
      res.send(dataMonitoring.csv);
    } finally {
      dataMonitoring.stop();
    }
  })
);

/**
 * @example curl "http://localhost:63500/api/devices/0/run-velocity-profile?acceleration=5000&target=1000&deceleration=5000&holding-duration=2000&skip-quick-stop=false&target-reach-timeout=5000&window=10&window-time=1"
 */
motionMasterClientRoutes.get(
  "/api/devices/:deviceRef/run-velocity-profile",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const acceleration = Number.parseInt((req.query["acceleration"] ?? "1000") as string, 10);
    const target = Number.parseInt((req.query["target"] ?? "1000") as string, 10);
    const deceleration = Number.parseInt((req.query["deceleration"] ?? "1000") as string, 10);
    const holdingDuration = Number.parseInt(req.query[Constants.HOLDING_DURATION] as string, 10) || undefined;
    const skipQuickStop = asBoolean(req.query[Constants.SKIP_QUICK_STOP] as string);
    const targetReachTimeout = Number.parseInt(req.query[Constants.TARGET_REACH_TIMEOUT] as string, 10) || undefined;
    const window = Number.parseInt(req.query["window"] as string, 10) || undefined;
    const windowTime = Number.parseInt(req.query[Constants.WINDOW_TIME] as string, 10) || undefined;

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    const dataMonitoring = client.createDataMonitoring(createDefaultDataMonitoringParameterIds(deviceRef), 1);
    dataMonitoring.start().subscribe({ error: () => {} }); // ignore error
    try {
      await client.runVelocityProfile(deviceRef, {
        acceleration,
        target,
        deceleration,
        holdingDuration,
        skipQuickStop,
        targetReachTimeout,
        window,
        windowTime,
      });
      res.send(dataMonitoring.csv);
    } finally {
      dataMonitoring.stop();
    }
  })
);

/**
 * @example curl "http://localhost:63500/api/devices/0/run-position-profile?acceleration=5000&target=10000&deceleration=5000&holding-duration=2000&relative=true&skip-quick-stop=false&target-reach-timeout=5000&velocity=2000&window=10&window-time=1"
 */
motionMasterClientRoutes.get(
  "/api/devices/:deviceRef/run-position-profile",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const acceleration = Number.parseInt((req.query["acceleration"] ?? "1000") as string, 10);
    const target = Number.parseInt((req.query["target"] ?? "1000") as string, 10);
    const deceleration = Number.parseInt((req.query["deceleration"] ?? "1000") as string, 10);
    const holdingDuration = Number.parseInt(req.query[Constants.HOLDING_DURATION] as string, 10) || undefined;
    const relative = asBoolean(req.query["relative"] as string);
    const skipQuickStop = asBoolean(req.query[Constants.SKIP_QUICK_STOP] as string);
    const targetReachTimeout = Number.parseInt(req.query[Constants.TARGET_REACH_TIMEOUT] as string, 10) || undefined;
    const velocity = Number.parseInt((req.query["velocity"] ?? "100") as string, 10);
    const window = Number.parseInt(req.query["window"] as string, 10) || undefined;
    const windowTime = Number.parseInt(req.query[Constants.WINDOW_TIME] as string, 10) || undefined;

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    const dataMonitoring = client.createDataMonitoring(createDefaultDataMonitoringParameterIds(deviceRef), 1);
    dataMonitoring.start().subscribe();
    try {
      await client.runPositionProfile(deviceRef, {
        acceleration,
        target,
        deceleration,
        holdingDuration,
        relative,
        skipQuickStop,
        targetReachTimeout,
        velocity,
        window,
        windowTime,
      });
      res.send(dataMonitoring.csv);
    } finally {
      dataMonitoring.stop();
    }
  })
);

motionMasterClientRoutes.get(
  "/api/devices/:deviceRef/apply-set-point",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    await client.request.applySetPoint(deviceRef);
    res.send();
  })
);

motionMasterClientRoutes.get(
  "/api/devices/:deviceRef/start-circulo-encoder-narrow-angle-calibration",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const deviceRefObj = makeDeviceRefObj(deviceRef);
    const encoderOrdinal = Number.parseInt((req.query["encoder-ordinal"] ?? "1") as string, 10);
    const activateHealthMonitoring = asBoolean(req.query["activate-health-monitoring"] as string);

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    const requestTimeout = 120000;
    const status = await lastValueFrom(
      client.request.startCirculoEncoderNarrowAngleCalibrationProcedure({ ...deviceRefObj, encoderOrdinal, activateHealthMonitoring }, requestTimeout)
    );
    if (status.request === "succeeded") {
      res.send();
    } else {
      res.status(500).send(status.error);
    }
  })
);

motionMasterClientRoutes.get(
  "/api/devices/:deviceRef/start-circulo-encoder-configuration",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);
    const deviceRefObj = makeDeviceRefObj(deviceRef);
    const encoderOrdinal = Number.parseInt((req.query["encoder-ordinal"] ?? "1") as string, 10);
    const batteryModeMaxAcceleration = Number.parseInt((req.query["battery-mode-max-acceleration"] ?? "0") as string, 10);

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    const requestTimeout = 30000;
    const status = await lastValueFrom(client.request.startCirculoEncoderConfiguration({ ...deviceRefObj, encoderOrdinal, batteryModeMaxAcceleration }, requestTimeout));
    if (status.request === "succeeded") {
      res.send();
    } else {
      res.status(500).send(status.error);
    }
  })
);

motionMasterClientRoutes.get(
  "/api/devices/:deviceRef/start-integro-encoder-calibration",
  asyncHandler(async (req: Request, res: Response) => {
    const deviceRef = ensureDeviceRef(req.params["deviceRef"]);

    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    await new IntegroEncoderCalibration(client, deviceRef).start();
    res.send();
  })
);

let motionComposerRunner: MotionComposerRunner | null = null;

motionMasterClientRoutes.post(
  "/api/motion-composer/run",
  asyncHandler(async (req: Request, res: Response) => {
    const client = getClientOrSendError(res);
    if (!client) {
      return;
    }
    motionComposerRunner = new MotionComposerRunner(client);
    const motionComposer = req.body as MotionComposer;
    const finalMotionComposer = await lastValueFrom(motionComposerRunner.run(motionComposer));
    motionComposerRunner = null;
    res.send(finalMotionComposer);
  })
);

motionMasterClientRoutes.get(
  "/api/motion-composer/stop",
  asyncHandler(async (_req: Request, res: Response) => {
    motionComposerRunner?.stop();
    res.send();
  })
);

motionMasterClientRoutes.get("/api/devices/:deviceRef/getDeviceParameters", motionMasterClientFunctionsInstance.getDeviceParameters);

export = motionMasterClientRoutes;
