import { Controller, Get, Patch, Post, Delete } from "../../@rocket";
import { NextFunction, Request, Response } from "express";
import { IModelNames } from "../../interfaces";
import { Database, populate } from "../../helpers";
import mongoose from "mongoose";

@Controller("/audiences")
export class AudienceController {
  audienceSelection: Array<string> = ["firstName", "lastName", "subscribed", "unsubscribed", "email", "dateCreated"];
  updates: any = {};
  conn: any = [];
  modelName: IModelNames = "audiences";

  constructor(private db: Database) {}
  newAudienceModel(body: any, createdBy: any): any {
    return this.db.newModel(this.modelName, { ...body, _id: new mongoose.Types.ObjectId(), createdBy });
  }
  getAudienceAggregationPipeline(m: number): any {
    const subscribed = { $size: { $ifNull: ["$subscribed", []] } };
    const unsubscribed = { $size: { $ifNull: ["$unsubscribed", []] } };

    const pastMonths = new Date();
    pastMonths.setMonth(pastMonths.getMonth() - 5);

    return [
      {
        $project: {
          isDeleted: 1,
          name: 1,
          subscribed,
          unsubscribed,
          segmentedEmail: 1,
          dateCreated: 1,
        },
      },
      {
        $match: {
          isDeleted: { $ne: true },
          dateCreated: { $gte: pastMonths }, // Get only the past 3 months
        },
      },
    ];
  }

  @Get({ path: "/", validations: [] })
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    const monthRaw = req.query.month;
    const m = typeof monthRaw === "string" ? parseInt(monthRaw, 10) : 5;

    const { result, error, message } = await this.db.aggregate(this.modelName, this.getAudienceAggregationPipeline(m));
    if (error) {
      return next({ status: 422, error, message });
    }
    const data = result.map((q: any) => {
      return { ...q };
    });
    return next({ data, message: "Successfully get audiences list", status: 200 });
  }

  async getSubscribers(id: string, page: number, key: string, next: Function): Promise<any> {
    return new Promise(async resolve => {
      const subs = await this.db.find("recipients", { [key]: { $elemMatch: { $eq: id } }, isDeleted: false }, this.audienceSelection, {}, "", 50, page);
      if (subs.error) {
        return next({ status: 400, error: subs.error });
      }
      resolve(subs);
    });
  }

  getAudiences(id: string, next: Function): Promise<any> {
    return new Promise(async resolve => {
      const audience = await this.db.find(this.modelName, { _id: id }, ["name"]);
      if (audience.error) {
        return next({ status: 400, error: audience.error });
      }
      if (!audience.result.length) {
        return next({ status: 404, error: audience.error });
      }
      resolve(audience);
    });
  }

  @Get({ path: "/:id", validations: [] })
  async getById(req: Request, _: Response, next: NextFunction): Promise<void> {
    const pageRaw = req.query.page;
    const page = typeof pageRaw === "string" ? parseInt(pageRaw, 10) : 1;

    const audience = await this.getAudiences(req.params.id, next);
    const subscribers = await this.getSubscribers(req.params.id, page, "subscribed", next);
    const unsubscribers = await this.getSubscribers(req.params.id, page, "unsubscribed", next);
    const data = { ...audience.result[0], recipients: { subs: [...subscribers.result], unsubs: [...unsubscribers.result] } };
    return next({ data, message: "Successfully get audiences information", status: 200 });
  }

  @Post({ path: "/", validations: [] })
  async post(req: Request, _: Response, next: NextFunction): Promise<void> {
    const { name } = req.body;
    if (!name) {
      return next({ status: 403, message: "`name` is required!" });
    }
    const { result, error, message } = await this.db.save(this.newAudienceModel(req.body, req.session));
    if (error) {
      if (message.includes("duplicate key")) {
        return next({ status: 400, message: `Audience with the name (${name}) is already in used.` });
      }
      return next({ status: 400, message });
    }
    next({ status: 200, data: result, message: `Audience ${name} has been saved succefully.` });
  }

  @Patch({ path: "/:id", validations: [] })
  async patch(req: Request, _: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.body;
      if (!name) {
        return next({ status: 400, message: "`name` is required" });
      }
      const { error, result, message } = await this.db.updateOrPatch(this.modelName, req.params.id, { name });
      if (error) {
        return next({ status: 500, message: error });
      }
      return next({ status: 200, data: result, message: "Audience has been updated successfully." });
    } catch (error) {
      next({ message: error, status: 422 });
    }
  }

  @Delete({ path: "/:id", validations: [] })
  async deleteAudience(req: Request, _: Response, next: NextFunction): Promise<void> {
    const { id } = req.params;
    const name = `${+new Date()}-${Math.floor(Math.random() * 10000)}`;
    const getAudience = await this.db.find(this.modelName, { _id: req.params.id });
    if (getAudience.result.length) {
      const { error, message } = await this.db.updateMany(this.modelName, { _id: id }, { isDeleted: true, name, oldName: getAudience.result[0].name });
      if (error) {
        return next({ status: 422, message });
      }
      return next({ status: 200, data: { _id: id }, message: "Audience has been deleted successfully" });
    }
    return next({ status: 404, message: "Template not found" });
  }

  @Post({ path: "/segment", validations: [] })
  async addSegment(req: Request, _: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.body;
      if (!name) {
        return next({ status: 400, message: "`name` is required" });
      }
      const { error, result, message } = await this.db.updateOne(this.modelName, req.body.id, {
        segmentedEmail: { name: name },
      });
      if (error) {
        return next({ status: 422, message });
      }
      return next({ status: 200, data: { _id: req.body.id }, message: "Audience has been deleted successfully" });
    } catch {
      next({ message: "Error", status: 422 });
    }
  }
}
