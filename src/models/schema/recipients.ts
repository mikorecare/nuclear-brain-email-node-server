import { Schema, model } from "mongoose";
import { dateOptions, emailRegex } from "../variables";

const objId = Schema.Types.ObjectId;
const recipientsSchema = new Schema(
  {
    audiences: [{ ref: "Audiences", type: Schema.Types.ObjectId }],
    birthDate: {
      type: Date,
    },
    cleaned: [{ ref: "Audiences", type: Schema.Types.ObjectId }],
    createdBy: {
      ref: "Users",
      type: objId,
    },
    email: {
      required: true,
      type: String,
      unique: true,
    },
    firstName: String,
    isDeleted: {
      default: false,
      type: Boolean,
      index: true,
    },
    lastName: String,
    middleName: String,
    sentCampaigns: [{ ref: "Templates", type: Schema.Types.ObjectId }],
    subscribed: [{ ref: "Audiences", type: Schema.Types.ObjectId }],
    unsentCampaigns: [{ ref: "Templates", type: Schema.Types.ObjectId }],
    unsubscribed: [{ ref: "Audiences", type: Schema.Types.ObjectId }],
    updatedBy: {
      ref: "Users",
      type: objId,
    },
  },
  { ...dateOptions, strict: true }
);

export const recipients = model("Recipients", recipientsSchema);
