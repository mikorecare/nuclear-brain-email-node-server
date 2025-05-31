import { Schema, model } from "mongoose";
import { dateOptions } from "../variables";

const campaignSchema = new Schema(
  {
    businessId: {
      ref: "Businesses",
      required: true,
      type: Schema.Types.ObjectId,
    },
    category: {
      enum: ["revenue", "audience_building", "reputation", "customer_engagement"],
      type: String,
    },
    createdBy: {
      ref: "Users",
      type: Schema.Types.ObjectId,
    },
    endDate: Date,
    finishedAt: Date,
    imageUrl: String,
    name: String,
    startDate: Date,
    status: {
      default: "drafted",
      enum: ["active", "drafted", "finished", "scheduled"],
      required: true,
      type: String,
    },
    title: {
      required: true,
      type: String,
    },
    type: {
      enum: ["coupon", "buy_now", "date_offer", "newsletter"],
      type: String,
    },
    updatedBy: {
      ref: "Users",
      type: Schema.Types.ObjectId,
    },
  },
  dateOptions
);

export const campaigns = model("Campaigns", campaignSchema);
