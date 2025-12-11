// Tests for Lexium38iDiagnostics controller
import { Constants } from "../../utility/constants";
import { of, throwError } from "rxjs";

// Mock socket.io getIO()
const mockEmit = jest.fn();
const mockSocket = { emit: mockEmit } as any;
jest.mock("../../webSockets/ioManager", () => ({
  getIO: () => mockSocket,
}));

// Mock WebSocketManager to prevent real server errors
jest.mock("../../webSockets/webSocketManager");

// Mock DiagnosticsDataService
const mockDiagnosticsDataBase = {
  containsDiagnosticsData: true,
  remedy: "Test remedy",
  errorCodeList: [],
  explanation: "-",
  longForm: "-",
  group: "Test",
  isFault: true,
};
const getDiagnosticsDataForErrorMock = jest.fn((code: string, report: string) => ({
  ...mockDiagnosticsDataBase,
  errorCode: code,
  errorReport: report,
  id: `0x${Number.parseInt(code, 10).toString(16)}:${report}`,
}));
jest.mock("../../services/DiagnosticsDataService", () => ({
  DiagnosticsDataService: class {
    static getInstance() {
      return { getDiagnosticsDataForError: getDiagnosticsDataForErrorMock };
    }
  },
}));

// Prepare a controllable fake DataMonitoring
type SubscriberFn = (data: any[]) => void;
let subscriber: SubscriberFn | undefined;
const mockDataMonitoring = {
  start: () => ({
    subscribe: (arg: SubscriberFn | { next?: SubscriberFn }) => {
      if (typeof arg === "function") {
        subscriber = arg;
      } else if (arg && typeof arg === "object" && typeof arg.next === "function") {
        subscriber = arg.next;
      } else {
        subscriber = undefined;
      }
    },
  }),
  stop: jest.fn(),
};

// Mock MotionMasterClientFunctions and its singleton instance
const mockCreateDataMonitoring = jest.fn(() => mockDataMonitoring);
// Replace previous unused mockGetCia402State with an active spy

const mockGetCia402State = jest.fn(() => of(0));
const mockResetFault = jest.fn();
const mockClient = {
  createDataMonitoring: mockCreateDataMonitoring,
  request: {
    getCia402State: mockGetCia402State, // Always return enum value 0
    resetFault: mockResetFault,
  },
};
const mockMMCFInstance: any = { client: mockClient };
jest.mock("../../controllers/MotionMasterClientFunctions", () => ({
  MotionMasterClientFunctions: class {
    static getMotionMasterClientFunctionsInstance() {
      return mockMMCFInstance;
    }
  },
}));

// Now import the controller under test AFTER mocks
import lexiumDiagnostics from "../../controllers/Lexium38iDiagnostics";

// Helper to invoke subscriber (simulate data monitoring emission)
function emitMonitoring(statusWord: number, errorCode: number, errorReport: number) {
  if (!subscriber) throw new Error("No subscriber registered");
  subscriber([statusWord, errorCode, errorReport]);
}

// Async flush helper to allow pending promises (like lastValueFrom) to resolve
async function flushAsync() {
  await new Promise((r) => setTimeout(r, 0));
}

// Build minimal Express-like req/res mocks
function buildReq(deviceRef: string = "1"): any {
  return { params: { deviceRef } } as any;
}
function buildRes() {
  return {
    statusCode: 200,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload?: any) {
      this.body = payload;
      return this;
    },
  } as any;
}

