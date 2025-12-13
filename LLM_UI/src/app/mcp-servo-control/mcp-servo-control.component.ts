import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { McpService } from '../services/mcp.service';
import {
  ServoDevice,
  Status,
  Diagnostics,
  MoveCommand,
  JogCommand,
  TrajectoryPoint,
} from '../models/mcp.models';

@Component({
  selector: 'app-mcp-servo-control',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mcp-servo-control.component.html',
  styleUrls: ['./mcp-servo-control.component.scss'],
})
export class McpServoControlComponent implements OnInit, OnDestroy {
  devices: ServoDevice[] = [];
  selectedDevice: ServoDevice | null = null;
  status: Status | null = null;
  diagnostics: Diagnostics | null = null;
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;

  // Move command form
  moveCommand: MoveCommand = {
    position: 0,
    speed: 100,
    unit: 'mm',
  };

  // Jog command form
  jogCommand: JogCommand = {
    direction: 'positive',
    speed: 50,
    durationMs: 1000,
  };

  // Trajectory points
  trajectoryPoints: TrajectoryPoint[] = [
    { timeMs: 0, position: 0, speed: 100 },
    { timeMs: 1000, position: 100, speed: 100 },
  ];

  // Parameter form
  paramName = '';
  paramValue: string | number = '';

  // Auto-refresh
  private refreshInterval: any;
  autoRefresh = false;

  constructor(private mcpService: McpService) {}

  ngOnInit(): void {
    this.initialize();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
    this.mcpService.closeSession().subscribe();
  }

  /**
   * Initialize MCP connection and scan devices
   */
  initialize(): void {
    this.loading = true;
    this.error = null;

    this.mcpService.ping().subscribe({
      next: (result) => {
        console.log('MCP Server ping:', result);
        this.scanDevices();
      },
      error: (err) => {
        this.error = 'Failed to connect to MCP Server: ' + err.message;
        this.loading = false;
      },
    });
  }

  /**
   * Scan for available servo devices
   */
  scanDevices(): void {
    this.loading = true;
    this.error = null;

    this.mcpService.scanDevices().subscribe({
      next: (devices) => {
        this.devices = devices;
        this.loading = false;
        if (devices.length === 0) {
          this.error =
            'No devices found. Make sure servo devices are connected.';
        }
      },
      error: (err) => {
        this.error = 'Failed to scan devices: ' + err.message;
        this.loading = false;
      },
    });
  }

  /**
   * Select a device and load its status
   */
  selectDevice(device: ServoDevice): void {
    this.selectedDevice = device;
    this.loadStatus();
    this.loadDiagnostics();
  }

  /**
   * Load status for selected device
   */
  loadStatus(): void {
    if (!this.selectedDevice) return;

    this.mcpService.getStatus(this.selectedDevice.id).subscribe({
      next: (status) => {
        this.status = status;
        this.error = null;
      },
      error: (err) => {
        this.error = 'Failed to load status: ' + err.message;
      },
    });
  }

  /**
   * Load diagnostics for selected device
   */
  loadDiagnostics(): void {
    if (!this.selectedDevice) return;

    this.mcpService.getDiagnostics(this.selectedDevice.id).subscribe({
      next: (diagnostics) => {
        this.diagnostics = diagnostics;
      },
      error: (err) => {
        console.error('Failed to load diagnostics:', err);
      },
    });
  }

  /**
   * Home the selected device
   */
  homeDevice(): void {
    if (!this.selectedDevice) return;

    this.loading = true;
    this.mcpService.home(this.selectedDevice.id).subscribe({
      next: (result) => {
        this.successMessage = result.result;
        this.loading = false;
        setTimeout(() => this.loadStatus(), 500);
      },
      error: (err) => {
        this.error = 'Failed to home device: ' + err.message;
        this.loading = false;
      },
    });
  }

