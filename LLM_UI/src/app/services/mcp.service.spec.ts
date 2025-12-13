import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { McpService } from './mcp.service';

describe('McpService', () => {
  let service: McpService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), McpService],
    });
    service = TestBed.inject(McpService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize MCP session', (done) => {
    const mockResponse = {
      jsonrpc: '2.0',
      id: 1,
      result: {
        sessionId: 'test-session-id',
        protocolVersion: '2024-11-05',
        capabilities: {},
        serverInfo: {
          name: 'servo-mcp-bridge',
          version: '1.0.0',
        },
      },
    };

    service.initialize().subscribe((response) => {
      expect(response).toEqual(mockResponse);
      done();
    });

    const req = httpMock.expectOne('http://localhost:3000/mcp');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.method).toBe('initialize');
    req.flush(mockResponse);
  });

  it('should ping the server', (done) => {
    const mockInitResponse = {
      jsonrpc: '2.0',
      id: 1,
      result: { sessionId: 'test-session' },
    };

    const mockPingResponse = {
      jsonrpc: '2.0',
      id: 2,
      result: {
        structuredContent: {
          ok: true,
          now: '2024-01-01T00:00:00.000Z',
        },
      },
    };

    service.ping().subscribe((result) => {
      expect(result.ok).toBe(true);
      expect(result.now).toBe('2024-01-01T00:00:00.000Z');
      done();
    });

    // First request is initialize
    const initReq = httpMock.expectOne('http://localhost:3000/mcp');
    initReq.flush(mockInitResponse);

    // Second request is ping
    const pingReq = httpMock.expectOne('http://localhost:3000/mcp');
    expect(pingReq.request.body.method).toBe('tools/call');
    expect(pingReq.request.body.params.name).toBe('ping');
    pingReq.flush(mockPingResponse);
  });

  it('should scan for devices', (done) => {
    const mockInitResponse = {
      jsonrpc: '2.0',
      id: 1,
      result: { sessionId: 'test-session' },
    };

    const mockScanResponse = {
      jsonrpc: '2.0',
      id: 2,
      result: {
        structuredContent: {
          devices: [
            { id: 'device1', model: 'Model X', status: 'online' },
            { id: 'device2', model: 'Model Y', status: 'offline' },
          ],
        },
      },
    };

    service.scanDevices().subscribe((devices) => {
      expect(devices.length).toBe(2);
      expect(devices[0].id).toBe('device1');
      expect(devices[1].id).toBe('device2');
      done();
    });

    const initReq = httpMock.expectOne('http://localhost:3000/mcp');
    initReq.flush(mockInitResponse);

    const scanReq = httpMock.expectOne('http://localhost:3000/mcp');
    expect(scanReq.request.body.params.name).toBe('scanDevices');
    scanReq.flush(mockScanResponse);
  });

  it('should get device status', (done) => {
    const mockInitResponse = {
      jsonrpc: '2.0',
      id: 1,
      result: { sessionId: 'test-session' },
    };

    const mockStatusResponse = {
      jsonrpc: '2.0',
      id: 2,
      result: {
        structuredContent: {
          id: 'device1',
          state: 'idle',
          position: 100.5,
          velocity: 0,
          torque: 0,
        },
      },
    };

    service.getStatus('device1').subscribe((status) => {
      expect(status.id).toBe('device1');
      expect(status.state).toBe('idle');
      expect(status.position).toBe(100.5);
      done();
    });

    const initReq = httpMock.expectOne('http://localhost:3000/mcp');
    initReq.flush(mockInitResponse);

    const statusReq = httpMock.expectOne('http://localhost:3000/mcp');
    expect(statusReq.request.body.params.name).toBe('getStatus');
    expect(statusReq.request.body.params.arguments.id).toBe('device1');
    statusReq.flush(mockStatusResponse);
  });

  it('should move device to position', (done) => {
    const mockInitResponse = {
      jsonrpc: '2.0',
      id: 1,
      result: { sessionId: 'test-session' },
    };

    const mockMoveResponse = {
      jsonrpc: '2.0',
      id: 2,
      result: {
        structuredContent: {
          acknowledged: true,
          jobId: 'job-123',
        },
      },
    };

    const moveCommand = {
      position: 200,
      speed: 100,
      unit: 'mm' as const,
    };

    service.moveToPosition('device1', moveCommand).subscribe((result) => {
      expect(result.acknowledged).toBe(true);
      expect(result.jobId).toBe('job-123');
      done();
    });

    const initReq = httpMock.expectOne('http://localhost:3000/mcp');
    initReq.flush(mockInitResponse);

    const moveReq = httpMock.expectOne('http://localhost:3000/mcp');
    expect(moveReq.request.body.params.name).toBe('moveToPosition');
    expect(moveReq.request.body.params.arguments.command).toEqual(moveCommand);
    moveReq.flush(mockMoveResponse);
  });
});