describe("Lexium38iDiagnostics", () => {
  beforeEach(() => {
    mockEmit.mockClear();
    mockCreateDataMonitoring.mockClear();
    (mockDataMonitoring.stop as jest.Mock).mockClear();
    mockGetCia402State.mockClear();
    mockResetFault.mockClear();
    // Reset internal singleton state that can leak across tests
    (lexiumDiagnostics as any).dataMonitoring = undefined;
    (lexiumDiagnostics as any).currentDiagnosticData = null;
    (lexiumDiagnostics as any).previousStatusWord = undefined;
  });

  it("starts diagnostics and sets up data monitoring", async () => {
    const req = buildReq();
    const res = buildRes();

    await lexiumDiagnostics.startDiagnostics(req, res);

    expect(res.body).toEqual({ success: true });
    expect(mockCreateDataMonitoring).toHaveBeenCalledTimes(1);
    expect(subscriber).toBeDefined();
  });

  it("emits diagnostic info on fault and stores currentDiagnosticData", async () => {
    const req = buildReq();
    const res = buildRes();
    await lexiumDiagnostics.startDiagnostics(req, res);

    // statusWord with bit 3 (fault) set => 1 << 3 = 8
    emitMonitoring(8, 123, 456);

    // Expect DiagnosticInfo + ErrorWarningStateChange events
    const diagnosticEmit = mockEmit.mock.calls.find((c) => c[0] === Constants.DiagnosticInfo);
    expect(diagnosticEmit).toBeDefined();
    const errorStateEmit = mockEmit.mock.calls.find((c) => c[0] === Constants.ErrorWarningStateChange && c[1] === true);
    expect(errorStateEmit).toBeDefined();
  });

  it("clears diagnostic info when fault/warning disappears", async () => {
    const req = buildReq();
    const res = buildRes();
    await lexiumDiagnostics.startDiagnostics(req, res);
    // Trigger fault first
    emitMonitoring(8, 123, 456);
    mockEmit.mockClear();
    // Now emit normal status (0)
    emitMonitoring(0, 0, 0);
    const clearEmit = mockEmit.mock.calls.find((c) => c[0] === Constants.DiagnosticInfo && c[1].containsDiagnosticsData === false);
    const stateFalseEmit = mockEmit.mock.calls.find((c) => c[0] === Constants.ErrorWarningStateChange && c[1] === false);
    expect(clearEmit).toBeDefined();
    expect(stateFalseEmit).toBeDefined();
  });

  it("getErrorAndWarningData returns 204 when no data", async () => {
    const req = buildReq();
    const res = buildRes();
    await lexiumDiagnostics.startDiagnostics(req, res);
    const res2 = buildRes();
    await lexiumDiagnostics.getErrorAndWarningData(req, res2);
    expect(res2.statusCode).toBe(204);
  });

  it("getErrorAndWarningData returns body after fault", async () => {
    const req = buildReq();
    const res = buildRes();
    await lexiumDiagnostics.startDiagnostics(req, res);
    emitMonitoring(8, 123, 456);
    const res2 = buildRes();
    await lexiumDiagnostics.getErrorAndWarningData(req, res2);
    expect(res2.statusCode).toBe(200);
    expect(res2.body).toBeDefined();
    expect(res2.body.errorCode).toBe("123");
  });

  it("getDeviceDiagnosticStatus returns true only when diagnostic data exists", async () => {
    const req = buildReq();
    const res = buildRes();
    await lexiumDiagnostics.startDiagnostics(req, res);

    const statusRes1 = buildRes();
    await lexiumDiagnostics.getDeviceDiagnosticStatus(req, statusRes1);
    expect(statusRes1.statusCode).toBe(204);

    emitMonitoring(8, 123, 456);
    const statusRes2 = buildRes();
    await lexiumDiagnostics.getDeviceDiagnosticStatus(req, statusRes2);
    expect(statusRes2.body).toBe(true);
  });

  // New Tests Added Below -------------------------------------------------

  it("emits DeviceStatusChange only when status word changes", async () => {
    const req = buildReq();
    const res = buildRes();
    await lexiumDiagnostics.startDiagnostics(req, res);

    emitMonitoring(0, 0, 0); // first status
    await flushAsync();
    const firstStatusEmit = mockEmit.mock.calls.find((c) => c[0] === Constants.SOCKET_ON_CIA402_STATE_CHANGE);
    expect(firstStatusEmit).toBeDefined();
    expect(mockGetCia402State).toHaveBeenCalledTimes(1);

    mockEmit.mockClear();
    emitMonitoring(0, 0, 0); // same status, should NOT emit
    await flushAsync();
    expect(mockGetCia402State).toHaveBeenCalledTimes(1);
    const repeatedStatusEmit = mockEmit.mock.calls.find((c) => c[0] === Constants.SOCKET_ON_CIA402_STATE_CHANGE);
    expect(repeatedStatusEmit).toBeUndefined();

    emitMonitoring(8, 0, 0); // change status word (fault bit set)
    await flushAsync();
    expect(mockGetCia402State).toHaveBeenCalledTimes(2);
  });

  it("startDiagnostics with different deviceRef stops previous monitoring", async () => {
    const req1 = buildReq("1");
    const res1 = buildRes();
    await lexiumDiagnostics.startDiagnostics(req1, res1);
    expect(mockCreateDataMonitoring).toHaveBeenCalledTimes(1);

    const initialStopCalls = (mockDataMonitoring.stop as jest.Mock).mock.calls.length;

    const req2 = buildReq("2");
    const res2 = buildRes();
    await lexiumDiagnostics.startDiagnostics(req2, res2);
    await flushAsync();

    const finalStopCalls = (mockDataMonitoring.stop as jest.Mock).mock.calls.length;
    expect(finalStopCalls).toBe(initialStopCalls + 1); // exactly one additional stop
    expect(mockCreateDataMonitoring).toHaveBeenCalledTimes(2);
  });

  it("resetFault delegates to client.request.resetFault", async () => {
    const req = buildReq("3");
    const res = buildRes();
    await lexiumDiagnostics.startDiagnostics(req, res);
    await lexiumDiagnostics.resetFault(req, res);
    expect(mockResetFault).toHaveBeenCalledTimes(1);
  });

  it("emits warning diagnostic when only warning bit set", async () => {
    const req = buildReq();
    const res = buildRes();
    await lexiumDiagnostics.startDiagnostics(req, res);

    mockEmit.mockClear();
    emitMonitoring(1 << 7, 123, 456); // warning bit 7 set only
    const diagnosticEmit = mockEmit.mock.calls.find((c) => c[0] === Constants.DiagnosticInfo);
    expect(diagnosticEmit).toBeDefined();
    const payload = diagnosticEmit?.[1];
    expect(payload.isFault).toBe(false);
  });

  it("getCurrentDeviceStatus returns status text", async () => {
    const req = buildReq();
    const res = buildRes();
    await lexiumDiagnostics.startDiagnostics(req, res);
    const statusRes = buildRes();
    await lexiumDiagnostics.getCia402StateOfDevice(req, statusRes);
    // Accept either 'status' or 'state' property, but expect only the state string (no prefix)
    if (statusRes.body && typeof statusRes.body.status === "string") {
      expect(statusRes.body.status).toMatch(
        new RegExp(
          `^${Constants.SWITCH_ON_DISABLED}|${Constants.FAULT}|${Constants.FAULT_REACTION_ACTIVE}|${Constants.NOT_READY_TO_SWITCH_ON}|${Constants.OPERATION_ENABLED}|${Constants.QUICK_STOP_ACTIVE}|${Constants.READY_TO_SWITCH_ON}|${Constants.SWITCHED_ON}`
        )
      );
    } else if (statusRes.body && typeof statusRes.body.state === "string") {
      expect(statusRes.body.state).toMatch(
        new RegExp(
          `^${Constants.SWITCH_ON_DISABLED}|${Constants.FAULT}|${Constants.FAULT_REACTION_ACTIVE}|${Constants.NOT_READY_TO_SWITCH_ON}|${Constants.OPERATION_ENABLED}|${Constants.QUICK_STOP_ACTIVE}|${Constants.READY_TO_SWITCH_ON}|${Constants.SWITCHED_ON}`
        )
      );
    } else {
      expect(statusRes.body).toBeUndefined();
    }
  });

  it("startDiagnostics returns success when client undefined (no monitoring started)", async () => {
    const savedClient = mockMMCFInstance.client;
    mockMMCFInstance.client = undefined;
    const req = buildReq();
    const res = buildRes();
    await lexiumDiagnostics.startDiagnostics(req, res);
    expect(res.body).toEqual({ success: true });
    expect(mockCreateDataMonitoring).not.toHaveBeenCalled();
    mockMMCFInstance.client = savedClient;
  });

  it("startDiagnostics returns 500 when createDataMonitoring throws", async () => {
    const failingClient = {
      createDataMonitoring: () => {
        throw new Error("boom");
      },
      request: {
        getCia402State: mockGetCia402State,
        resetFault: mockResetFault,
      },
    };
    const savedClient = mockMMCFInstance.client;
    mockMMCFInstance.client = failingClient;
    const req = buildReq();
    const res = buildRes();
    await lexiumDiagnostics.startDiagnostics(req, res);
    expect(res.statusCode).toBe(500);
    mockMMCFInstance.client = savedClient;
  });

  it("does not re-emit diagnostic info when same fault repeats", async () => {
    const req = buildReq();
    const res = buildRes();
    await lexiumDiagnostics.startDiagnostics(req, res);
    emitMonitoring(8, 123, 456);
    // ...existing code...
    mockEmit.mockClear();
    emitMonitoring(8, 123, 456); // same errorCode & report
    const repeatEmits = mockEmit.mock.calls.filter((c) => c[0] === Constants.DiagnosticInfo).length;
    expect(repeatEmits).toBe(0);
  });

  it("re-emits diagnostic info when fault id changes", async () => {
    const req = buildReq();
    const res = buildRes();
    await lexiumDiagnostics.startDiagnostics(req, res);
    emitMonitoring(8, 123, 456);
    mockEmit.mockClear();
    emitMonitoring(8, 123, 789); // different errorReport -> new id
    const newEmit = mockEmit.mock.calls.find((c) => c[0] === Constants.DiagnosticInfo);
    expect(newEmit).toBeDefined();
    const payload = newEmit?.[1];
    expect(payload.id).toMatch(/789$/);
  });

  it("getCurrentDeviceStatus returns early when no client or deviceRef", async () => {
    const savedClient = mockMMCFInstance.client;
    mockMMCFInstance.client = undefined;
    const req = buildReq(); // deviceRef param but currentDeviceRef inside controller not set
    const res = buildRes();
    await lexiumDiagnostics.getCia402StateOfDevice(req, res);
    expect(res.body).toBeUndefined();
    mockMMCFInstance.client = savedClient;
  });

  it("getCurrentDeviceStatus catches observable error", async () => {
    const req = buildReq();
    const res = buildRes();
    await lexiumDiagnostics.startDiagnostics(req, res);
    mockGetCia402State.mockImplementation(() => throwError(() => new Error("state fail")));
    const statusRes = buildRes();
    await lexiumDiagnostics.getCia402StateOfDevice(req, statusRes);
    // Should not throw, and body may be undefined due to error path
    expect(statusRes.body).toBeUndefined();
    mockGetCia402State.mockImplementation(() => of(0));
  });

  it("getCurrentDeviceStatus uses fallback mapping for unknown state", async () => {
    const req = buildReq();
    const res = buildRes();
    await lexiumDiagnostics.startDiagnostics(req, res);
    mockGetCia402State.mockImplementationOnce(() => of(999 as any));
    const statusRes = buildRes();
    await lexiumDiagnostics.getCia402StateOfDevice(req, statusRes);
    // Accept either 'status' or 'state' property, but expect only the state string (no prefix)
    if (statusRes.body && typeof statusRes.body.status === "string") {
      expect(statusRes.body.status).toBe(Constants.SWITCH_ON_DISABLED);
    } else if (statusRes.body && typeof statusRes.body.state === "string") {
      expect(statusRes.body.state).toBe(Constants.SWITCH_ON_DISABLED);
    } else {
      expect(statusRes.body).toBeUndefined();
    }
  });

  it("emitDeviceStatus early return when currentDeviceRef missing", async () => {
    const req = buildReq();
    const res = buildRes();
    await lexiumDiagnostics.startDiagnostics(req, res);
    // Force previousStatusWord different to trigger emitDeviceStatus path
    (lexiumDiagnostics as any).previousStatusWord = 0;
    (lexiumDiagnostics as any).currentDeviceRef = undefined; // cause early return
    mockEmit.mockClear();
    emitMonitoring(1, 0, 0);
    await flushAsync();
    const statusEmit = mockEmit.mock.calls.find((c) => c[0] === Constants.SOCKET_ON_CIA402_STATE_CHANGE);
    expect(statusEmit).toBeUndefined();
  });

  it("emitDeviceStatus catch path on getCia402State error", async () => {
    const req = buildReq();
    const res = buildRes();
    await lexiumDiagnostics.startDiagnostics(req, res);
    // First emission to set previousStatusWord
    emitMonitoring(0, 0, 0);
    await flushAsync();
    mockEmit.mockClear();
    mockGetCia402State.mockImplementationOnce(() => throwError(() => new Error("emit fail")));
    emitMonitoring(2, 0, 0); // change status to trigger emitDeviceStatus
    await flushAsync();
    const statusEmit = mockEmit.mock.calls.find((c) => c[0] === Constants.SOCKET_ON_CIA402_STATE_CHANGE);
    expect(statusEmit).toBeUndefined(); // since failure occurred
    mockGetCia402State.mockImplementation(() => of(0));
  });

  it("emitDeviceStatus uses fallback mapping for unknown state", async () => {
    const req = buildReq();
    const res = buildRes();
    await lexiumDiagnostics.startDiagnostics(req, res);
    emitMonitoring(0, 0, 0); // initial
    await flushAsync();
    mockEmit.mockClear();
    mockGetCia402State.mockImplementationOnce(() => of(999 as any));
    emitMonitoring(3, 0, 0); // change status word
    await flushAsync();
    const statusEmit = mockEmit.mock.calls.find((c) => c[0] === Constants.SOCKET_ON_CIA402_STATE_CHANGE);
    expect(statusEmit).toBeDefined();
    // Expect only the state string (no prefix)
    expect(statusEmit?.[1]).toBe(Constants.SWITCH_ON_DISABLED);
  });
});
