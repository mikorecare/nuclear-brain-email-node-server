import { Schema, model } from "mongoose";
import { dateOptions, emailRegex } from "../variables";

const objId = Schema.Types.ObjectId;
const emails = [
  {
    type: String,
    unique: true,
  },
];

const statisticsSchema = new Schema(
  {
    bounce: emails,
    click: emails,
    complaint: emails,
    delivery: emails,
    open: emails,
    reject: emails,
    send: emails,
    templateId: {
      ref: "Templates",
      type: objId,
    },
  },
  dateOptions
);

export const statistics = model("Statistics", statisticsSchema);
