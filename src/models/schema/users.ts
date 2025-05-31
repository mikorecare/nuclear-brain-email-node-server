import { Schema, model } from "mongoose";
import { dateOptions, emailRegex } from "../variables";

const userSchema = new Schema(
  {
    accountManager: {
      ref: "Users",
      type: Schema.Types.ObjectId,
    },
    businesses: [
      {
        ref: "Businesses",
        type: Schema.Types.ObjectId,
      },
    ],
    cellphone: String,
    email: {
      match: emailRegex,
      required: true,
      type: String,
      unique: true,
    },
    firstName: String,
    isDeleted: {
      default: false,
      type: Boolean,
    },
    lastName: String,
    middleName: String,
    password: { type: String, required: true, select: false },
    type: {
      default: "owner",
      enum: ["owner", "admin"],
      type: String,
    },
  },
  dateOptions
);

export const users = model("Users", userSchema);
