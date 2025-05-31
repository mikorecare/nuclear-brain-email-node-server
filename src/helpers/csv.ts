import { Injectable } from "../@rocket";
import { Database, validateEmail, titleCase } from "./";
import { Request } from "express";
import csvtojson from "csvtojson";
import { promisify } from "util";
import { Types } from "mongoose";
import path from "path";
import fs from "fs";
import { IModelNames, ICsvUpdateQuery, IDatabaseResponse } from "../interfaces";

const unlinkAsync = promisify(fs.unlink);

@Injectable()
export class CSV {
  modelName: IModelNames = "";
  constructor(private db: Database) {}

  setModelName(value: IModelNames): void {
    this.modelName = value;
  }

  validateFile(req: Request, requiredTypes: string[]): { status: number; error: boolean; message: string } {
    const { type } = req.params;
    const value = { error: true, status: 401 };

    if (!requiredTypes.includes(type)) {
      return { ...value, message: "Invalid route" };
    }

    if (type === "format") {
      return { ...value, message: "Invalid route" };
    }

    if (!req.file) {
      return { ...value, message: `${type} is required!` };
    }

    if (path.extname(req.file.originalname) !== `.${type}`) {
      return { ...value, message: `Invalid ${type} uploaded` };
    }

    if (type !== "csv") {
      return { ...value, message: `${type} is on development progress!` };
    }

    return { status: 200, error: false, message: "Successfully Imported Emails" };
  }

  convert(req: Request): void {
    const { audience = "" } = req.body;
    const audiences = audience ? this.db.createObjectID(audience) : "";

    csvtojson()
      .fromFile(req.file.path)
      .then(async csv => {
        console.log("Importing csv started please wait....");
        console.time("csv");

        const data = await this.map(csv, audiences);
        unlinkAsync(req.file.path);

        console.log(data, "csvtojson() data");
        console.timeEnd("csv");
        console.log(`Import ${data.length} emails finished!!!`);
      });
  }

  private map(csv: any[], audiences: string | Types.ObjectId): Promise<any[]> {
    return Promise.all(
      csv.map((item: any, index: number) => {
        if (validateEmail(this.getEmail(item))) {
          return this.updateValidCsvItems(item, audiences, index);
        }
        console.log("not valid email");
      })
    );
  }

  private getEmail(item: any): string {
    return item["Email Address"] ? item["Email Address"].toLowerCase() : "";
  }

  private updateValidCsvItems(item: any, audiences: string | Types.ObjectId, index: number): Promise<any> {
    const email = this.getEmail(item);
    const query = this.mapCsvUpdateQuery(item, audiences, email);
    return this.db
      .updateOne(this.modelName, query.update, query.subscribed)
      .then(this.checkFirstCsvUpdate(query))
      .then(this.checkFinalCsvUpdate(email, index));
  }

  private checkFinalCsvUpdate(email: string, index: number): ({ error, message, query }: any) => Promise<any> {
    return ({ error, message, query }: any): Promise<any> => {
      if (error) {
        return Promise.resolve(message);
      }
      console.log(`\n${index}\nImport success for `, email);
      return Promise.resolve(query ? query : email);
    };
  }

  private checkFirstCsvUpdate(query: ICsvUpdateQuery): ({ error, message }: any) => Promise<any> {
    return ({ error, message }: any): Promise<any> => {
      if (error) {
        console.log("\nFIRST UPDATE FAILED", query.update);
        return this.updateNonArray(message, query);
      }
      return Promise.resolve(query.update);
    };
  }

  private updateNonArray(message: string, query: ICsvUpdateQuery): Promise<IDatabaseResponse> {
    const update = query.isSub ? query.subscribedArray : query.unSub(message.includes("non-array"));
    return this.db.updateOne(this.modelName, query.update, update);
  }

  private mapCsvUpdateQuery(item: any, audiences: string | Types.ObjectId, email: string): ICsvUpdateQuery {
    const details = this.setCsvModel(item, email);
    const subscribed = audiences;
    const $addToSet = { audiences };
    const docs = { ...details, $addToSet };
    const unsubscribed = { ...docs, $pull: { subscribed } };
    const sub = { ...details, $addToSet: { ...$addToSet, subscribed } };
    const isSubArray = item["Subscribed"] ? { ...sub } : unsubscribed;
    const subscribedArray = { ...docs, $set: { subscribed } };
    const unSub = (isSub: boolean) => (isSub ? docs : unsubscribed);

    return { unSub, subscribed: { ...isSubArray }, isSub: item["Subscribed"], update: { email }, subscribedArray };
  }

  private setCsvModel(
    item: any,
    email: string
  ): {
    birthDate: Date;
    email: string;
    firstName: string;
    lastName: string;
    middleName: string;
  } {
    const getValue = (name: string) => (item[name] ? titleCase(item[name]) : "");
    const getBirthDay = () => (item["Birth Date"] ? new Date(item["Birth Date"]) : new Date());

    return {
      birthDate: getBirthDay(),
      email,
      firstName: getValue("First Name"),
      lastName: getValue("Last Name"),
      middleName: getValue("Middle Name"),
    };
  }
}
