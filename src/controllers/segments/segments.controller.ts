import { Controller, Get, Patch, Post, Delete } from "../../@rocket";
import { NextFunction, Request, Response } from "express";
import { IModelNames } from "../../interfaces";
import { Database, DateHelper, populate } from "../../helpers";
import { RecipientController } from "../recipients/recipients.controller";
import { AudienceController } from "../audiences/audiences.controller";
import mongoose from "mongoose";

@Controller("/segments")
export class SegmentController {
  audienceSelection: Array<string> = ["firstName", "lastName", "subscribed", "unsubscribed", "email", "dateCreated"];
  updates: any = {};
  conn: any = [];
  modelName: IModelNames = "segments";
  constructor(private db: Database, private recipientController: RecipientController, private audienceController: AudienceController) {}

  getSegmentAggregationPipeline(): any {}

  newSegmentModel(body: any, createdBy: any): any {
    return this.db.newModel(this.modelName, { ...body, _id: new mongoose.Types.ObjectId(), createdBy });
  }

  @Post({ path: "/", validations: [] })
  async post(req: Request, _: Response, next: NextFunction): Promise<void> {
    console.log(req.body);

    const { name, audienceOf } = req.body;
    if (!name) {
      return next({ status: 403, message: "`name` is required!" });
    }
    const { result, error, message } = await this.db.save(this.newSegmentModel(req.body, req.session));
    if (error) {
      if (message.includes("duplicate key")) {
        return next({ status: 400, message: `List with the name (${name}) is already in used.` });
      }
      return next({ status: 400, message });
    }

    await this.db.updateOrPatch("audiences", audienceOf, { $push: { segmentedEmail: [result._id] } });

    next({ status: 200, data: result, message: `List ${name} has been saved succefully.` });
  }
  // @Post({ path: "/:id", validations: [] })
  // async addRecipients(req: Request, res: Response, next: NextFunction): Promise<void> {}
  @Post({ path: "/filter", validations: [] })
  async addFilterRecipients(req: Request, res: Response, next: NextFunction): Promise<void> {
    // const audience = await this.audienceController.getAudiences(req.body.id, next);
    const { selectedAudience, segmentName, selectedMonth, selectedStatus, isFiltered } = req.body;
    const query = {
      $expr: { $eq: [{ $month: { date: "$birthDate", timezone: "Asia/Hong_Kong" } }, parseInt(selectedMonth)] },
      subscribed: { $elemMatch: { $eq: selectedAudience } },
      isDeleted: false,
    };
    // const query = { $expr: { $eq: [{ $month: "$birthDate" }, 9] } };
    if (!segmentName) {
      return next({ status: 403, message: "`name` is required!" });
    }
    var receipientResult = await this.db.find("recipients", query);
    receipientResult.result = receipientResult.result.map((res: any) => {
      return res._id;
    });
    if (receipientResult.result == null || receipientResult.result.length <= 0) {
      return next({ status: 400, message: `There is no recipient with a birthday in the selected month` });
    }
    console.log(receipientResult.result);
    const { result, error, message } = await this.db.save(
      this.newSegmentModel({ name: segmentName, audienceOf: selectedAudience, subscribed: receipientResult.result, isFiltered: isFiltered }, req.session)
    );
    if (error) {
      if (message.includes("duplicate key")) {
        return next({ status: 400, message: `List with the name (${segmentName}) is already in used.` });
      }
      return next({ status: 400, message });
    }

    // console.log(selectedAudience + " " + segmentName + " " + selectedMonth + " " + selectedStatus);
    next({ status: 200, data: receipientResult, message: `successfully filtered a list for ` + segmentName });
  }

  @Get({ path: "/:id", validations: [] })
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { page = 1 } = req.query;
    const { result, error, message } = await this.db.find(this.modelName, { audienceOf: req.params.id, isDeleted: false });

    if (!result || result.length == 0) {
      return next({ status: 200, data: null });
    }
    if (error) {
      return next({ status: 400, message });
    }
    next({ status: 200, data: result, message: `successfully retrieved list` });
  }

  @Get({ path: "/subscribers/:id", validations: [] })
  async subs(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { result, error, message } = await this.db.find(this.modelName, { _id: req.params.id, isDeleted: false });
    if (!result || result.length == 0) {
      return next({ status: 200, data: null });
    }
    if (error) {
      return next({ status: 400, message });
    }
    const subs = await this.db.find("recipients", { _id: { $in: result[0].subscribed } }, this.audienceSelection, {}, "", 50, 1);
    if (!subs.result || subs.result.length == 0) {
      return next({ status: 200, data: null });
    }
    if (subs.error) {
      return next({ status: 400, message: subs.message });
    }
    next({ status: 200, data: subs.result, message: `success` });
  }

  @Delete({ path: "/:id/:isFiltered", validations: [] })
  async deleteRecipient(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (req.params.isFiltered == "true") {
      console.log("isFiltered = true");
      const updateDelete = await this.db.updateOne(this.modelName, { _id: req.params.id }, { isDeleted: true });
      if (updateDelete.error) {
        return next({ status: 400, message: updateDelete.error });
      }
      return next({
        data: {
          _id: req.params.id,
          isDeleted: true,
        },
        message: "Segment has been deleted successfully.",
        status: 200,
      });
    } else {
      console.log("isFiltered = false");

      const { result, error, message } = await this.db.find(this.modelName, { _id: req.params.id, isDeleted: false });
      if (!result || result.length == 0) {
        return next({ status: 200, data: null });
      }
      if (error) {
        return next({ status: 400, message });
      }
      const ids = result.map((q: any) => q.subscribed);
      console.log(ids[0]);
      const aud = await this.db.updateOrPatch("audiences", result[0].audienceOf, { $pull: { subscribed: { $in: ids[0] } } });
      if (aud.error) {
        return next({ status: 400, message: aud.error });
      }
      const recipientUpdate = await this.db.updateMany("recipients", { _id: ids[0] }, { $pull: { subscribed: result[0].audienceOf } });
      const updateDelete = await this.db.updateOne(this.modelName, { _id: req.params.id }, { isDeleted: true });
      if (updateDelete.error) {
        return next({ status: 400, message: updateDelete.error });
      }
      return next({
        data: {
          _id: req.params.id,
          isDeleted: true,
        },
        message: "Segment has been deleted successfully.",
        status: 200,
      });
    }
  }
}
