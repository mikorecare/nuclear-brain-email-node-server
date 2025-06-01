import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { DateHelper, Check } from "../helpers";
import { Models } from "../models";

interface IModelProperty {
  key: string;
  type: any;
  model: string;
}

interface IRequestParameters {
  [x: string]: any;
  lean: boolean;
  page: number;
  offset: number;
  limit: number;
  direction: string;
  sort: any;
  select: string;
  hasQueryString: boolean;
  hasNoLimit: boolean;
  dbFields: any[];
  populate: any[] | {} | string;
  Status: string | {};
}
interface IQueryValueProperty {
  type: string;
  values: any;
}

interface IValueProperty extends IQueryValueProperty {
  hasError: boolean;
  isRegEx: boolean;
}

const models = new Models().models;

const getModelKeyProps = (model: string): IModelProperty[] => {
  const modelKeyProps = { ...(models[model].schema as any).paths };
  const keys = [];
  for (const key in modelKeyProps) {
    if (modelKeyProps.hasOwnProperty(key)) {
      keys.push({ key, type: (models[model].schema as any).paths[key].instance, model });
    }
  }
  return keys;
};

const defaultParams: any = {
  dateFields: [],
  dbFields: [],
  direction: "asc",
  error: false,
  idFields: [],
  lean: true,
  limit: 100,
  offset: "",
  page: 1,
  populate: "",
  select: "",
  setDbFields: (model: string): void => {
    defaultParams.dateFields.length = 0;
    defaultParams.idFields.length = 0;
    getModelKeyProps(model).forEach((e: any) => {
      defaultParams.dbFields.push(e.key);
      if (e.type === "Date") {
        defaultParams.dateFields.push(e.key);
      }

      if (e.type === "ObjectID") {
        defaultParams.idFields.push(e.key);
      }
    });
  },
  sort: {},
};

