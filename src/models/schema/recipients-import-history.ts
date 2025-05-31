import { Schema, model } from "mongoose";
import { dateOptions } from "../variables";

const recipientsImportHistorySchema = new Schema(
  {
    campaign: {
      ref: "Campaigns",
      type: Schema.Types.ObjectId,
    },
    createdBy: {
      ref: "Users",
      type: Schema.Types.ObjectId,
    },
    failed: [String],
    successful: [String],
    total: Number,
  },
  dateOptions
);

export const recipientsImportHistory = model("RecipientsImportHistory", recipientsImportHistorySchema);
