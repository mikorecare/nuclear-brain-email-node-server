import { exec } from "child_process";
import http from "http";
import util from "util";
import server from "./server";
import SocketManager from "./helpers/socket";
import { Express } from "express";

const execute = util.promisify(exec);

declare global {
  namespace Express {
    // tslint:disable-next-line: interface-name
    interface Response {
      sseSetup: any;
      sseSend: any;
    }
  }
}

class App {
  express: Express | null = null;
  private server: http.Server;

  constructor() {
    this.server = http.createServer();
  }

  start(app: Express): void {
    this.express = app;
    try {
      const port = this.normalizePort(process.env.PORT || 3333);
      const server = http.createServer(app);

      server
        .listen(port, () => {
          this.onListen(port);
          socketManager.initialize(server);
        })
        .on("error", this.restart(app, port));
    } catch (error) {
      console.log(error, "start() error");
    }
  }

  restart(app: Express, port: number): (error: any) => Promise<void> {
    return async (error: any) => {
      this.server.close();
      console.log("Server Error:", error);
      const { stdout } = await execute(`netstat -ano | findstr :${process.env.PORT || 3333}`);
      const portUsed = stdout
        .replace(/\r?\n|\r/g, "")
        .split(" ")
        .filter(Boolean)
        .slice(-1)[0];
      console.log(`PORT ${port} on ${portUsed} is already in use!!!`);
      await execute(`taskkill /PID ${portUsed} /F`);
      this.start(app);
    };
  }

  normalizePort(val: any): number {
    const port = parseInt(val, 10);
    return isNaN(port) ? val : port;
  }

  onListen(port: any): void {
    console.log(`Listening on port ${port}`);
  }
}

const app = new App();
const socketManager = new SocketManager();
try {
  server
    .start()
    .then((express: Express) => {
      app.start(express);
    })
    .catch((error: any) => {
      console.log(error);
    });
} catch (error) {
  app.restart(app.express as Express, app.normalizePort(process.env.PORT || 3333));
  console.error("There was an uncaught error on the server:", error);
}

process.on("unhandledRejection", (error: any) => {
  console.error("There was an uncaught error on the server:", error);
});

export { socketManager };
