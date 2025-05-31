import { Schema, model } from "mongoose";
import { dateOptions } from "../variables";

const businessInfosSchema = new Schema(
  {
    about: String,
    address: [String],
    categories: [String],
    createdBy: Schema.Types.ObjectId,
    email: String,
    name: String,
    phone: String,
    storeHours: Schema.Types.Mixed,
    updatedBy: Schema.Types.ObjectId,
    website: String,
  },
  dateOptions
);

export const businessInfos = model("BusinessInfos", businessInfosSchema);
