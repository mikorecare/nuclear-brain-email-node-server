import { Request, Response, NextFunction } from "express";
import { Config } from "../helpers";
import jwt from "jsonwebtoken";

const config = new Config();

declare module "express" {
  // tslint:disable-next-line: interface-name
  export interface Request {
    session?: any;
    sessionUserType?: any;
  }
}

export const successHandler = (req: Request, res: Response, next: NextFunction): void => {
  req.query.isCheckJWT = "true";
  return next();
};

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void | Response => {
  if (err.name === "UnauthorizedError") {
    if (err.message.includes("invalid signature")) {
      return res.status(err.status).send({ status: "error", message: "Invalid token." });
    }

    if (err.message.includes("expired")) {
      return res.status(err.status).send({ status: "error", message: "Token expired." });
    }

    return res.status(err.status).send({ status: "error", message: err.message });
  }
  return next();
};

export const validateToken = (req: Request, res: Response, next: NextFunction): void | Response => {
  const { authorization } = req.headers;

  const unvalidatedUrls = [
    { path: /\/users\/login/, method: "POST" },
    { path: /\/recipients\/unsubscribe/, method: "PATCH" },
    { path: /\/recipients\/unsubscribe\/verify/, method: "GET" },
    { path: /\/users\/token\/refresh/, method: "GET" },
    { path: /\/version/, method: "GET" },
    { path: /\/emails\/notifications/, method: "POST" },
    { path: /\/recipients\/embed/, method: "POST" },
  ];
  const regex = (condition: RegExp) => new RegExp(condition);
  const unprotected = unvalidatedUrls.filter(url => regex(url.path).test(req.url) && req.method === url.method);

  if (!unprotected.length) {
    if (authorization) {
      try {
        const token = jwt.verify(authorization, config.JWT_KEY);
        req.session = (token as any).userId;
        req.sessionUserType = (token as any).type;
        return next();
      } catch (decodeErr) {
        return res.status(401).send({ status: "VALIDATION ERROR", message: "Invalid token" });
      }
    } else {
      return res.status(401).send({ status: "VALIDATION ERROR", message: "Unauthorized" });
    }
  } else {
    return next();
  }
};
