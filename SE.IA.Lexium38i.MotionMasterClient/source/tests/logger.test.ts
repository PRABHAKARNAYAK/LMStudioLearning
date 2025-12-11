import { LexiumLogger } from "../services/LexiumLogger";

describe("LexiumLogger", () => {
  beforeEach(() => {
    // Reset the logger instance before each test
    (LexiumLogger as any).logger = null;
  });

  describe("Static Methods", () => {
    it("should have all required static methods", () => {
      expect(typeof LexiumLogger.init).toBe("function");
      expect(typeof LexiumLogger.info).toBe("function");
      expect(typeof LexiumLogger.error).toBe("function");
      expect(typeof LexiumLogger.warn).toBe("function");
      expect(typeof LexiumLogger.verbose).toBe("function");
      expect(typeof LexiumLogger.silly).toBe("function");
    });
  });

  describe("init", () => {
    it("should initialize the logger without error", () => {
      expect(() => LexiumLogger.init()).not.toThrow();
    });

    it("should create a logger instance", () => {
      LexiumLogger.init();
      const logger = (LexiumLogger as any).logger;
      expect(logger).toBeDefined();
      expect(logger).not.toBeNull();
    });
  });

  describe("Logging Methods", () => {
    beforeEach(() => {
      LexiumLogger.init();
    });

    it("should log info messages without error", () => {
      expect(() => LexiumLogger.info("test info message")).not.toThrow();
    });

    it("should log error messages without error", () => {
      expect(() => LexiumLogger.error("test error message")).not.toThrow();
    });

    it("should log warn messages without error", () => {
      expect(() => LexiumLogger.warn("test warn message")).not.toThrow();
    });

    it("should log verbose messages without error", () => {
      expect(() => LexiumLogger.verbose("test verbose message")).not.toThrow();
    });

    it("should log silly messages without error", () => {
      expect(() => LexiumLogger.silly("test silly message")).not.toThrow();
    });

    it("should log messages with metadata", () => {
      const metadata = { userId: 123, action: "test" };
      expect(() => LexiumLogger.info("test with metadata", metadata)).not.toThrow();
      expect(() => LexiumLogger.error("error with metadata", metadata)).not.toThrow();
    });
  });

  describe("ensureLogger", () => {
    it("should auto-initialize logger when not initialized", () => {
      // Don't call init() explicitly
      expect(() => LexiumLogger.info("auto init test")).not.toThrow();
      const logger = (LexiumLogger as any).logger;
      expect(logger).toBeDefined();
      expect(logger).not.toBeNull();
    });

    it("should use existing logger if already initialized", () => {
      LexiumLogger.init();
      const firstLogger = (LexiumLogger as any).logger;

      LexiumLogger.info("test message");
      const secondLogger = (LexiumLogger as any).logger;

      expect(firstLogger).toBe(secondLogger);
    });
  });

  describe("Configuration", () => {
    it("should handle missing WorkspacePath environment variable", () => {
      const originalPath = process.env.WorkspacePath;
      delete process.env.WorkspacePath;

      expect(() => LexiumLogger.init()).not.toThrow();

      if (originalPath) {
        process.env.WorkspacePath = originalPath;
      }
    });

    it("should handle existing WorkspacePath environment variable", () => {
      const originalPath = process.env.WorkspacePath;
      process.env.WorkspacePath = "/test/workspace";

      expect(() => LexiumLogger.init()).not.toThrow();

      if (originalPath) {
        process.env.WorkspacePath = originalPath;
      } else {
        delete process.env.WorkspacePath;
      }
    });
  });

  describe("Multiple Logger Calls", () => {
    it("should handle multiple sequential log calls", () => {
      LexiumLogger.init();

      expect(() => {
        LexiumLogger.info("message 1");
        LexiumLogger.error("message 2");
        LexiumLogger.warn("message 3");
        LexiumLogger.verbose("message 4");
        LexiumLogger.silly("message 5");
      }).not.toThrow();
    });

    it("should handle rapid successive calls", () => {
      LexiumLogger.init();

      expect(() => {
        for (let i = 0; i < 10; i++) {
          LexiumLogger.info(`rapid message ${i}`);
        }
      }).not.toThrow();
    });
  });

  describe("Error Handling", () => {
    it("should handle empty string messages", () => {
      LexiumLogger.init();
      expect(() => LexiumLogger.info("")).not.toThrow();
    });

    it("should handle undefined metadata", () => {
      LexiumLogger.init();
      expect(() => LexiumLogger.info("message", undefined)).not.toThrow();
    });

    it("should handle null metadata", () => {
      LexiumLogger.init();
      expect(() => LexiumLogger.info("message", null)).not.toThrow();
    });

    it("should handle complex objects as metadata", () => {
      LexiumLogger.init();
      const complexMeta = {
        nested: { data: { value: 123 } },
        array: [1, 2, 3],
        func: () => {},
      };
      expect(() => LexiumLogger.info("complex metadata", complexMeta)).not.toThrow();
    });
  });
});