const checkParams = (res: Response, checks: any[]): boolean => {
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

class RequestManager {
  private refRequestParams: any;

  constructor(
    private requestParams: IRequestParameters,
    dateFields: string[] = [],
    idParams: string[] = []
  ) {
    this.requestParams = requestParams;
    this.refRequestParams = { ...this.requestParams };
    this.sanitize();
    this.setQuery({ dateParams: dateFields, idParams });
    this.requestParams.hasQueryString = this.hasQueryString();
    this.requestParams.hasNoLimit = this.hasNoLimit();
    this.requestParams.dbFields = this.getQueryFields(this.requestParams);
  }

  getRequestParams(): IRequestParameters {
    return this.requestParams;
  }

  getQueryStringType(fieldValue: string): IQueryValueProperty {
    let properties: any = { type: "SINGLE_VALUE", values: [fieldValue] };

    if (fieldValue.includes("to")) {
      properties = this.setQueryValueProps("RANGE_VALUES", fieldValue.split("to"));
    } else if (fieldValue.includes("and")) {
      properties = this.setQueryValueProps("DUAL_VALUES", fieldValue.split("and"));
    } else if (fieldValue.includes(",")) {
      properties = this.setQueryValueProps("ARRAY_VALUES", fieldValue.split(","));
    }

    return properties;
  }

  setQueryValueProps(type: string, values: string[]): IQueryValueProperty {
    return {
      type,
      values,
    };
  }

  sanitize(): void {
    this.refRequestParams = { ...this.requestParams };
    if (this.requestParams.select) {
      this.requestParams.select = this.requestParams.select.split(" ").reduce((acc: any, cur: any) => {
        acc[cur] = 1;
        return acc;
      }, {});
    }

    if (this.requestParams.sort) {
      this.requestParams.sort = { [this.requestParams.sort]: this.requestParams.direction && this.requestParams.direction === "desc" ? -1 : 1 };
    }
    this.requestParams.limit = Number(this.requestParams.limit ? this.requestParams.limit : defaultParams.limit);
    this.requestParams.lean = this.requestParams.lean ? this.requestParams.lean : defaultParams.lean;
  }

  getValueProperties(fieldValue: string, dataType: string = "STRING"): IValueProperty {
    const properties: IValueProperty = {
      hasError: false,
      isRegEx: false,
      type: "SINGLE_VALUE",
      values: [fieldValue],
    };

    const isParamRegEx = fieldValue.charAt(0) === "/";

    if (fieldValue.includes("to") && dataType === "DATE") {
      properties.type = "RANGE_VALUES";
      properties.values = fieldValue.split("to");
    } else if (fieldValue.includes("and")) {
      properties.type = "DUAL_VALUES";
      properties.values = fieldValue.split("and");
    } else if (fieldValue.includes(",")) {
      properties.type = "ARRAY_VALUES";
      properties.values = fieldValue.split(",");
    }
    if (dataType === "DATE") {
      properties.hasError = Boolean(properties.values.filter((value: any) => !DateHelper.checkFormat(value)).length);
    }

    if (dataType === "ID") {
      const value = fieldValue.replace("/i", "").replace("/", "");

      properties.hasError = !Types.ObjectId.isValid(value);
    }

    if (dataType === "STRING") {
      if (isParamRegEx) {
        try {
          const match: any = fieldValue ? fieldValue.match(new RegExp("^/(.*?)/([gimy]*)$")) : {};
          const regex = new RegExp(match[1], match[2]);
          properties.values = regex;
          properties.isRegEx = true;
        } catch (error) {
          console.error((error as Error).message);
          properties.hasError = true;
        }
      }
    }

    return properties;
  }

  getQueryFields(dbFields: any = this.requestParams): [] {
    const queryFields: any = {};
    defaultParams.dbFields.forEach((field: any) => {
      const fieldValue = dbFields[field];
      if (fieldValue) {
        queryFields[field] = fieldValue;
      }
    });
    return queryFields;
  }

  hasQueryString(): boolean {
    return Object.keys(this.refRequestParams).length ? true : false;
  }

  hasNoLimit(): boolean {
    return this.refRequestParams.limit === "0";
  }

  setQuery(queryOptions: any): void {
    const dbFields = { ...this.getQueryFields(this.refRequestParams) };

    for (const key in dbFields) {
      if (dbFields.hasOwnProperty(key)) {
        this.requestParams[key] = {};
        const value = dbFields[key];
        const isFieldDate = queryOptions.dateParams.includes(key);
        const isFieldID = queryOptions.idParams.includes(key);
        const props = this.getValueProperties(value, isFieldDate ? "DATE" : isFieldID ? "ID" : "STRING");

        if (!props.hasError) {
          switch (props.type) {
            case "RANGE_VALUES":
              if (isFieldDate) {
                const dateFrom = props.values[0],
                  dateTo = props.values[1];
                this.requestParams[key] = DateHelper.setQueryDateMongo(dateFrom, dateTo);
              }
              break;
            case "ARRAY_VALUES":
              this.requestParams[key].$in = props.values;
              break;
            case "SINGLE_VALUE":
            default:
              this.requestParams[key] = isFieldDate ? DateHelper.setQueryDateMongo(value) : props.isRegEx ? props.values : { $eq: value };
              break;
          }
        } else {
          this.requestParams["error"] = !this.requestParams["error"] ? props.hasError : this.requestParams["error"];
          this.requestParams[key].hasError = props.hasError;
        }
      }
    }
  }
}

const events = (req: Request, res: Response, next: NextFunction): void => {
  defaultParams.setDbFields("events");
  defaultParams.dbFields.push("MachineId");
  defaultParams.dbFields.push("All");
  defaultParams.sort = req.query.sort ? req.query.sort : "Name";
  const check = (field: any): Check => new Check(req.query, field),
    errors = checkParams(res, [check("PARAMETERS").isValidParams(defaultParams)]);

  if (!errors) {
    const params = new RequestManager(req.query as IRequestParameters, defaultParams.dateFields, defaultParams.idFields).getRequestParams();
    params.populate = "Kiosk";
    params.Status = { $ne: "Deleted" };

    if (params.ScheduleDate && params.ScheduleDate.hasError) {
      res.status(422).send({ message: "Contains invalid date(s). Use YYYY-MM-DD e.g 2018-12-31.", status: "validation error" });
      return;
    }

    if (params.MachineId && params.MachineId.hasError) {
      res.status(422).send({ message: "Machine ID is not a valid Object ID.", status: "validation error" });
      return;
    }
    return next();
  }
};

const song = (req: Request, res: Response, next: NextFunction): void => {
  defaultParams.setDbFields("song");
  defaultParams.sort = req.query.sort ? req.query.sort : "SongName";
  const check = (field: any): Check => new Check(req.query, field),
    errors = checkParams(res, [check("PARAMETERS").isValidParams(defaultParams)]);

  if (!errors) {
    const params = new RequestManager(req.query as IRequestParameters, defaultParams.dateFields).getRequestParams();
    if (params.DateCreated && params.DateCreated.hasError) {
      res.status(422).send({ message: "Contains invalid date(s). Use YYYY-MM-DD e.g 2018-12-31.", status: "validation error" });
      return;
    }
    return next();
  }
};

const accounts = (req: Request, res: Response, next: NextFunction): void => {
  defaultParams.setDbFields("accounts");
  defaultParams.sort = req.query.sort ? req.query.sort : "SongName";
  const check = (field: any): Check => new Check(req.query, field),
    errors = checkParams(res, [check("PARAMETERS").isValidParams(defaultParams)]);

  if (!errors) {
    const params = new RequestManager(req.query as IRequestParameters, defaultParams.dateFields).getRequestParams();
    if (params.DateCreated && params.DateCreated.hasError) {
      res.status(422).send({ message: "Contains invalid date(s). Use YYYY-MM-DD e.g 2018-12-31.", status: "validation error" });
      return;
    }
    params.Status = "Active";
    return next();
  }
};

const assets = (req: Request, res: Response, next: NextFunction): void => {
  defaultParams.setDbFields("assets");
  const check = (field: any): Check => new Check(req.query, field),
    errors = checkParams(res, [check("PARAMETERS").isValidParams(defaultParams)]);

  if (!errors) {
    const params = new RequestManager(req.query as IRequestParameters, defaultParams.dateFields).getRequestParams();
    if (params.DateCreated && params.DateCreated.hasError) {
      res.status(422).send({ message: "Contains invalid date(s). Use YYYY-MM-DD e.g 2018-12-31.", status: "validation error" });
      return;
    }
    return next();
  }
};

const photos = (req: Request, res: Response, next: NextFunction): void => {
  defaultParams.setDbFields("photos");
  defaultParams.dbFields.push("eventName", "Photo.fieldname", "Photo.originalname");
  const check = (field: any): Check => new Check(req.query, field),
    errors = checkParams(res, [check("PARAMETERS").isValidParams(defaultParams)]);

  if (!errors) {
    const params = new RequestManager(req.query as IRequestParameters, defaultParams.dateFields).getRequestParams();
    if (params.DateCreated && params.DateCreated.hasError) {
      res.status(422).send({ message: "Contains invalid date(s). Use YYYY-MM-DD e.g 2018-12-31.", status: "validation error" });
      return;
    }
    return next();
  }
};

const video = (req: Request, res: Response, next: NextFunction): void => {
  defaultParams.setDbFields("video");
  defaultParams.dbFields.push("eventName", "PhoneNumbers.PhoneNumber");
  const check = (field: any): Check => new Check(req.query, field),
    errors = checkParams(res, [check("PARAMETERS").isValidParams(defaultParams)]);

  if (!errors) {
    const params = new RequestManager(req.query as IRequestParameters, defaultParams.dateFields).getRequestParams();
    if (params.DateCreated && params.DateCreated.hasError) {
      res.status(422).send({ message: "Contains invalid date(s). Use YYYY-MM-DD e.g 2018-12-31.", status: "validation error" });
      return;
    }
    return next();
  }
};

const videoMessage = (req: Request, res: Response, next: NextFunction): void => {
  defaultParams.setDbFields("videoMessage");
  defaultParams.dbFields.push("eventName", "PhoneNumbers.PhoneNumber");
  const check = (field: any): Check => new Check(req.query, field),
    errors = checkParams(res, [check("PARAMETERS").isValidParams(defaultParams)]);

  if (!errors) {
    const params = new RequestManager(req.query as IRequestParameters, defaultParams.dateFields).getRequestParams();
    if (params.DateCreated && params.DateCreated.hasError) {
      res.status(422).send({ message: "Contains invalid date(s). Use YYYY-MM-DD e.g 2018-12-31.", status: "validation error" });
      return;
    }
    return next();
  }
};

const kiosk = (req: Request, res: Response, next: NextFunction): void => {
  defaultParams.setDbFields("kiosk");
  const check = (field: any): Check => new Check(req.query, field),
    errors = checkParams(res, [check("PARAMETERS").isValidParams(defaultParams)]);

  if (!errors) {
    const params = new RequestManager(req.query as IRequestParameters, defaultParams.dateFields).getRequestParams();
    if (params.DateCreated && params.DateCreated.hasError) {
      res.status(422).send({ message: "Contains invalid date(s). Use YYYY-MM-DD e.g 2018-12-31.", status: "validation error" });
      return;
    }
    return next();
  }
};

const songPlay = (req: Request, res: Response, next: NextFunction): void => {
  defaultParams.setDbFields("songPlay");
  const check = (field: any): Check => new Check(req.query, field),
    errors = checkParams(res, [check("PARAMETERS").isValidParams(defaultParams)]);

  if (!errors) {
    const params = new RequestManager(req.query as IRequestParameters, defaultParams.dateFields).getRequestParams();
    if (params.DateCreated && params.DateCreated.hasError) {
      res.status(422).send({ message: "Contains invalid date(s). Use YYYY-MM-DD e.g 2018-12-31.", status: "validation error" });
      return;
    }
    return next();
  }
};

const payment = (req: Request, res: Response, next: NextFunction): void => {
  defaultParams.setDbFields("payment");
  const check = (field: any): Check => new Check(req.query, field),
    errors = checkParams(res, [check("PARAMETERS").isValidParams(defaultParams)]);

  if (!errors) {
    const params = new RequestManager(req.query as IRequestParameters, defaultParams.dateFields).getRequestParams();
    if (params.DateCreated && params.DateCreated.hasError) {
      res.status(422).send({ message: "Contains invalid date(s). Use YYYY-MM-DD e.g 2018-12-31.", status: "validation error" });
      return;
    }
    return next();
  }
};

const users = (req: Request, res: Response, next: NextFunction): void => {
  defaultParams.dbFields = ["user_id", "email", "email_verified", "nickname"];
  const check = (field: any): Check => new Check(req.query, field),
    errors = checkParams(res, [check("PARAMETERS").isValidParams(defaultParams)]);

  if (!errors) {
    const params = new RequestManager(req.query as IRequestParameters, defaultParams.dateFields).getRequestParams();
    if (params.DateCreated && params.DateCreated.hasError) {
      res.status(422).send({ message: "Contains invalid date(s). Use YYYY-MM-DD e.g 2018-12-31.", status: "validation error" });
      return;
    }
    return next();
  }
};

export const allowedParams = {
  users,
};
