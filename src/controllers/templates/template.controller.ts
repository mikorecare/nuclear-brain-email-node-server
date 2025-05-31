import { Controller, Get, Post, Delete } from "../../@rocket";
import { NextFunction, Request, Response } from "express";
import { IModelNames } from "../../interfaces";
import { Database, uploadSingleFile, removeAwsS3File, SES } from "../../helpers";
import mongoose from "mongoose";
import fs from "fs";

declare module "express" {
  // tslint:disable-next-line: interface-name
  interface Request {
    file: any;
  }
}
@Controller("/templates")
export class TemplateController {
  updates: any = {};
  conn: any = [];
  modelName: IModelNames = "templates";
  constructor(private db: Database) {}

  @Get({ path: "/", validations: [] })
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    const fromMonth = req.query.fromMonth ? parseInt(req.query.fromMonth) : 5;
    const fromYear = req.query.fromYear ? parseInt(req.query.fromYear) : 2025;
    const toMonth = req.query.toMonth ? parseInt(req.query.toMonth) : 12;
    const toYear = req.query.toYear ? parseInt(req.query.toYear) : 2025;

    const startDate = new Date(fromYear, fromMonth - 1, 1); // Months are 0-based in JavaScript Date
    const endDate = new Date(toYear, toMonth, 0, 23, 59, 59, 999); // Last day of the month, hours, minutes, seconds, milliseconds

    const query = {
      isDeleted: { $ne: true },
      replicated: { $ne: true },
      dateCreated: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    const { result, error, message } = await this.db.find(this.modelName, query);

    if (error) {
      return next({ status: 400, message });
    }

    if (!result.length) {
      return next({ status: 404, data: [] });
    }

    return next({ status: 200, data: result, message: "Successfully get templates" });
  }

  @Get({ path: "/active", validations: [] })
  async getDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    const date = new Date();
    const dateCreated = new Date(date.getFullYear(), 0);
    dateCreated.setHours(0, 0, 0, 0);
    const { result, error, message } = await this.db.find(this.modelName, {
      isDeleted: { $ne: true },
      replicated: { $ne: true },
      status: { $eq: "active" },
      dateCreated: { $gte: dateCreated },
    });

    if (!error) {
      if (!result.length) {
        return next({ status: 404, data: [] });
      }
      return next({ status: 200, data: result, message: "Successfully get templates" });
    } else {
      next({ status: 400, message });
    }
  }

  @Get({ path: "/:id", validations: [] })
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const data = await SES.getTemplate(req.params.id);
    res.send({ status: 200, data });
  }

  @Post({ path: "/", validations: [] })
  async postTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    const newId = new mongoose.Types.ObjectId();
    const currentUser = req.session;
    const validTypes = ["coupon", "buy_now", "date_offer", "newsletter"];

    await new Promise(resolve => {
      uploadSingleFile("file")(req, res, (err: any, data: any) => {
        if (err) {
          resolve({ error: true });
        } else {
          resolve({ error: false, data, err });
        }
      });
    });

    if (req.file) {
      const temp = req.file.filename.split(".")[0];
      const html = fs.readFileSync(req.file.path, "utf-8");
      await SES.createTemplate(`${newId}`, html);
      fs.unlinkSync(req.file.path);

      const { name, businessId, status = "active", type } = req.body;
      console.log(businessId);
      if (!name) {
        await SES.deleteTemplate(temp);
        return next({ status: 400, message: "`name` is required!" });
      }

      if (!businessId) {
        await SES.deleteTemplate(temp);
        return next({ status: 400, message: "`businessId` is required!" });
      }

      if (!type) {
        await SES.deleteTemplate(temp);
        return next({ status: 400, message: "`type` is required!" });
      }

      if (!validTypes.includes(type)) {
        await SES.deleteTemplate(temp);
        return next({ status: 400, message: "Invalid `type` supplied" });
      }

      const { result, error, message } = await this.db.save(
        this.db.newModel(this.modelName, {
          _id: newId,
          businessId,
          createdBy: currentUser,
          name,
          sesTemplate: newId,
          status,
          type,
        })
      );

      if (error) {
        await SES.deleteTemplate(temp);
        return next({ status: 400, message });
      }
      return next({ data: result, status: 200, message: `Template has been saved successfully.` });
    } else {
      return next({ status: 400, message: "`file` is required!" });
    }
  }

  @Delete({ path: "/:id" })
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { error, message, result } = await this.db.updateOrPatch(this.modelName, req.params.id, { isDeleted: true });
    if (!error) {
      return next({ status: 200, message: "Template successfully deleted", data: result });
    } else {
      return next({ status: 422, message: "Template not found" });
    }
  }
}
