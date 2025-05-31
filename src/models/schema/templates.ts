import { Schema, model } from "mongoose";
import { dateOptions } from "../variables";

const templateSchema = new Schema(
  {
    businessId: {
      ref: "Businesses",
      required: true,
      type: Schema.Types.ObjectId,
    },
    createdBy: Schema.Types.ObjectId,
    endDate: Date,
    finishedAt: Date,
    imageUrl: {
      default: "https://cdn-email-wysiwyg.s3.amazonaws.com/defaults/default-template.jpg",
      type: String,
    },
    isDeleted: {
      default: false,
      type: Boolean,
    },
    name: String,
    replicated: {
      default: false,
      type: Boolean,
    },
    sesTemplate: String,
    startDate: Date,
    status: {
      default: "active",
      enum: ["drafted", "scheduled", "active", "finished"],
      required: true,
      type: "String",
    },
    type: {
      enum: ["coupon", "buy_now", "date_offer", "newsletter"],
      type: String,
    },
    updatedBy: Schema.Types.ObjectId,
    used: {
      default: false,
      type: Boolean,
    },
  },
  dateOptions
);

export const templates = model("Templates", templateSchema);
