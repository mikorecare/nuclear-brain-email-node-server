import { IDatabaseResponse, ICallback, IRoutesResponse, IModelNames } from "../interfaces";
import { Injectable } from "../@rocket";
import { Models } from "../models";
import { Types } from "mongoose";

@Injectable()
export class Database {
  constructor(private model: Models) {}

  newModel(name: IModelNames = "", value: any): any {
    return new this.model.models[name](value);
  }

  modelSchema(name: IModelNames): any {
    return this.model.getModel(name).schema;
  }

  createObjectID(id: string = ""): Types.ObjectId {
    return id !== "" ? new Types.ObjectId(id) : new Types.ObjectId();
  }

  isValidObjectID(id: string = ""): boolean {
    return Types.ObjectId.isValid(id);
  }

  iterableArray(arr: any[]): boolean {
    return Array.isArray(arr) && 0 < arr.length;
  }

  find(
    modelName: IModelNames,
    query: any = {},
    select: any = {},
    options: {} = {},
    populate: any = "",
    limit: number = 100,
    page: number = 1,
    callback: ICallback = (data: any): ICallback => data
  ): Promise<IDatabaseResponse> {
    const que = Array.isArray(query) ? { [query[0]]: query[1] } : query;
    return this.responseObject(
      limit && page
        ? this.model
            .getModel(modelName)
            .find(que, select, options)
            .limit(limit)
            .skip(limit * (page - 1))
            .lean()
            .populate(populate)
            .then(callback)
        : this.model.getModel(modelName).find(que, select, options).lean().populate(populate).then(callback)
    );
  }

  findAndCount(modelName: IModelNames, query: any): Promise<number> {
    const que = Array.isArray(query) ? { [query[0]]: query[1] } : query;
    return this.model.getModel(modelName).find(que).lean().countDocuments();
  }

  findById(modelName: IModelNames, id: string): Promise<IDatabaseResponse> {
    return this.responseObject(this.model.getModel(modelName).findById(id));
  }

  findOne(modelName: IModelNames, query: object): Promise<IDatabaseResponse> {
    return this.responseObject(this.model.getModel(modelName).findOne(query));
  }

  findOneAndUpdate(modelName: IModelNames, query: {}, value: {}, options: {} = { lean: true }, populate: string[] | string = ""): Promise<IDatabaseResponse> {
    const populates = Array.isArray(query) ? (populate as string[]).join(" ") : populate;
    return this.responseObject(this.model.getModel(modelName).findOneAndUpdate(query, value, options).populate(populates));
  }

  async findItemPerPage(modelName: IModelNames, query: any, options: any = {}): Promise<IDatabaseResponse> {
    Object.keys(options).forEach((key: any) => !options[key] && delete options[key]);
    return this.responseObject(
      (this.model.getModel(modelName) as any).paginate(query, options).then((data: any) => {
        if (data.docs.length) {
          let counter: any = (data.page - 1) * data.limit + 1;
          data.docs.forEach((e: any) => (e.row = counter) && counter++);
          data.page = Number(data.page);
        }
        return data;
      })
    );
  }

  findByIdAndUpdate(modelName: IModelNames, id: string, query: object): Promise<IDatabaseResponse> {
    return this.responseObject(
      this.model
        .getModel(modelName)
        .findByIdAndUpdate(id, query)
        .then((data: any) => {
          return { ...JSON.parse(JSON.stringify(data)), ...query };
        })
    );
  }

  findItem(modelName: IModelNames, query: any = {}, select: any = {}, populate: string = ""): Promise<IDatabaseResponse> {
    const que = Array.isArray(query) ? { [query[0]]: query[1] } : query;
    return this.responseObject(this.model.getModel(modelName).find(que, select).populate(populate));
  }

  findAll(modelName: IModelNames, populate?: any): Promise<IDatabaseResponse> {
    return this.responseObject(
      this.model
        .getModel(modelName)
        .find({})
        .populate(populate && populate.populate ? (Array.isArray(populate.populate) ? populate.populate.join(" ") : populate.populate) : "")
    );
  }

  save(model: any, options?: any): Promise<IDatabaseResponse> {
    return this.responseObject(model.save());
  }

  updateOne(modelName: IModelNames, filter: {}, query: {}, message: string = ""): Promise<IDatabaseResponse> {
    return this.responseObject(this.model.getModel(modelName).updateOne(filter, query, { upsert: true }), message);
  }

  updateMany(modelName: IModelNames, filter: {}, query: {}, message: string = ""): Promise<IDatabaseResponse> {
    return this.responseObject(this.model.getModel(modelName).updateMany(filter, query, { upsert: true }), message);
  }

  updateOrPatch(modelName: IModelNames, id: string, query: {}, message: string = ""): Promise<IDatabaseResponse> {
    return this.responseObject(
      this.model
        .getModel(modelName)
        .findByIdAndUpdate(id, query)
        .then((data: any) => {
          if (data._id) {
            (query as any)["_id"] = data._id;
          }
          return query;
        }),
      message
    );
  }

  delete(modelName: IModelNames, id: string): Promise<any> {
    return new Promise((resolve, reject): void => {
      try {
        this.model
          .getModel(modelName)
          .findByIdAndDelete(id)
          .then((data: any) => resolve(data))
          .catch((error: Error) => reject(error));
      } catch (error) {
        reject(error);
      }
    });
  }

  insertMany(modelName: IModelNames, items: any[]): Promise<any> {
    return new Promise((resolve, reject): void => {
      this.model
        .getModel(modelName)
        .insertMany(items, { ordered: false })
        .then((data: any) => resolve(data))
        .catch((error: Error) => reject(error));
    });
  }

  aggregate(modelName: IModelNames, aggregatePipeline: any): Promise<any> {
    return new Promise((resolve, reject): void => {
      this.model
        .getModel(modelName)
        .aggregate(aggregatePipeline)
        .then((data: any) => resolve({ result: data, status: 200 }))
        .catch((error: Error) => reject(error));
    });
  }

  findItemsByIds(modelName: IModelNames, ids: any): Promise<any> {
    return this.responseObject(this.model.getModel(modelName).find({ _id: { $in: ids } }));
  }

  async responseObject(promise: Promise<any>, message: string = ""): Promise<IDatabaseResponse> {
    try {
      return Promise.resolve({ result: await promise, error: false, message });
    } catch (error: unknown) {
      const err = error as { errmsg?: string; message?: string };
      const errorMessage = err?.errmsg || err?.message || String(error);
      return Promise.resolve({ result: [], error: true, message: errorMessage });
    }
  }

  createResponseObject(
    { result, error, message }: IDatabaseResponse,
    noPage: boolean = true,
    statusCode: number | string = 400,
    callback: any = (args: any): any => args
  ): IRoutesResponse {
    const toArray = typeof result.docs === "undefined" && !Array.isArray(result) ? [result] : result,
      { docs, ...metas } = result,
      data = callback(noPage ? toArray : docs);
    return { status: error ? statusCode : "success", message, data, meta: noPage ? { total: data.length } : metas };
  }
}
