import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { McpServoControlComponent } from './mcp-servo-control.component';

describe('McpServoControlComponent', () => {
  let component: McpServoControlComponent;
  let fixture: ComponentFixture<McpServoControlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [McpServoControlComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(McpServoControlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default values', () => {
    expect(component.devices).toEqual([]);
    expect(component.selectedDevice).toBeNull();
    expect(component.status).toBeNull();
    expect(component.diagnostics).toBeNull();
    expect(component.loading).toBe(false);
  });

  it('should have default move command', () => {
    expect(component.moveCommand).toEqual({
      position: 0,
      speed: 100,
      unit: 'mm',
    });
  });

  it('should have default jog command', () => {
    expect(component.jogCommand).toEqual({
      direction: 'positive',
      speed: 50,
      durationMs: 1000,
    });
  });

  it('should have initial trajectory points', () => {
    expect(component.trajectoryPoints.length).toBe(2);
    expect(component.trajectoryPoints[0]).toEqual({
      timeMs: 0,
      position: 0,
      speed: 100,
    });
  });

  it('should add trajectory point', () => {
    const initialLength = component.trajectoryPoints.length;
    component.addTrajectoryPoint();
    expect(component.trajectoryPoints.length).toBe(initialLength + 1);
  });

  it('should remove trajectory point', () => {
    component.trajectoryPoints = [
      { timeMs: 0, position: 0, speed: 100 },
      { timeMs: 1000, position: 100, speed: 100 },
      { timeMs: 2000, position: 200, speed: 100 },
    ];
    component.removeTrajectoryPoint(1);
    expect(component.trajectoryPoints.length).toBe(2);
    expect(component.trajectoryPoints[1].timeMs).toBe(2000);
  });

  it('should not remove last trajectory point', () => {
    component.trajectoryPoints = [{ timeMs: 0, position: 0, speed: 100 }];
    component.removeTrajectoryPoint(0);
    expect(component.trajectoryPoints.length).toBe(1);
  });

  it('should clear messages', () => {
    component.error = 'Test error';
    component.successMessage = 'Test success';
    component.clearMessages();
    expect(component.error).toBeNull();
    expect(component.successMessage).toBeNull();
  });
});
