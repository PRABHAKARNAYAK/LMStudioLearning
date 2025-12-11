
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { LlmToolAnswer, LlmChatToolsRequest } from '../models/llm.models';

@Injectable({ providedIn: 'root' })
export class LlmService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.llmBase;

  chatWithTools(question: string, ms = 30000): Observable<LlmToolAnswer> {
    const url = `${this.base}/chat-tools`;
    const body: LlmChatToolsRequest = { question };
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    return this.http
      .post<LlmToolAnswer>(url, body, { headers })
      .pipe(
        timeout(ms),
        catchError((err: HttpErrorResponse) => {
          const msg = err.error?.error || err.message || 'LLM tool-calling failed.';
          return throwError(() => new Error(msg));
        })
      );
  }

  chat(question: string, context?: string, ms = 20000): Observable<{ answer: string }> {
    const url = `${this.base}/chat`;
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http
      .post<{ answer: string }>(url, { question, context }, { headers })
      .pipe(
        timeout(ms),
        catchError((err: HttpErrorResponse) => {
          const msg = err.error?.error || err.message || 'LLM chat failed.';
          return throwError(() => new Error(msg));
        })
      );
  }
}
