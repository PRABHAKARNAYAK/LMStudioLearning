import { ChildProcess } from "child_process";
import { spawn } from "node:child_process";
import path from "node:path";
import { dirname } from "path";
import { first, timeout } from "rxjs";
import { MotionMasterClientFunctions } from "../controllers/MotionMasterClientFunctions";
import { ServerStatus } from "@LXM38I/se.ia.lexium38i.common.model";
import { Constants } from "../utility/constants";
import { SocketBroadcaster } from "../webSockets/SocketBroadcaster";
import { LexiumLogger } from "./LexiumLogger";

class MotionMasterProcess {
  static readonly stdout: string[] = [];

  private static _motionMasterProcessInstance: MotionMasterProcess;

  private macAddress: string;

  motionMasterServerPath: string = path.join(__dirname, "./assets/motion-master-server/motion_master.exe");

  process?: ChildProcess;
  isLocked = false;

  motionMasterClientFunctionsInstance: MotionMasterClientFunctions = MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance();

  private constructor() {
    // Private to prevent direct instantiation
  }

  public static getInstance(): MotionMasterProcess {
    if (!MotionMasterProcess._motionMasterProcessInstance) {
      MotionMasterProcess._motionMasterProcessInstance = new MotionMasterProcess();
    }

    return MotionMasterProcess._motionMasterProcessInstance;
  }

  public getAlreadyExecutingMasterProcessMacAddress(): string {
    return this.macAddress;
  }

  async start(macAddress: string) {
    // Validate MAC address to prevent command injection
    // MAC addresses written as six pairs of hexadecimal digits (0-9, A-F, a-f),
    // separated by either colons (:) or hyphens (-). For example, both 01:23:45:67:89:AB and
    // 01-23-45-67-89-AB would be considered valid. The regex checks for exactly five pairs followed by a separator,
    // and then a final pair without a separator, ensuring the address is the correct length and format.
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(macAddress)) {
      SocketBroadcaster.broadcast(Constants.EtherCatDiscoveryStatus, JSON.stringify({ status: ServerStatus.Error }));
      throw new Error("Invalid MAC address format");
    }

    try {
      this.macAddress = macAddress;
      if (this.process?.exitCode != null) {
        this.motionMasterClientFunctionsInstance.running$.next(true);
        LexiumLogger.info("Is running: " + this.motionMasterClientFunctionsInstance.running$.getValue());
        return true;
      }

      LexiumLogger.info("Starting Motion Master process with MAC address: " + macAddress);
      return new Promise((resolve) => {
        this.appendStdoutChunk(`spawning ${this.motionMasterServerPath} using MAC address ${this.macAddress}\n`);

        const cwd = dirname(this.motionMasterServerPath);
        this.process = spawn(this.motionMasterServerPath, ["--driver=soem", `--mac=${this.macAddress}`], { cwd });

        if (!this.process) {
          LexiumLogger.error("Starting the Motion Master process failed!");
          throw new Error("Starting the Motion Master process failed!");
        }

        this.process.on("spawn", () => {
          const message = `spawned\n`;
          this.appendStdoutChunk(message);

          setTimeout(() => {
            // Motion Master will exit immeditally if it cannot communicate with the provided network interface.
            // Wait for a moment before declaring it as running.
            if (this.process?.exitCode === null) {
              this.motionMasterClientFunctionsInstance.running$.next(true);
              resolve(true);
            }
          }, 1000);
        });

        this.process.stdout?.on("data", (chunk) => {
          const message = chunk.toString();
          this.motionMasterClientFunctionsInstance.stdout$.next(message);
          this.appendStdoutChunk(message);
          LexiumLogger.info("stdOut data:", message);
        });

        this.process.stderr?.on("data", (chunk) => {
          const message = chunk.toString();
          this.motionMasterClientFunctionsInstance.stdout$.next(message);
          this.appendStdoutChunk(message);
          LexiumLogger.error("stdError: ", message);
        });

        this.process.once("close", (code) => {
          const message = `exited with code ${code}\n`;
          this.appendStdoutChunk(message);
          this.motionMasterClientFunctionsInstance.stdout$.next(message);
          LexiumLogger.info("process closed", message);
          this.motionMasterClientFunctionsInstance.running$.next(false);
          resolve(false);
        });

        this.process.once("error", (err) => {
          // Log detailed error internally
          LexiumLogger.error(`errored with message ${err.message}\n`);
          const message = `Motion Master process encountered an error.\n`;
          this.appendStdoutChunk(message);
          this.motionMasterClientFunctionsInstance.stdout$.next(message);
          this.motionMasterClientFunctionsInstance.running$.next(false);
          resolve(false);
        });
      });
    } catch (error) {
      LexiumLogger.error("Error starting Motion Master process:", error);
      this.motionMasterClientFunctionsInstance.running$.next(false);
      return false;
    }
  }

  async stop(): Promise<boolean> {
    if (!this.process || this.process.killed) {
      return true;
    }

    return new Promise((resolve) => {
      this.motionMasterClientFunctionsInstance.running$
        .pipe(
          first((running) => running === false),
          timeout(5000)
        )
        .subscribe({
          complete: () => {
            LexiumLogger.info("Motion Master process stopped successfully.");
            resolve(true);
          },
          error: () => {
            LexiumLogger.error("Motion Master process failed to stop.");
            resolve(false);
          },
        });
      LexiumLogger.info("Stopping Motion Master process...");
      this.process?.kill("SIGTERM");
    });
  }

  appendStdoutChunk(chunk: string) {
    if (MotionMasterProcess.stdout.length > 32000) {
      MotionMasterProcess.stdout.splice(2000);
    }
    MotionMasterProcess.stdout.push(chunk);
    LexiumLogger.info(chunk);
  }
}
export { MotionMasterProcess };
