import { Schema, model, SchemaType } from "mongoose";
import { dateOptions } from "../variables";

const objId = Schema.Types.ObjectId;

const segementSchema = new Schema(
  {
    audienceOf: {
      ref: "Audiences",
      required: true,
      type: objId,
    },
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
    isFiltered: {
      default: false,
      type: Boolean,
    },
    name: {
      required: true,
      type: String,
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

export const segments = model("Segments", segementSchema);
