export * from "./schema/audiences";
export * from "./schema/businesses";
export * from "./schema/business-infos";
export * from "./schema/campaigns";
export * from "./schema/recipients";
export * from "./schema/statistics";
export * from "./schema/templates";
export * from "./schema/users";
export * from "./schema/recipients-import-history";
export * from "./schema/segments";

import { audiences } from "./schema/audiences";
import { businesses } from "./schema/businesses";
import { businessInfos } from "./schema/business-infos";
import { campaigns } from "./schema/campaigns";
import { recipients } from "./schema/recipients";
import { statistics } from "./schema/statistics";
import { templates } from "./schema/templates";
import { users } from "./schema/users";
import { recipientsImportHistory } from "./schema/recipients-import-history";
import { segments } from "./schema/segments";
import { Model } from "mongoose";
import { IModelNames } from "../interfaces";

export class Models {
  models: { [k: string]: Model<any, any> } = {
    audiences,
    businessInfos,
    businesses,
    campaigns,
    recipients,
    recipientsImportHistory,
    statistics,
    templates,
    users,
    segments,
  };

  getModel(name: IModelNames): Model<any, any> {
    return this.models[name];
  }

  createModel(name: IModelNames, value: any): Model<any, any> {
    return new this.models[name](value);
  }
}
