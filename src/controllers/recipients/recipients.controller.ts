import { Controller, Get, Patch, Post, Delete } from "../../@rocket";
import { Database, populate, validateEmail, decrypt, uploadSingleFile } from "../../helpers";
import { NextFunction, Request, Response } from "express";
import { IModelNames } from "../../interfaces";
import csvtojson from "csvtojson";
import path from "path";
import async from "async";
import mongoose from "mongoose";
import { uniqBy, chunk } from "lodash";
import { eachSeries } from "async";
import { socketManager } from "../../index";
import { AsyncParser } from "json2csv";
@Controller("/recipients")
export class RecipientController {
  updates: any = {};
  conn: any = [];
  modelName: IModelNames = "recipients";

  constructor(private db: Database) {}
  @Get({ path: "/total", validations: [] })
  async getTotalCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
    const total = await this.db.findAndCount(this.modelName, { isDeleted: false });
    if (!total || total <= 0) {
      return next({ status: 403, message: `error: no recipients found`, data: null });
    }
    next({ status: 200, message: `successfully retrieved the total number of recipients`, data: total });
  }

  @Get({ path: "/", validations: [] })
  async getRecipients(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { page, limit, search } = req.query;
    const queryParams = { isDeleted: { $ne: true } } as any;
    if (search) {
      queryParams["email"] = {
        $options: "i",
        $regex: search,
      };
    }
    const { result, error } = await this.db.find(this.modelName, queryParams, {}, {}, "", limit ? +limit : 100, page ? +page : 1);
    if (error) {
      next({ status: 401, message: "No recipient found" });
    } else {
      next({ data: result, meta: { limit: limit ? +limit : 100, page: page ? +page : 1 }, status: 200 });
    }
  }

  @Get({ path: "/:id", validations: [] })
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { result, error, message } = await this.db.find(this.modelName, { _id: req.params.id }, {}, {}, populate.recipients);
    if (!result.length) {
      return next({ status: 404 });
    }
    if (error) {
      return next({ status: 422, error, message });
    }
    return next({
      data: result.map((q: any) => {
        return {
          ...q,
          subscribed: q.subscribed.map((v: any) => v.name),
          unsubscribed: q.unsubscribed.map((v: any) => v.name),
        };
      }),
      message: "Succesfully get recipient details",
      status: 200,
    });
  }

  validateBody(next: Function, email: string): void {
    if (!email) {
      return next({ status: 403, message: "`email` is required!" });
    }
    if (!validateEmail(email)) {
      return next({ status: 403, message: "`email` is invalid!" });
    }
  }

  async getSubscribers({ next, email, audiences, subscribed }: any): Promise<any> {
    return new Promise(async resolve => {
      const subs: any = {};
      const response = await this.db.find(this.modelName, { email });
      if (response.result.length > 0) {
        return next({ status: 403, message: "Email already exists" });
      }
      if (!Array.isArray(audiences)) {
        return next({ status: 403, message: "Audiences must be array" });
      }
      subs[JSON.parse(subscribed) ? "subscribed" : "unsubscribed"] = audiences;
      return resolve(subs);
    });
  }

  async createRecipient(req: Request, next: Function, newId: any, email: string, subs: object): Promise<any> {
    ["subscribed", "audiences"].map(q => delete req.body[q]);
    const model = this.db.newModel(this.modelName, { ...req.body, _id: newId, createdBy: req.session, email, ...subs });
    const { result, error, message } = await this.db.save(model);
    if (error) {
      return next({ status: 422, message });
    }
    return next({ data: result, status: 200, message: `Recipient (${req.body.email}) has been saved successfully.` });
  }

  @Post({ path: "/", validations: [] })
  async postRecipients(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { email, audiences = [], subscribed = true } = req.body;
    this.validateBody(next, email);
    const newId = new mongoose.Types.ObjectId();
    const subs = await this.getSubscribers({ next, email, audiences, subscribed });
    async.eachSeries(
      audiences,
      async (item: any, cb: Function) => {
        const $addToSet = { [JSON.parse(subscribed) ? "subscribed" : "unsubscribed"]: [newId] };
        await this.db.updateOrPatch("audiences", item, { $addToSet });
        cb();
      },
      async () => this.createRecipient(req, next, newId, email, subs)
    );
  }

  @Post({ path: "/singleImport" })
  async importVersionTwo(req: Request, res: Response, next: NextFunction): Promise<void> {
    const temp = `${+new Date()}`;
    const { error }: any = await new Promise((resolve: Function) => {
      uploadSingleFile("csv", temp)(req, res, (err: any, data: any) => {
        if (err) {
          resolve({ error: true });
        } else {
          resolve({ error: false, data, err });
        }
      });
    });

    if (error) {
      return next({ status: 400, message: "Error upon importing users." });
    }

    if (!req.file) {
      return next({ status: 401, message: "csv is required" });
    }

    const { audienceId } = req.body;

    csvtojson()
      .fromFile(req.file.path)
      .then(async json => {
        if (!json.length) {
          return next({ status: 403, message: "CSV is empty" });
        }

        if (!json[0].hasOwnProperty("Email Address")) {
          return next({ status: 403, message: "`Email Address` field is required on CSV" });
        }

        json = uniqBy(
          json
            .filter(q => q["Email Address"])
            .map(item => ({
              birthDate: item["Birth Date"] != null ? item["Birth Date"] : "",
              createdBy: req.session,
              email: item["Email Address"].toLowerCase(),
              firstName: item["First Name"],
              lastName: item["Last Name"],
              middleName: item["Middle Name"],
              subscribed: audienceId,
            })),
          "email"
        );

        next({ status: 200, data: json, message: `Successfully queued ${json.length} users for importing` });
        let interval = 0;

        eachSeries(
          json,
          async (item, cb) => {
            interval++;
            console.log(`Imported ${interval}/${json.length}`);
            const data = await this.db.find(this.modelName, { email: item.email });
            if (!data.result.length) {
              const addRecipient = await this.db.insertMany(this.modelName, item);
              if (addRecipient.length) {
                const newSubs = addRecipient[0]._id;
                await this.db.updateOrPatch("audiences", audienceId, {
                  $addToSet: {
                    subscribed: [newSubs],
                  },
                });
                cb();
              } else {
                cb();
              }
            } else {
              cb();
            }
          },
          () => {
            console.log("Successfully Finished Importing users");
          }
        );
      });
  }

  @Get({ path: "/export/csv/:audienceId", validations: [] })
  async exportRecipients(req: Request, res: Response, next: NextFunction): Promise<Response> {
    try {
      const { audienceId } = req.params;

      const query = { subscribed: { $elemMatch: { $eq: audienceId } }, isDeleted: false };
      const { error, result } = await this.db.find(
        "recipients",
        query,
        ["email", "firstName", "lastName", "birthDate", "subscribed", "unsubscribed"],
        {},
        "",
        1000000,
        1
      );

      if (error) {
        console.error("Database query error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      const csv = await this.generateCsv(result);

      if (csv) {
        res.header("Content-Type", "text/csv");
        res.attachment(`${audienceId}.csv`); // or res.attachment(`${audienceName}.csv`);
        return res.send(csv);
      } else {
        return res.status(500).json({ error: "Failed to generate CSV" });
      }
    } catch (error) {
      console.error("An unexpected error occurred:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }

  async generateCsv(data: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const fields = ["email", "firstName", "lastName", "birthDate", "subscribed", "unsubscribed"];
      const opts = { fields };

      const transformOpts = { highWaterMark: 8192 };
      const asyncParser = new AsyncParser(opts, transformOpts);
      let csv = "";

      asyncParser.processor
        .on("data", (chunk: any) => {
          csv += chunk.toString();
        })
        .on("end", () => {
          resolve(csv);
        })
        .on("error", (err: any) => {
          console.error("CSV generation error:", err);
          reject(err);
        });

      data.forEach((e: any) => {
        let birthDate = null;
        if (e.birthDate) {
          birthDate = new Date(e.birthDate).toLocaleDateString();
        }

        asyncParser.input.push(
          JSON.stringify({
            email: e.email,
            firstName: e.firstName,
            lastName: e.lastName,
            birthDate: birthDate,
            subscribed: e.subscribed,
            unsubscribed: e.unsubscribed,
          })
        );
      });

      asyncParser.input.push(null);
    });
  }

  @Post({ path: "/import/:type", validations: [] })
  async importRecipients(req: Request, res: Response, next: NextFunction): Promise<void> {
    // socketListener("upload-file", true);
    const { type } = req.params;
    const temp = `${+new Date()}`;
    const { error }: any = await new Promise((resolve: Function) => {
      uploadSingleFile("csv", temp)(req, res, (err: any, data: any) => {
        if (err) {
          resolve({ error: true });
        } else {
          resolve({ error: false, data, err });
        }
      });
    });

    if (error) {
      return next({ status: 400, message: "Error upon importing users." });
    }

    if (!req.file) {
      return next({ status: 401, message: "csv is required" });
    }

    if (path.extname(req.file.originalname) !== `.${type}`) {
      return next({ status: 401, message: `Invalid ${type} uploaded` });
    }
    const statusArray = ["cleaned", "subscribed", "unsubscribed"];
    const { segmentId } = req.body;
    const { audienceId } = req.body;
    const { status } = req.body;

    if (!statusArray.includes(status)) {
      return next({ status: 401, message: "Invalid `status` supplied. Supported statuses: subscribed || unsubscribed || cleaned " });
    }
    const addToSets = statusArray.filter(q => q !== status);
    // console.log("AddToSets: ", addToSets);
    csvtojson()
      .fromFile(req.file.path)
      .then(async (json: any) => {
        if (!json.length) {
          return next({ status: 403, message: "CSV is empty" });
        }

        const hasEmail = Object.keys(json[0]).filter((key: any) => /email/i.test(key))[0] ?? null;
        const firstnameKey = Object.keys(json[0]).filter((key: any) => /first/i.test(key))[0] ?? null;
        const lastnameKey = Object.keys(json[0]).filter((key: any) => /last/i.test(key))[0] ?? null;
        const birthdayKey = Object.keys(json[0]).filter((key: any) => /birth/i.test(key))[0] ?? null;

        if (!hasEmail) {
          return next({ status: 403, message: "`Email Address` field is required on CSV" });
        }

        if (!firstnameKey) {
          return next({ status: 403, message: "`First Name` field is required on CSV" });
        }

        if (!lastnameKey) {
          return next({ status: 403, message: "`Last Name` field is required on CSV" });
        }

        if (!birthdayKey) {
          return next({ status: 403, message: "`Birth Date` field is required on CSV" });
        }

        const emailRegex =
          /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

        json = uniqBy(
          json
            .filter((q: any) => q[hasEmail])
            .map((item: any) => {
              const email = item[hasEmail].toLowerCase();

              // Check if the email is valid using the regex
              if (!emailRegex.test(email)) {
                // If not valid, you can handle it accordingly (skip, log, etc.)
                console.warn(`Invalid email: ${email}`);
                return null;
              }

              return {
                birthDate: item[birthdayKey],
                createdBy: req.session,
                email: email,
                firstName: item[firstnameKey],
                lastName: item[lastnameKey],
                [status]: audienceId,
              };
            })
            .filter((item: any) => item !== null), // Remove items with invalid emails
          "email"
        );

        // console.log("Json Length:", json.length);

        // const asyncFilter = async (arr: any, predicate: any) => {
        //   const results = await Promise.all(arr.map(predicate));
        //   return arr.filter((_v: any, index: any) => results[index]);
        // };

        // const asyncRes = await asyncFilter(json, async (q: any) => {
        //   const ec = new EmailChecker();
        //   const res = await ec.check(q.email);
        //   return res;
        // });
        // json = asyncRes;

        let i = 0;
        let j = 0;
        let percentage;
        socketManager.emitter("upload-file", { status: "Preparing your file..." });
        await Promise.all(
          chunk(json, 5000).map(async (q: any) => {
            const data = await this.db.insertMany(this.modelName, q);
            if (Array.isArray(data)) {
              console.log("isArray: ", true);
              const chunked = data.map(q => q._id);
              socketManager.emitter("upload-file", { status: "Updating Audiences..." });
              await this.db.updateOrPatch("audiences", audienceId, {
                $addToSet: {
                  [status]: chunked,
                },
              });
              if (mongoose.Types.ObjectId.isValid(segmentId)) {
                socketManager.emitter("upload-file", { status: "Updating Segments..." });
                await this.db.updateOrPatch("segments", segmentId, {
                  $addToSet: {
                    [status]: chunked,
                  },
                });
              }
            } else {
              socketManager.emitter("upload-file", { status: "Cleaning-up..." });
              const emails = data.result.result.writeErrors.map((q: any) => {
                return q.err.op.email;
              });
              socketManager.emitter("upload-file", { status: "Extracting unique recipients..." });
              const trueIds = await this.db.find(this.modelName, { email: { $in: emails }, isDeleted: false }, "_id", {}, "", 5000);
              const ids = trueIds.result.map((q: any) => q._id);
              socketManager.emitter("upload-file", { status: "Updating recipients ..." });
              j += ids.length;
              i += q.length;
              percentage = Math.round((i / json.length) * 100);
              i == json.length
                ? await socketManager.emitter("upload-file", { percentage: percentage + "%", sent: true, message: json.length, status: "Finishing..." })
                : await socketManager.emitter("upload-file", { percentage: percentage + "%", sent: false, message: "", status: "Chunking Files..." });
              await this.db.updateMany(
                this.modelName,
                { _id: ids },
                {
                  $addToSet: {
                    [status]: audienceId,
                  },
                  $pull: {
                    [addToSets[0]]: { $in: [audienceId] },
                    [addToSets[1]]: { $in: [audienceId] },
                  },
                  updatedBy: req.session,
                }
              );
              socketManager.emitter("upload-file", { status: "Saving audience data..." });
              await this.db.updateOrPatch("audiences", audienceId, {
                $addToSet: {
                  [status]: ids,
                },
                $pull: {
                  [addToSets[0]]: { $in: ids },
                  [addToSets[1]]: { $in: ids },
                },
              });
              if (mongoose.Types.ObjectId.isValid(segmentId)) {
                socketManager.emitter("upload-file", { status: "Saving segment data..." });
                await this.db.updateOrPatch("segments", segmentId, {
                  $addToSet: {
                    [status]: ids,
                  },
                  $pull: {
                    [addToSets[0]]: { $in: ids },
                    [addToSets[1]]: { $in: ids },
                  },
                });
              }
            }
          })
        )
          .then(() => {
            socketManager.emitter("upload-file", { status: `${i} valid users out of ${json.length} users` });
            // socketListener("upload-file", false);
            return next({ status: 200, data: json, message: `${i} valid users out of ${json.length} users` });
          })
          .catch(err => {
            return next({ status: 404, message: err });
          });
      });
  }

  @Patch({ path: "/:id", validations: [] })
  async patch(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { email, subscribed = [] } = req.body;

    if (email && !validateEmail(email)) {
      return next({ status: 403, message: "`email` is invalid!" });
    }

    const getAudience = await this.db.find("recipients", { _id: req.params.id });

    if (getAudience.error) {
      return next({ status: 422, message: getAudience.error });
    }

    if (getAudience.result && getAudience.result.length) {
      const tempUnsub = getAudience.result[0].unsubscribed.concat(getAudience.result[0].subscribed);
      const unsubscribed = tempUnsub.filter((q: any) => !subscribed.includes(q.toString()));

      delete req.body["unsubscribed"];
      delete req.body["cleaned"];

      if (subscribed.length) {
        await this.db.updateMany(
          "audiences",
          {
            _id: {
              $in: subscribed,
            },
          },
          {
            $addToSet: { subscribed: [req.params.id] },
            $pull: {
              unsubscribed: {
                $in: [req.params.id],
              },
            },
          }
        );
      }

      if (unsubscribed.length) {
        await this.db.updateMany(
          "audiences",
          {
            _id: {
              $in: unsubscribed,
            },
          },
          {
            $addToSet: { unsubscribed: [req.params.id] },
            $pull: {
              subscribed: {
                $in: [req.params.id],
              },
            },
          }
        );
      }

      const updateRecipient = await this.db.updateOrPatch(this.modelName, req.params.id, {
        ...req.body,
        subscribed,
        unsubscribed,
      });
      next({ message: updateRecipient.result, status: 200 });
    }
  }

  @Post({ path: "/embed" })
  async embedPostRecipients(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, fname, lname, email } = req.body;
      console.log(fname[0].toUpperCase());
      if (email && !validateEmail(email)) {
        return next({ status: 403, message: "`email` is invalid!" });
      }

      const getAudience = await this.db.find("audiences", { _id: id });

      if (getAudience.error) {
        console.log("No Audience found");
        return next({ status: 422, message: "no audience" });
      }

      console.log("Found audience: " + getAudience.result[0].name);

      const getEmail = await this.db.find("recipients", { email: email.toLowerCase() });
      if (getEmail.result.length == 0) {
        await this.db.insertMany("recipients", [
          {
            email: email.toLowerCase(),
            firstName: fname,
            lastName: lname,
            $addToSet: {
              subscribed: [id],
            },
          },
        ]);
        const getnewId = await this.db.find("recipients", { email: email });
        await this.db.findOneAndUpdate(
          "recipients",
          { _id: getnewId.result[0]._id },
          {
            $addToSet: {
              subscribed: [id],
            },
          }
        );
        await this.db.findOneAndUpdate(
          "audiences",
          { _id: id },
          {
            $addToSet: {
              subscribed: [getnewId.result[0]._id],
            },
          }
        );
        return next({ message: "Updated successfully!", status: 200 });
      }

      if (getEmail.result.length >= 1) {
        const verifySub = await this.db.find("recipients", { _id: getEmail.result[0]._id, subscribed: { $elemMatch: { $eq: id } } });
        if (verifySub.result.length == 0) {
          await this.db.findOneAndUpdate(
            "recipients",
            { _id: getEmail.result[0]._id },
            {
              $addToSet: {
                subscribed: [id],
              },
            }
          );
        }
      }

      const verifyAudience = await this.db.find("audiences", { _id: id, subscribed: { $elemMatch: { $eq: getEmail.result[0]._id } } });
      console.log("Customer ID: " + getEmail.result[0]._id);
      if (verifyAudience.result.length == 0) {
        await this.db.findOneAndUpdate(
          "audiences",
          { _id: id },
          {
            $addToSet: {
              subscribed: [getEmail.result[0]._id],
            },
          }
        );
      }

      return next({ message: "Updated successfully!", status: 200 });
    } catch (error) {
      next({ message: error, status: 400 });
    }
  }

  @Get({ path: "/unsubscribe/verify/:id" })
  async verify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, audiences } = JSON.parse(decrypt(req.params.id));
      const { error, result } = await this.db.find(this.modelName, { email, subscribed: { $elemMatch: { $eq: audiences } } });

      if (error || !result.length) {
        return next({ status: 401, message: "Invalid hash string" });
      }

      const hadSubscribed = await new Promise(resolve => {
        result[0].subscribed.map((q: any) => {
          if (JSON.stringify(q) === JSON.stringify(new mongoose.Types.ObjectId(audiences))) {
            return resolve(true);
          }
        });
        return resolve(false);
      });

      if (!hadSubscribed) {
        return next({ status: 401, message: "Invalid hash string" });
      }

      return next({ status: 200, message: "Hash valid" });
    } catch (error) {
      next({ message: error, status: 400 });
    }
  }

  @Patch({ path: "/unsubscribe/:id", validations: [] })
  async unsubscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, audiences } = JSON.parse(decrypt(req.params.id));

      const query = { email, subscribed: { $elemMatch: { $eq: audiences } } };
      const { error, result: recipient, message } = await this.db.find(this.modelName, query, "_id");

      if (error) {
        return next({ status: 422, message });
      }

      if (!recipient.length) {
        return next({ status: 404, message: "No data found" });
      }

      const userId = recipient[0]._id;

      const updateUser = await this.db.updateOrPatch(this.modelName, userId, {
        $addToSet: { unsubscribed: audiences },
        $pull: { subscribed: { $in: [audiences] } },
        updatedBy: userId,
      });

      if (updateUser.error) {
        return next({ status: 400, message: "Something went wrong" });
      }

      const updateAudience = await this.db.updateOrPatch("audiences", audiences, {
        $addToSet: { unsubscribed: userId },
        $pull: { subscribed: { $in: [userId] } },
      });

      if (updateAudience.error) {
        return next({ status: 400, message: "Something went wrong" });
      }

      next({ status: 200, data: [], message: `You have been removed from the subscription list. Sorry to see you go.` });
    } catch (error) {
      return next({ message: error, status: 422 });
    }
  }

  @Delete({ path: "/:id", validations: [] })
  async deleteRecipient(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { error, message } = await this.db.updateOne(this.modelName, { _id: req.params.id }, { isDeleted: true });
    if (error) {
      return next({ status: 401, message });
    }
    return next({
      data: {
        _id: req.params.id,
        isDeleted: true,
      },
      message: "Recipient has been deleted successfully.",
      status: 200,
    });
  }

  @Patch({ path: "/multiple/ids", validations: [] })
  async deleteMultipleRecipients(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { ids } = req.body;

    if (!ids) {
      return next({ status: 403, message: "`ids` is required" });
    }

    if (!Array.isArray(ids)) {
      return next({ status: 403, message: "`ids` must be an array" });
    }

    const { result, error, message } = await this.db.updateMany(
      this.modelName,
      {
        _id: {
          $in: req.body.ids,
        },
      },
      { isDeleted: true }
    );

    if (error) {
      return next({ status: 403, error, message });
    }
    return next({ status: 200, data: { ids }, message: "Recipients successfully deleted." });
  }

  searchQuery(
    req: Request,
    audience?: string
  ): {
    $or: { [x: string]: string | RegExp }[];
    audiences?: { $elemMatch?: { $eq: string } };
  } {
    const setKey = (key: string) => {
      const value = req.query[key];
      if (typeof value === "string") {
        return {
          [key]: key === "email" ? value : new RegExp(value, "i"),
        };
      }
      return {};
    };

    const filters = Object.keys(req.query)
      .map(key => setKey(key))
      .filter(q => Object.keys(q).length > 0);

    const query: any = { $or: filters };

    if (audience) {
      query.audiences = { $elemMatch: { $eq: audience } };
    }

    return query;
  }
}
