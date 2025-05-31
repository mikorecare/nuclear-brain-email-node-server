import { Controller, Get, Post } from "../../@rocket";
import { NextFunction, Request, Response } from "express";
import { IModelNames } from "../../interfaces";
import { Database, S3, populate } from "../../helpers";
import mongoose from "mongoose";

declare module "express" {
  // tslint:disable-next-line: interface-name
  interface Request {
    file: any;
  }
}
@Controller("/businesses")
export class BusinessesController {
  updates: any = {};
  conn: any = [];
  modelName: IModelNames = "businesses";
  constructor(private db: Database) {}

  @Get({ path: "/", validations: [] })
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { result, error } = await this.db.find(this.modelName, { isDeleted: { $ne: true } }, {}, {}, populate.businessLists);
    if (!error) {
      next({ status: 200, data: result });
    } else {
      next({ status: 400, error });
    }
  }

  uploadFileToS3(req: Request, res: Response, newId: any): Promise<any> {
    const env = process.env.NODE_ENV === "production" ? "production" : "development";
    const fileDestination = `/users/${env}/${req.session}/businesses`;
    return new Promise(resolve => {
      S3.uploadFile("logo", fileDestination, `${newId}`)(req, res, (err: any, data: any) => {
        if (err) {
          resolve({ error: true });
        } else {
          resolve({ error: false, data, err });
        }
      });
    });
  }

  validatePostBody(bodyObject: any, bucket: string, key: string, body: any, next: Function): void {
    if (!bodyObject.name) {
      S3.removeFile(`${bucket}`, `${key}`);
      return next({ status: 401, message: "Business `name` is required!", body });
    }

    if (!bodyObject.owner) {
      S3.removeFile(`${bucket}`, `${key}`);
      return next({ status: 401, message: "Business `owner` is required!", body });
    }
  }

  async getBussinessOwner(owner: string, next: Function, newId: any): Promise<any> {
    return new Promise(async resolve => {
      const businessOwner = await this.db.findById("users", owner);
      if (businessOwner.error) {
        return next({ status: 401, message: "`owner` is invalid" });
      }
      const businesses = businessOwner.result.businesses ? businessOwner.result.businesses : [];
      businesses.push(newId);
      return resolve(businesses);
    });
  }

  async updateUserBusinesses(next: Function, businesses: any, owner: string): Promise<any> {
    return new Promise(async resolve => {
      const update = await this.db.updateOrPatch("users", owner, { businesses });
      if (update.error) {
        return next({ status: 400, message: "Updating user businesses failed. Please try again later." });
      }
      resolve(update);
    });
  }

  async saveBusiness(req: Request, next: NextFunction, owner: string, newId: any): Promise<any> {
    const { result, message, error } = await this.db.save(
      this.db.newModel(this.modelName, {
        _id: newId,
        createdBy: req.session,
        logo: req.file.location,
        name: req.body.name,
        owner,
      })
    );
    if (error) {
      return next({ status: 401, error });
    }
    return next({ status: 200, message: "Successfully", data: result });
  }

  @Post({ path: "/", validations: [] })
  async postBusinesses(req: Request, res: Response, next: NextFunction): Promise<void> {
    const newId = new mongoose.Types.ObjectId();
    const currentUser = req.session;
    await this.uploadFileToS3(req, res, newId);
    if (req.file) {
      const body: any = { name: "" };
      Object.keys(req.body).map(q => (body[q] = req.body[q]));
      const { owner } = body;
      this.validatePostBody(body, req.file.bocket, req.file.key, req.body, next);
      const businesses = await this.getBussinessOwner(owner, next, newId);
      await this.updateUserBusinesses(next, businesses, owner);
      this.saveBusiness(req, next, owner, newId);
    } else {
      return next({ status: 401, message: "`logo` is required!" });
    }
  }
}
