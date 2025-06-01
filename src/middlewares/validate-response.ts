import { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { IRoutesResponse } from "../interfaces";

interface IResponse {
  code: number;
  response: IRoutesResponse;
}
class ResponseManager {
  errorString: string[] = [
    "no file",
    "not found",
    "forbidden",
    "unsupported",
    "bad request",
    "error",
    "not allowed",
    "unknown",
    "unauthorized",
    "unavailable",
    "not recognize",
    "server error",
  ];
  errorCodes: number[] = [0, 400, 401, 404, 405, 406, 403, 415, 500, 503, 501];
  successCodes: string[] = ["POST", "PUT", "DELETE", "success"];

  constructor(private res: Response) {}

  response({ status, message, data, meta }: IRoutesResponse): IResponse {
    if (!(status !== "")) {
      return this.error("server error", message, data);
    }

    if (this.errorString.includes(status as string) || this.errorCodes.includes(status as number) || status === "") {
      return this.error(status, message, data);
    }

    return this.success(status, message, data, meta);
  }

  send(code: number, response: IRoutesResponse): void {
    this.res.status(code).send(response);
  }

  success(status: string | number, message: string | any = "", data: any[] = [], meta: {} = {}): IResponse {
    const code = status === "POST" || status === "PUT" ? 201 : status === "DELETE" ? 204 : 200;

    return { code, response: { status: "success", message, data, meta } };
  }

  error(status: string | number, message: string | any = "", data?: any): IResponse {
    let code = 404;
    if ([0, "no file", "not found", 404].includes(status)) {
      message = status === "no file" ? "No file sent to the server!" : "No data found!";
    }

    if (["bad request", "error", 400].includes(status)) {
      code = 400;
      message = message ? message : "Invalid request!";
    }

    if (["not allowed", "unknown", 405].includes(status)) {
      code = 405;
      message = status === "not allowed" ? ` ${message} method is not allowed on this service!` : "Unknown action can't be executed!";
    }

    if (["not acceptable", 406].includes(status)) {
      code = 406;
      message = status === "not allowed" ? ` ${message} method is not allowed on this service!` : "Unknown action can't be executed!";
    }

    if (["forbidden", 403].includes(status)) {
      code = 403;
      message = message ? message : "Forbidden action on the server!";
    }

    if (["unauthorized", 401].includes(status)) {
      code = 401;
      message = message ? message : "Authentication failed!";
    }

    if (["server error", 500].includes(status)) {
      code = 500;
      message = message ? message : "Internal server error!";
    }

    if (["unavailable", 503].includes(status)) {
      code = 503;
      message = message ? message : "This service is unavailable!";
    }

    if (["not recognize", 501].includes(status)) {
      code = 501;
      message = message ? message : "The server either does not recognize the request!";
    }

    return { code, response: { status: "error", message, data, meta: {} } };
  }
}

export const response: ErrorRequestHandler = (err, req, res, next) => {
  const { message = "", status = "error", data = [], meta = {} } = err as IRoutesResponse;

  const rs = new ResponseManager(res);
  const { code, response } = rs.response({ status, message, data, meta });
  rs.send(code, { ...response });
};
