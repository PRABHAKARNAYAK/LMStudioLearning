import winston from "winston";
import "winston-daily-rotate-file";

interface LoggerConfiguration {
  consoleLogLevel: string;
  logFilePath: string;
  datePattern: string;
  zippedArchive: boolean;
  maxSize: string;
  maxFiles: string;
  utc: boolean;
}

export class LexiumLogger {
  private static logger: winston.Logger | null = null;
  private static readonly WORKSPACE_PATH = process.env.WorkspacePath;
  private static readonly SERVICE_NAME = "SE.IA.Lexium38i.MotionMasterClient";
  private static readonly MSG_LEVEL_SLICE = 5;

  static init(): void {
    const config = LexiumLogger.getConfiguration();
    const transports: winston.transport[] = [LexiumLogger.createConsoleTransport(config), LexiumLogger.createFileTransport(config)];

    LexiumLogger.logger = winston.createLogger({ transports });
  }

  static error(message: string, meta?: unknown): void {
    LexiumLogger.ensureLogger().error(message, meta);
  }

  static warn(message: string, meta?: unknown): void {
    LexiumLogger.ensureLogger().warn(message, meta);
  }

  static info(message: string, meta?: unknown): void {
    LexiumLogger.ensureLogger().info(message, meta);
  }

  static verbose(message: string, meta?: unknown): void {
    LexiumLogger.ensureLogger().verbose(message, meta);
  }

  static silly(message: string, meta?: unknown): void {
    LexiumLogger.ensureLogger().silly(message, meta);
  }

  private static ensureLogger(): winston.Logger {
    if (!LexiumLogger.logger) {
      LexiumLogger.init();
    }
    if (!LexiumLogger.logger) {
      throw new Error("Failed to initialize logger");
    }
    return LexiumLogger.logger;
  }

  private static getConfiguration(): LoggerConfiguration {
    let baseLogPath: string;
    if (LexiumLogger.WORKSPACE_PATH) {
      baseLogPath = `${LexiumLogger.WORKSPACE_PATH}/Logs/${LexiumLogger.SERVICE_NAME}`;
    } else {
      baseLogPath = "Logs";
    }

    return {
      consoleLogLevel: "info",
      logFilePath: `${baseLogPath}/${LexiumLogger.SERVICE_NAME}_%DATE%.log`,
      datePattern: "YYYY-MM-DD-HH",
      zippedArchive: false,
      maxSize: "15m",
      maxFiles: "14d",
      utc: true,
    };
  }

  private static createConsoleTransport(config: LoggerConfiguration): winston.transport {
    return new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf((msg: winston.Logform.TransformableInfo) => {
          const level = msg.level.toLowerCase();
          return `${msg.timestamp} - [${level}]: ${LexiumLogger.SERVICE_NAME}: ${msg.message}`;
        })
      ),
      level: config.consoleLogLevel,
    });
  }

  private static createFileTransport(config: LoggerConfiguration): winston.transport {
    return new winston.transports.DailyRotateFile({
      filename: config.logFilePath,
      datePattern: config.datePattern,
      zippedArchive: config.zippedArchive,
      maxSize: config.maxSize,
      maxFiles: config.maxFiles,
      utc: config.utc,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf((msg: winston.Logform.TransformableInfo) => {
          const level = msg.level.normalize().trim().slice(LexiumLogger.MSG_LEVEL_SLICE, -LexiumLogger.MSG_LEVEL_SLICE);
          return `${msg.timestamp} - ${level}: ${LexiumLogger.SERVICE_NAME}: ${msg.message}`;
        })
      ),
      level: config.consoleLogLevel,
    });
  }
}
