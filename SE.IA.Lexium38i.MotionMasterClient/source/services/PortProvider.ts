import { createServer } from "http";
import { LexiumLogger } from "./LexiumLogger";

export class PortProvider {
  async isPortAvailable(host: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createServer();
      server.once("error", (err: NodeJS.ErrnoException) => {
        if (err && (err.code === "EADDRINUSE" || err.message.includes("EADDRINUSE"))) {
          resolve(false);
        } else {
          resolve(true); // If error is not EADDRINUSE, assume port is available for our use
        }
      });

      server.once("listening", () => {
        server.close(() => {
          resolve(true);
        });
      });

      try {
        server.listen(port, host);
      } catch (e) {
        LexiumLogger.error(`Error while trying to listen on ${host}:${port}:`, e);
        resolve(false);
      }
    });
  }

  async getAvailablePort(port: number) {
    // Test on localhost, 127.0.0.1, 0.0.0.0, and :: (IPv6)
    let checkedPort = port;
    while (
      !(await this.isPortAvailable("localhost", checkedPort)) ||
      !(await this.isPortAvailable("127.0.0.1", checkedPort)) ||
      !(await this.isPortAvailable("0.0.0.0", checkedPort)) ||
      !(await this.isPortAvailable("::", checkedPort))
    ) {
      checkedPort++;
    }

    return checkedPort;
  }
}
