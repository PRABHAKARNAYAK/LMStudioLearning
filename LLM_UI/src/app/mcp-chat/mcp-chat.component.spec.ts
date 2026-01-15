import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { McpChatComponent } from './mcp-chat.component';
import { McpLlmService } from '../../services/mcp-llm.service';

describe('McpChatComponent', () => {
  let component: McpChatComponent;
  let fixture: ComponentFixture<McpChatComponent>;
  let mockMcpLlmService: jasmine.SpyObj<McpLlmService>;

  beforeEach(async () => {
    mockMcpLlmService = jasmine.createSpyObj('McpLlmService', [
      'getMcpStatus',
      'listMcpTools',
      'chatWithMcpTools',
      'executeTool',
      'addMessageToHistory',
      'clearHistory',
      'getHistory',
    ]);

    await TestBed.configureTestingModule({
      imports: [McpChatComponent, FormsModule],
      providers: [{ provide: McpLlmService, useValue: mockMcpLlmService }],
    }).compileComponents();

    fixture = TestBed.createComponent(McpChatComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
