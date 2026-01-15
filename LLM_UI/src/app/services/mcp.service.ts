import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import {
  ServoDevice,
  MoveCommand,
  JogCommand,
  Trajectory,
  ParamKV,
  Status,
  Diagnostics,
  PingResult,
  MCPResponse,
  MCPInitializeRequest,
  MCPCallToolRequest,
  MCPListToolsRequest,
} from '../models/mcp.models';

@Injectable({
  providedIn: 'root',
})
export class McpService {
  private readonly mcpUrl = 'http://localhost:3000/mcp';
  private sessionId: string | null = null;
  private requestId = 0;

  constructor(private readonly http: HttpClient) {
    console.log('[MCP] McpService instantiated');
  }

  /**
   * Initialize MCP session
   */
  initialize(): Observable<any> {
    const request: MCPInitializeRequest = {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'angular-mcp-client',
          version: '1.0.0',
        },
      },
      id: ++this.requestId,
    };

    // Log headers before making the HTTP call
    const headersObj = this.getHeaders()
      .keys()
      .reduce((acc, key) => {
        acc[key] = this.getHeaders().get(key);
        return acc;
      }, {} as Record<string, string | null>);
    console.log('[MCP] HTTP headers (initialize):', headersObj);
    return this.http
      .post<any>(this.mcpUrl, request, {
        headers: this.getHeaders(),
        observe: 'response',
      })
      .pipe(
        map((response) => {
          // Extract session ID from response headers (case-insensitive)
          const sessionId =
            response.headers.get('mcp-session-id') ||
            response.headers.get('Mcp-Session-Id');
          if (sessionId) {
            this.sessionId = sessionId;
            console.log('[MCP] Session ID set from header:', sessionId);
          } else {
            console.warn('[MCP] No session ID found in response headers');
          }
          return response.body;
        }),
        catchError((error) => {
          console.error('MCP initialization failed:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * List available tools
   */
  listTools(): Observable<any> {
    return this.ensureSession().pipe(
      switchMap(() => {
        const request: MCPListToolsRequest = {
          jsonrpc: '2.0',
          method: 'tools/list',
          params: {},
          id: ++this.requestId,
        };

        return this.http.post<any>(this.mcpUrl, request, {
          headers: this.getHeaders(),
        });
      })
    );
  }

  /**
   * Call a tool on the MCP server
   */
  private callTool<T>(
    toolName: string,
    args?: any
  ): Observable<MCPResponse<T>> {
    return this.ensureSession().pipe(
      switchMap(() => {
        const request: MCPCallToolRequest = {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args || {},
          },
          id: ++this.requestId,
        };

        return this.http
          .post<any>(this.mcpUrl, request, {
            headers: this.getHeaders(),
          })
          .pipe(
            map((response) => {
              if (response.error) {
                throw new Error(response.error.message || 'Tool call failed');
              }
              return response.result as MCPResponse<T>;
            })
          );
      })
    );
  }

  /**
   * Ping the server
   */
  ping(): Observable<PingResult> {
    return this.callTool<PingResult>('ping').pipe(
      map((response) => response.structuredContent!)
    );
  }

  /**
   * Scan for servo devices
   */
  scanDevices(): Observable<ServoDevice[]> {
    return this.callTool<{ devices: ServoDevice[] }>('scanDevices').pipe(
      map((response) => response.structuredContent?.devices || [])
    );
  }

  /**
   * Get status for a servo device
   */
  getStatus(deviceId: string): Observable<Status> {
    return this.callTool<Status>('getStatus', { id: deviceId }).pipe(
      map((response) => response.structuredContent!)
    );
  }

  /**
   * Home a servo device
   */
  home(deviceId: string): Observable<{ result: string }> {
    return this.callTool<{ result: string }>('home', { id: deviceId }).pipe(
      map((response) => response.structuredContent!)
    );
  }

  /**
   * Move servo to position
   */
  moveToPosition(
    deviceId: string,
    command: MoveCommand
  ): Observable<{ acknowledged: boolean; jobId?: string }> {
    return this.callTool<{ acknowledged: boolean; jobId?: string }>(
      'moveToPosition',
      {
        id: deviceId,
        command,
      }
    ).pipe(map((response) => response.structuredContent!));
  }

  /**
   * Jog a servo
   */
  jog(
    deviceId: string,
    command: JogCommand
  ): Observable<{ acknowledged: boolean }> {
    return this.callTool<{ acknowledged: boolean }>('jog', {
      id: deviceId,
      command,
    }).pipe(map((response) => response.structuredContent!));
  }

  /**
   * Stop servo motion
   */
  stop(
    deviceId: string,
    immediate: boolean = false
  ): Observable<{ acknowledged: boolean }> {
    return this.callTool<{ acknowledged: boolean }>('stop', {
      id: deviceId,
      immediate,
    }).pipe(map((response) => response.structuredContent!));
  }

  /**
   * Set a parameter on a servo
   */
  setParam(
    deviceId: string,
    param: ParamKV
  ): Observable<{ acknowledged: boolean }> {
    return this.callTool<{ acknowledged: boolean }>('setParam', {
      id: deviceId,
      param,
    }).pipe(map((response) => response.structuredContent!));
  }

  /**
   * Get diagnostics for a servo
   */
  getDiagnostics(deviceId: string): Observable<Diagnostics> {
    return this.callTool<Diagnostics>('getDiagnostics', { id: deviceId }).pipe(
      map((response) => response.structuredContent!)
    );
  }

  /**
   * Execute a trajectory
   */
  executeTrajectory(
    deviceId: string,
    trajectory: Trajectory
  ): Observable<{ acknowledged: boolean; jobId?: string }> {
    return this.callTool<{ acknowledged: boolean; jobId?: string }>(
      'executeTrajectory',
      {
        id: deviceId,
        traj: trajectory,
      }
    ).pipe(map((response) => response.structuredContent!));
  }

  /**
   * Close the MCP session
   */
  closeSession(): Observable<any> {
    if (!this.sessionId) {
      return from([null]);
    }

    return this.http
      .delete(this.mcpUrl, {
        headers: this.getHeaders(),
      })
      .pipe(
        map(() => {
          this.sessionId = null;
          return null;
        })
      );
  }

  /**
   * Ensure session is initialized
   */
  private ensureSession(): Observable<any> {
    if (this.sessionId) {
      return from([this.sessionId]);
    }
    return this.initialize();
  }

  /**
   * Get HTTP headers with session ID
   */
  private getHeaders(): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    });

    // Debug: log headers as object
    console.log(
      '[MCP] HTTP headers:',
      headers.keys().reduce((acc, key) => {
        acc[key] = headers.get(key);
        return acc;
      }, {} as Record<string, string | null>)
    );

    if (this.sessionId) {
      headers = headers.set('mcp-session-id', this.sessionId);
    }

    return headers;
  }
}
