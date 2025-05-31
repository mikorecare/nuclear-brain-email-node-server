import { Controller, Get } from "../../@rocket";
import { NextFunction, Request, Response } from "express";

@Controller("/version")
export class VersionController {
  @Get({ path: "/", validations: [] })
  getVersion(req: Request, res: Response, next: NextFunction): void {
    next({ status: 200, data: { version: "0.0.2" } });
  }
}
