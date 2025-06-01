import { Express, NextFunction, Request, RequestHandler, Response } from "express";
import { response } from "./middlewares/validate-response";
import {
  AudienceController,
  TemplateController,
  UserController,
  RecipientController,
  SenderController,
  BusinessesController,
  EmailsController,
  VersionController,
  SegmentController,
} from "./controllers";
import { validateToken } from "./middlewares";
import connectTimeout from "connect-timeout";
import { connect, connection } from "mongoose";
import Rocket from "./@rocket";
import morgan from "morgan";
import cors from "cors";
import { Config } from "./helpers";

class Server {
  rocket: Rocket;

  constructor() {
    this.rocket = new Rocket();
    this.setUp();
  }

  get app(): Express {
    return this.rocket.app;
  }

  setUp(): void {
    this.app.use(cors());
    this.app.use(morgan("dev"));
    this.app.use(connectTimeout("360s"));
  }

  async connectDatabase(connectionUrl: string, tries: number = 0): Promise<any> {
    const tryCount = 4;
    return new Promise((resolve: any, reject) => {
      if (connection.readyState === 0 && tries < tryCount) {
        connect(connectionUrl, {
          autoIndex: true,
        })
          .then(() => resolve("Database connected"))
          .catch((error: any) => {
            if (tries < tryCount - 1) {
              console.log("Reconnecting database due to error", error.message);
              resolve(this.connectDatabase(connectionUrl, tries + 1));
            }
          });
      } else {
        reject("Database connection problem!!!");
      }

      if (tries < 1) {
        this.databaseStatus();
      }
    });
  }

  databaseStatus(): void {
    if (connection.readyState === 2) {
      console.log("Connecting to database");
      setTimeout(() => {
        this.databaseStatus();
      }, 1000);
    }
  }

  configRoutes(): void {
    this.rocket.routes({
      route: "/api/v1",
      controllers: [
        AudienceController,
        BusinessesController,
        EmailsController,
        RecipientController,
        SenderController,
        TemplateController,
        UserController,
        VersionController,
        SegmentController,
      ],
      middlewares: [validateToken],
      callback: response,
    });
  }

  async start(): Promise<Express> {
    this.configRoutes();
    const notFoundHandler: RequestHandler = (req, res, next) => {
      const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
      res.status(405).json({
        status: "Invalid Request",
        message: `Request: (${req.method}) ${url} is invalid!`,
      });
    };

    this.app.use(notFoundHandler);
    return this.connectDatabase(new Config().MONGO_CONNECTION_URL).then((data: any) => {
      return this.app;
    });
  }
}

export default new Server();
