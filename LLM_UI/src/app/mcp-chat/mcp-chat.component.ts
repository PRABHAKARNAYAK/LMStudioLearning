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

interface DisplayMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  displayToolsUsed?: string[];
  isLoading?: boolean;
  error?: string;
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
              `✓ MCP Server connected. ${status.toolsAvailable} tools available.`
            );
            this.loadAvailableTools();
          } else {
            this.addSystemMessage(
              '✗ MCP Server not available. Make sure the Motion Master Client MCP server is running on http://localhost:8036'
            );
          }
        },
        error: (error: any) => {
          this.mcpServerAvailable = false;
          this.addSystemMessage(
            `Error connecting to MCP server: ${error.message}`
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
   * Send a message and get response from LLM with MCP tools
   */
  sendMessage(): void {
    if (!this.inputText.trim() || this.isLoading) {
      return;
    }

    if (!this.mcpServerAvailable) {
      this.addSystemMessage(
        'Error: MCP Server is not available. Please start the Motion Master Client MCP server.'
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

    this.isLoading = true;
    this.shouldScroll = true;

    // Add loading message
    const loadingMessageId = this.messages.length;
    this.addMessage({
      role: 'assistant',
      content: 'Processing your request...',
      timestamp: new Date(),
      isLoading: true,
    });

    this.mcpLlmService
      .chatWithMcpTools(userMessage)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ChatResponse) => {
          // Remove loading message
          this.messages = this.messages.filter(
            (_, index) => index !== loadingMessageId
          );

          if (response.success) {
            // Add assistant message
            this.addMessage({
              role: 'assistant',
              content: response.answer,
              timestamp: new Date(),
              displayToolsUsed: response.toolsUsed,
            });

            // Add to service history
            this.mcpLlmService.addMessageToHistory({
              role: 'user',
              content: userMessage,
            });
            this.mcpLlmService.addMessageToHistory({
              role: 'assistant',
              content: response.answer,
              toolsUsed: response.toolsUsed,
            });

            // Log debug info
            if (response.debug) {
              console.log('Debug Info:', response.debug);
            }
          } else {
            this.addMessage({
              role: 'assistant',
              content: `Error: ${response.error || 'Unknown error occurred'}`,
              timestamp: new Date(),
              error: response.error,
            });
          }

          this.isLoading = false;
          this.shouldScroll = true;
        },
        error: (error: any) => {
          // Remove loading message
          this.messages = this.messages.filter(
            (_, index) => index !== loadingMessageId
          );

          this.addMessage({
            role: 'assistant',
            content: `Error: ${error.message}`,
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
