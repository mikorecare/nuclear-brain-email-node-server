import { Schema, model, SchemaType } from "mongoose";
import { dateOptions } from "../variables";

const objId = Schema.Types.ObjectId;

const audienceSchema = new Schema(
  {
    cleaned: [
      {
        ref: "Recipients",
        type: Schema.Types.ObjectId,
      },
    ],
    contacts: Number,
    createdBy: {
      ref: "Users",
      required: true,
      type: objId,
    },
    defaultFromEmail: String,
    defaultFromName: String,
    isDeleted: {
      default: false,
      type: Boolean,
    },
    name: {
      required: true,
      type: String,
      unique: true,
    },
    oldName: {
      type: String,
    },
    subscribed: [
      {
        ref: "Recipients",
        type: Schema.Types.ObjectId,
      },
    ],
    segmentedEmail: [
      {
        ref: "Segments",
        type: Schema.Types.ObjectId,
      },
    ],
    unsubscribed: [
      {
        ref: "Recipients",
        type: Schema.Types.ObjectId,
      },
    ],
    updatedBy: {
      ref: "Users",
      type: objId,
    },
  },
  dateOptions
);

export const audiences = model("Audiences", audienceSchema);
