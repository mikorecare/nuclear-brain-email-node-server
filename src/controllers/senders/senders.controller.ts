import { Controller, Get, Post, Delete } from "../../@rocket";
import { NextFunction, Request, Response } from "express";
import { SES } from "../../helpers";

interface IStatusHelper {
  status: boolean;
  data?: any;
  error?: any;
}

@Controller("/senders")
export class SenderController {
  @Get({ path: "/", validations: [] })
  async get(_: Request, res: Response, next: NextFunction): Promise<void> {
    const { status, data, error } = (await SES.listIdentities()) as IStatusHelper;
    if (status) {
      const verifiedList = data.VerificationAttributes;
      const newList = Object.keys(verifiedList).map(email => {
        return {
          email,
          status: verifiedList[email].VerificationStatus,
        };
      });
      return next({ status: 200, data: newList });
    }
    return next({ status: 401, error });
  }

  @Post({ path: "/" })
  async post(req: Request, _: Response, next: NextFunction): Promise<void> {
    const { email } = req.body;
    if (email) {
      const { status, error } = (await SES.verifyEmail(email)) as IStatusHelper;
      if (status) {
        return next({
          data: { email, status: "Pending" },
          message: `Sender Verification Email was sent`,
          status: 200,
        });
      }
      return next({ status: 401, error });
    }
    return next({ status: 401, message: "Email is required" });
  }

  @Delete({ path: "/:email" })
  async del(req: Request, _: Response, next: NextFunction): Promise<void> {
    const { email } = req.params;
    const { status, error } = (await SES.deleteIdentity(email)) as IStatusHelper;
    if (status) {
      return next({
        data: { email },
        message: `Successfully deleted sender`,
        status: 200,
      });
    }
    return next({ status: 401, error });
  }
}
