import { Routes } from '@angular/router';
import { LlmDemoComponentComponent } from './llm-demo-component/llm-demo-component.component';
import { McpServoControlComponent } from './mcp-servo-control/mcp-servo-control.component';
import { McpChatComponent } from './mcp-chat/mcp-chat.component';

export const routes: Routes = [
  { path: '', redirectTo: '/mcp-chat', pathMatch: 'full' },
  { path: 'llm', component: LlmDemoComponentComponent },
  { path: 'mcp', component: McpServoControlComponent },
  { path: 'mcp-chat', component: McpChatComponent },
];
