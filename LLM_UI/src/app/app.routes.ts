import { Routes } from '@angular/router';
import { LlmDemoComponentComponent } from './llm-demo-component/llm-demo-component.component';
import { McpServoControlComponent } from './mcp-servo-control/mcp-servo-control.component';

export const routes: Routes = [
  { path: '', redirectTo: '/mcp', pathMatch: 'full' },
  { path: 'llm', component: LlmDemoComponentComponent },
  { path: 'mcp', component: McpServoControlComponent },
];
