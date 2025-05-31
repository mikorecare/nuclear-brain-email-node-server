import { Request, Response, NextFunction } from "express";
import { Models } from "../models";
import { Check } from "../helpers";
import { Types } from "mongoose";

const models = new Models().models;

const body = (res: Response, checks: any[]): any => {
  const errors: string[] = [];
  checks.forEach(check => {
    if (check.error.hasError) {
      errors.push(check.error.message);
    }
  });

  if (errors.length > 0) {
    res.status(422).send({ status: "error", message: checks.length > 1 ? errors.join(", ") : errors[0] });
    return true;
  }
  return false;
};

const emailRegex = /[a-z0-9!#$%&"*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&"*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/;

const validateEmail = (email: string): boolean => {
  return emailRegex.test(String(email).toLowerCase());
};

const users = async (req: any, res: any, next: any): Promise<void> => {
  const check = (field: any): Check => new Check(req.body, field),
    errors = body(res, [
      check("connection").notEmpty(),
      check("email").notEmpty(),
      check("password")
        .notEmpty()
        .isPassword(),
      check("confirmPassword")
        .notEmpty()
        .isPassword()
        .matchPassword(req.body.password, req.body.confirmPassword),
      check("app_metadata").notEmpty(),
    ]);

  if (!errors) {
    delete req.body.confirmPassword;
    return next();
  } else {
    res.send(400).json({ status: "error", message: errors });
  }
};

const usersChangepassword = async (req: any, res: any, next: any): Promise<void> => {
  const check = (field: any): Check => new Check(req.body, field),
    errors = body(res, [
      check("password")
        .notEmpty()
        .isPassword(),
      check("confirmPassword")
        .notEmpty()
        .matchPassword(req.body.password, req.body.confirmPassword),
    ]);

  if (!errors) {
    delete req.body.confirmPassword;
    return next();
  } else {
    res.send(400).json({ status: "error", message: errors });
  }
};

const usersUpdate = async (req: any, res: any, next: any): Promise<void> => {
  const check = (field: any): Check => new Check(req.body, field),
    errors = body(res, [
      check("email")
        .notEmpty()
        .isOptional(),
      check("password")
        .notEmpty()
        .isOptional(),
      check("app_metadata").notEmpty(),
      check("user_metadata").notEmpty(),
    ]);

  if (!errors) {
    return next();
  }
};

const id = async (req: any, res: any, next: any): Promise<void> => {
  const check = (field: any): Check => new Check(req.params, field),
    errors = body(res, [
      check("id")
        .notEmpty()
        .isMongoObjId(),
    ]);
  req.params.id = req.params.id.includes("=") ? req.params.id.split("=")[1] : req.params.id;
  if (!errors) {
    return next();
  }
};

export const validate = {};
