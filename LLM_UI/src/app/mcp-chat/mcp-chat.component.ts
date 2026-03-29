import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { McpLlmService, ChatResponse, Tool } from '../services';

interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  value?: any;
}

interface ToolSuggestion {
  toolName: string;
  toolDescription: string;
  missingParameters: ToolParameter[];
  providedParameters: Record<string, any>;
}

interface ToolContext {
  toolName: string;
  toolDescription: string;
  providedParameters: Record<string, any>;
  missingParameters: ToolParameter[];
  awaitingInput: boolean;
}

interface DisplayMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  displayToolsUsed?: string[];
  isLoading?: boolean;
  error?: string;
  toolSuggestion?: ToolSuggestion;
  isEditing?: boolean;
}

@Component({
  selector: 'app-mcp-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mcp-chat.component.html',
  styleUrls: ['./mcp-chat.component.scss'],
  providers: [McpLlmService],
})
export class McpChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer')
  private readonly messagesContainer!: ElementRef;

  messages: DisplayMessage[] = [];
  inputText: string = '';
  isLoading: boolean = false;
  availableTools: Tool[] = [];
  mcpServerAvailable: boolean = false;
  toolsAvailable: number = 0;

  private readonly destroy$ = new Subject<void>();
  private shouldScroll: boolean = false;

  constructor(private readonly mcpLlmService: McpLlmService) {}

  ngOnInit(): void {
    this.loadMcpStatus();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load MCP status and available tools
   */
  loadMcpStatus(): void {
    this.mcpLlmService
      .getMcpStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status: any) => {
          this.mcpServerAvailable = status.mcpServerAvailable;
          this.toolsAvailable = status.toolsAvailable;

          if (this.mcpServerAvailable) {
            this.addSystemMessage(
              `✓ Server connected. ${status.toolsAvailable} control commands available.`,
            );
            this.loadAvailableTools();
          } else {
            this.addSystemMessage(
              '✗ MCP Server not available. Make sure the Motion Master Client MCP server is running on http://localhost:8036',
            );
          }
        },
        error: (error: any) => {
          this.mcpServerAvailable = false;
          this.addSystemMessage(
            `Error connecting to MCP server: ${error.message}`,
          );
        },
      });
  }

  /**
   * Load available tools
   */
  loadAvailableTools(): void {
    this.mcpLlmService
      .listMcpTools()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.availableTools = response.tools;
        },
        error: (error: any) => {
          console.error('Error loading tools:', error);
        },
      });
  }

  /**
   * Send a message and analyze for tool execution
   */
  sendMessage(): void {
    if (!this.inputText.trim() || this.isLoading) {
      return;
    }

    if (!this.mcpServerAvailable) {
      this.addSystemMessage(
        'Error: MCP Server is not available. Please start the Motion Master Client MCP server.',
      );
      return;
    }

    const userMessage = this.inputText.trim();
    this.inputText = '';

    // Add user message to display
    this.addMessage({
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    // Analyze the question for tool identification
    this.isLoading = true;
    this.shouldScroll = true;

    // Add loading message
    const loadingMessageId = this.messages.length;
    this.addMessage({
      role: 'assistant',
      content: 'Analyzing your request...',
      timestamp: new Date(),
      isLoading: true,
    });

    this.mcpLlmService
      .analyzeQuestion(userMessage)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          // Remove loading message
          this.messages = this.messages.filter(
            (_, index) => index !== loadingMessageId,
          );

          if (response.success && response.toolSuggestion) {
            const toolSuggestion = response.toolSuggestion;

            // Show the tool suggestion with editable parameters form
            this.addMessage({
              role: 'assistant',
              content: `Found tool: **${toolSuggestion.toolName}**\n\n${toolSuggestion.toolDescription}`,
              timestamp: new Date(),
              toolSuggestion: toolSuggestion,
              isEditing: true,
            });
          } else {
            this.addMessage({
              role: 'assistant',
              content:
                response.message ||
                'Could not identify a tool for your request. Please try rephrasing.',
              timestamp: new Date(),
            });
          }

          this.isLoading = false;
          this.shouldScroll = true;
        },
        error: (error: any) => {
          // Remove loading message
          this.messages = this.messages.filter(
            (_, index) => index !== loadingMessageId,
          );

          this.addMessage({
            role: 'assistant',
            content: `Error analyzing request: ${error.message}`,
            timestamp: new Date(),
            error: error.message,
          });

          this.isLoading = false;
          this.shouldScroll = true;
        },
      });
  }

  /**
   * Submit edited tool parameters
   */
  submitToolParameters(messageIndex: number): void {
    const message = this.messages[messageIndex];
    if (message?.toolSuggestion) {
      // Mark as no longer editing
      message.isEditing = false;
      this.shouldScroll = true;

      // Execute the tool with the edited parameters
      this.executeTool(message.toolSuggestion);
    }
  }

  /**
   * Cancel editing tool parameters
   */
  cancelEditToolParameters(messageIndex: number): void {
    const message = this.messages[messageIndex];
    if (message) {
      message.isEditing = false;
      this.shouldScroll = true;
    }
  }

  /**
   * Get provided parameters as a string
   */
  getProvidedParamsString(toolSuggestion: ToolSuggestion): string {
    if (
      !toolSuggestion.providedParameters ||
      Object.keys(toolSuggestion.providedParameters).length === 0
    ) {
      return 'None';
    }
    return Object.entries(toolSuggestion.providedParameters)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(', ');
  }

  /**
   * Get missing parameters as a string
   */
  getMissingParamsString(toolSuggestion: ToolSuggestion): string {
    if (
      !toolSuggestion.missingParameters ||
      toolSuggestion.missingParameters.length === 0
    ) {
      return 'None';
    }
    return toolSuggestion.missingParameters
      .map((p) => `${p.name} (${p.type})`)
      .join(', ');
  }

  /**
   * Check if any required parameter is missing
   */
  isAnyRequiredParameterMissing(toolSuggestion: ToolSuggestion): boolean {
    return (
      toolSuggestion.missingParameters &&
      toolSuggestion.missingParameters.length > 0
    );
  }

  /**
   * Check if tool is ready to execute (all required parameters are provided)
   */
  isToolReadyToExecute(toolSuggestion: ToolSuggestion): boolean {
    if (!toolSuggestion.missingParameters) {
      return true;
    }
    return toolSuggestion.missingParameters.every(
      (p) => p.value !== undefined && p.value !== null && p.value !== '',
    );
  }

  /**
   * Update parameter value
   */
  updateParameterValue(
    toolSuggestion: ToolSuggestion,
    paramName: string,
    value: any,
  ): void {
    const param = toolSuggestion.missingParameters.find(
      (p) => p.name === paramName,
    );
    if (param) {
      param.value = this.parseValue(value, param.type);
    }
  }

  /**
   * Parse value based on parameter type
   */
  private parseValue(value: string, type: string): any {
    const trimmed = value.trim();

    if (type === 'number' || type === 'integer') {
      const num = Number(trimmed);
      return isNaN(num) ? trimmed : num;
    } else if (type === 'boolean') {
      return (
        trimmed.toLowerCase() === 'true' ||
        trimmed.toLowerCase() === 'yes' ||
        trimmed === '1'
      );
    }

    return trimmed;
  }

  /**
   * Format tool execution response for display
   */
  formatToolResponse(toolName: string, result: any): string {
    if (typeof result === 'string') {
      return result;
    }

    // Handle common tool response patterns
    if (typeof result === 'object' && result !== null) {
      // Check if this is a device discovery response
      if (
        toolName.includes('discovery') ||
        toolName.includes('DeviceDiscovery')
      ) {
        return this.formatDiscoveryResponse(result);
      }

      // Check if it's a polling/progress response
      if (result.status === 'initiated' || result.status === 'in_progress') {
        return this.formatPollingResponse(result);
      }

      // Check if it's a result with status and data
      if (result.status === 'success' && result.data) {
        return this.formatSuccessResponse(result);
      }

      // Default: pretty-print JSON
      return JSON.stringify(result, null, 2);
    }

    return String(result);
  }

  /**
   * Format device discovery response
   */
  private formatDiscoveryResponse(result: any): string {
    const lines: string[] = [];
    lines.push('🔍 **Device Discovery Completed**');
    lines.push('');

    if (result.message) {
      lines.push(`📝 ${result.message}`);
    }

    if (result.macAddress) {
      lines.push(`🔗 MAC Address: \`${result.macAddress}\``);
    }

    if (result.status) {
      if (result.status === 'success') {
        lines.push(`✅ Status: SUCCESS`);
      } else if (result.status === 'timeout') {
        lines.push(`⏱️ Status: TIMEOUT (no devices found in time)`);
      } else {
        lines.push(`📊 Status: ${result.status.toUpperCase()}`);
      }
    }

    if (result.elapsedSeconds) {
      lines.push(`⏰ Duration: ${result.elapsedSeconds} seconds`);
    }

    // Display discovered devices
    if (
      result.devices &&
      Array.isArray(result.devices) &&
      result.devices.length > 0
    ) {
      lines.push('');
      lines.push(`📱 **Discovered Devices (${result.devices.length})**`);
      lines.push('');

      result.devices.forEach((device: any, index: number) => {
        lines.push(`**${index + 1}. ${device.name || 'Unknown Device'}**`);
        if (device.deviceAddress) {
          lines.push(`   Device Address: \`${device.deviceAddress}\``);
        }
        if (device.macAddress) {
          lines.push(`   MAC Address: \`${device.macAddress}\``);
        }
        if (device.serialNumber) {
          lines.push(`   Serial Number: \`${device.serialNumber}\``);
        }
        if (device.type) {
          lines.push(`   Type: ${device.type}`);
        }
        if (device.status) {
          lines.push(`   Status: ${device.status}`);
        }
        lines.push('');
      });
    } else if (result.devicesFound === 0) {
      lines.push('');
      lines.push('❌ No devices were discovered.');
    }

    if (result.pollCount) {
      lines.push(`_Polling completed after ${result.pollCount} attempts_`);
    }

    return lines.join('\n');
  }

  /**
   * Format polling/progress response
   */
  private formatPollingResponse(result: any): string {
    const lines: string[] = [];

    if (result.status === 'initiated') {
      lines.push('⏳ **Discovery Initiated**');
    } else if (result.status === 'in_progress') {
      lines.push('🔄 **Discovery In Progress**');
    }

    if (result.message) {
      lines.push(`${result.message}`);
    }

    if (result.devicesFound) {
      lines.push('');
      lines.push('**Devices Found:**');
      if (Array.isArray(result.devicesFound)) {
        result.devicesFound.forEach((device: any, index: number) => {
          lines.push(`${index + 1}. ${device.name || 'Device'}`);
          if (device.macAddress) {
            lines.push(`   MAC: \`${device.macAddress}\``);
          }
          if (device.ipAddress) {
            lines.push(`   IP: \`${device.ipAddress}\``);
          }
        });
      }
    }

    if (result.progress !== undefined) {
      lines.push('');
      lines.push(`**Progress:** ${result.progress}%`);
    }

    return lines.join('\n');
  }

  /**
   * Format success response
   */
  private formatSuccessResponse(result: any): string {
    const lines: string[] = [];
    lines.push('✅ **Success**');
    lines.push('');

    if (result.message) {
      lines.push(`${result.message}`);
    }

    if (result.data) {
      lines.push('');
      lines.push('**Data:**');
      if (Array.isArray(result.data)) {
        result.data.forEach((item: any) => {
          lines.push(`- ${JSON.stringify(item)}`);
        });
      } else {
        lines.push(JSON.stringify(result.data, null, 2));
      }
    }

    return lines.join('\n');
  }

  /**
   * Execute tool with provided parameters
   */
  executeTool(toolSuggestion: ToolSuggestion): void {
    this.isLoading = true;

    const toolParams: Record<string, any> = {
      ...toolSuggestion.providedParameters,
    };

    // Add all parameters (both provided and those edited in the form)
    if (toolSuggestion.missingParameters) {
      for (const param of toolSuggestion.missingParameters) {
        if (
          param.value !== undefined &&
          param.value !== null &&
          param.value !== ''
        ) {
          toolParams[param.name] = param.value;
        }
      }
    }

    this.addMessage({
      role: 'assistant',
      content: `Executing tool: ${toolSuggestion.toolName}...`,
      timestamp: new Date(),
      isLoading: true,
    });

    this.mcpLlmService
      .executeTool(toolSuggestion.toolName, toolParams)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          // Remove loading message
          this.messages = this.messages.filter((msg) => !msg.isLoading);

          if (response.success) {
            const formattedContent = this.formatToolResponse(
              toolSuggestion.toolName,
              response.result,
            );

            this.addMessage({
              role: 'assistant',
              content: formattedContent,
              timestamp: new Date(),
              displayToolsUsed: [toolSuggestion.toolName],
            });
          } else {
            this.addMessage({
              role: 'assistant',
              content: `Error executing tool: ${
                response.error || 'Unknown error'
              }`,
              timestamp: new Date(),
              error: response.error,
            });
          }

          this.isLoading = false;
          this.shouldScroll = true;
        },
        error: (error: any) => {
          // Remove loading message
          this.messages = this.messages.filter((msg) => !msg.isLoading);

          this.addMessage({
            role: 'assistant',
            content: `Error executing tool: ${error.message}`,
            timestamp: new Date(),
            error: error.message,
          });

          this.isLoading = false;
          this.shouldScroll = true;
        },
      });
  }

  /**
   * Add a message to the display
   */
  private addMessage(message: DisplayMessage): void {
    this.messages.push(message);
    this.shouldScroll = true;
  }

  /**
   * Add a system message
   */
  private addSystemMessage(content: string): void {
    this.addMessage({
      role: 'assistant',
      content,
      timestamp: new Date(),
    });
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.messages = [];
    this.mcpLlmService.clearHistory();
    this.addSystemMessage('Conversation history cleared.');
  }

  /**
   * Handle Enter key press
   */
  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  /**
   * Scroll to bottom of messages
   */
  private scrollToBottom(): void {
    try {
      this.messagesContainer.nativeElement.scrollTop =
        this.messagesContainer.nativeElement.scrollHeight;
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }

  /**
   * Get tool description by name
   */
  getToolDescription(toolName: string): string {
    const tool = this.availableTools.find((t) => t.function.name === toolName);
    return tool ? tool.function.description : '';
  }
}