  /**
   * Move device to position
   */
  moveToPosition(): void {
    if (!this.selectedDevice) return;

    this.loading = true;
    this.mcpService
      .moveToPosition(this.selectedDevice.id, this.moveCommand)
      .subscribe({
        next: (result) => {
          this.successMessage = `Move acknowledged${
            result.jobId ? ' (Job: ' + result.jobId + ')' : ''
          }`;
          this.loading = false;
          setTimeout(() => this.loadStatus(), 500);
        },
        error: (err) => {
          this.error = 'Failed to move: ' + err.message;
          this.loading = false;
        },
      });
  }

  /**
   * Jog the device
   */
  jogDevice(): void {
    if (!this.selectedDevice) return;

    this.loading = true;
    this.mcpService.jog(this.selectedDevice.id, this.jogCommand).subscribe({
      next: (result) => {
        this.successMessage = 'Jog command sent';
        this.loading = false;
        setTimeout(() => this.loadStatus(), 500);
      },
      error: (err) => {
        this.error = 'Failed to jog: ' + err.message;
        this.loading = false;
      },
    });
  }

  /**
   * Stop device motion
   */
  stopDevice(immediate: boolean = false): void {
    if (!this.selectedDevice) return;

    this.loading = true;
    this.mcpService.stop(this.selectedDevice.id, immediate).subscribe({
      next: (result) => {
        this.successMessage = immediate
          ? 'Emergency stop executed'
          : 'Controlled stop executed';
        this.loading = false;
        setTimeout(() => this.loadStatus(), 500);
      },
      error: (err) => {
        this.error = 'Failed to stop: ' + err.message;
        this.loading = false;
      },
    });
  }

  /**
   * Set a parameter
   */
  setParameter(): void {
    if (!this.selectedDevice || !this.paramName) return;

    this.loading = true;
    this.mcpService
      .setParam(this.selectedDevice.id, {
        name: this.paramName,
        value: this.paramValue,
      })
      .subscribe({
        next: (result) => {
          this.successMessage = 'Parameter set successfully';
          this.loading = false;
          this.paramName = '';
          this.paramValue = '';
        },
        error: (err) => {
          this.error = 'Failed to set parameter: ' + err.message;
          this.loading = false;
        },
      });
  }

  /**
   * Add trajectory point
   */
  addTrajectoryPoint(): void {
    const lastPoint = this.trajectoryPoints[this.trajectoryPoints.length - 1];
    this.trajectoryPoints.push({
      timeMs: lastPoint.timeMs + 1000,
      position: lastPoint.position + 10,
      speed: 100,
    });
  }

  /**
   * Remove trajectory point
   */
  removeTrajectoryPoint(index: number): void {
    if (this.trajectoryPoints.length > 1) {
      this.trajectoryPoints.splice(index, 1);
    }
  }

  /**
   * Execute trajectory
   */
  executeTrajectory(): void {
    if (!this.selectedDevice || this.trajectoryPoints.length === 0) return;

    this.loading = true;
    this.mcpService
      .executeTrajectory(this.selectedDevice.id, {
        points: this.trajectoryPoints,
        loop: false,
      })
      .subscribe({
        next: (result) => {
          this.successMessage = `Trajectory started${
            result.jobId ? ' (Job: ' + result.jobId + ')' : ''
          }`;
          this.loading = false;
          setTimeout(() => this.loadStatus(), 500);
        },
        error: (err) => {
          this.error = 'Failed to execute trajectory: ' + err.message;
          this.loading = false;
        },
      });
  }

  /**
   * Toggle auto-refresh
   */
  toggleAutoRefresh(): void {
    this.autoRefresh = !this.autoRefresh;
    if (this.autoRefresh) {
      this.refreshInterval = setInterval(() => {
        if (this.selectedDevice) {
          this.loadStatus();
        }
      }, 2000);
    } else {
      this.stopAutoRefresh();
    }
  }

  /**
   * Stop auto-refresh
   */
  private stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Clear messages
   */
  clearMessages(): void {
    this.error = null;
    this.successMessage = null;
  }
}
