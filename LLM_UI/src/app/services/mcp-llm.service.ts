import { Injectable, inject } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
}

export interface ChatResponse {
  success: boolean;
  answer: string;
  toolsUsed?: string[];
  error?: string;
  debug?: {
    requestModel?: string;
    toolsAvailable?: number;
    toolsCalled?: number;
  };
}

export interface Tool {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export interface MCPStatus {
  mcpServerAvailable: boolean;
  baseUrl: string;
  toolsAvailable: number;
  tools: Array<{ name: string; description: string }>;
}

export interface ToolExecutionResult {
  success: boolean;
  tool: string;
  result?: any;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class McpLlmService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.llmBase;
  private conversationHistory: ChatMessage[] = [];

  /**
   * Chat with the LLM using MCP server tools
   */
  chatWithMcpTools(question: string, ms = 30000): Observable<ChatResponse> {
    const url = `http://localhost:3001/api/mcp/chat-with-mcp-tools`;
    const body = {
      question,
      conversationHistory: this.conversationHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    };
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    return this.http.post<ChatResponse>(url, body, { headers }).pipe(
      timeout(ms),
      catchError((err: HttpErrorResponse) => {
        const msg = err.error?.error || err.message || 'MCP chat failed.';
        return throwError(() => new Error(msg));
      })
    );
  }

  /**
   * Get list of available MCP tools
   */
  listMcpTools(
    ms = 10000
  ): Observable<{ success: boolean; toolCount: number; tools: Tool[] }> {
    const url = `http://localhost:3001/api/mcp/list-tools`;
    return this.http
      .get<{ success: boolean; toolCount: number; tools: Tool[] }>(url)
      .pipe(
        timeout(ms),
        catchError((err: HttpErrorResponse) => {
          const msg =
            err.error?.error || err.message || 'Failed to list tools.';
          return throwError(() => new Error(msg));
        })
      );
  }

  /**
   * Execute a tool directly
   */
  executeTool(
    toolName: string,
    args: Record<string, any>,
    ms = 30000
  ): Observable<ToolExecutionResult> {
    const url = `${this.base}/execute-tool`;
    const body = { toolName, args };
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    return this.http.post<ToolExecutionResult>(url, body, { headers }).pipe(
      timeout(ms),
      catchError((err: HttpErrorResponse) => {
        const msg = err.error?.error || err.message || 'Tool execution failed.';
        return throwError(() => new Error(msg));
      })
    );
  }

  /**
   * Get MCP server status
   */
  getMcpStatus(ms = 10000): Observable<MCPStatus> {
    const url = `http://localhost:3001/api/mcp/mcp-status`;
    return this.http.get<MCPStatus>(url).pipe(
      timeout(ms),
      catchError((err: HttpErrorResponse) => {
        const msg =
          err.error?.error || err.message || 'Failed to get MCP status.';
        return throwError(() => new Error(msg));
      })
    );
  }

  /**
   * Add message to conversation history
   */
  addMessageToHistory(message: ChatMessage): void {
    this.conversationHistory.push(message);
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Get conversation history
   */
  getHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }
}
