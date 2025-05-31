import { Schema, model } from "mongoose";
import { dateOptions } from "../variables";

const businessesSchema = new Schema(
  {
    createdBy: {
      ref: "Users",
      type: Schema.Types.ObjectId,
    },
    logo: String,
    name: String,
    owner: {
      ref: "Users",
      type: Schema.Types.ObjectId,
    },
    profile: {
      ref: "BusinessInfos",
      type: Schema.Types.ObjectId,
    },
    updatedBy: {
      ref: "Users",
      type: Schema.Types.ObjectId,
    },
  },
  dateOptions
);

export const businesses = model("Businesses", businessesSchema);
