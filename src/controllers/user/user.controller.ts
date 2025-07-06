import { Controller, Get, Patch, Post } from "../../@rocket";
import { NextFunction, Request, Response } from "express";
import { IDatabaseResponse, IModelNames } from "../../interfaces";
import { Config, Database, SES, uniqueValues, validateEmail, encrypt, populate } from "../../helpers";
import { socketManager } from "../../index";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import atob from "atob";
import { segments } from "../../models";
import { uniq } from "lodash";

declare module "express" {
  // tslint:disable-next-line: interface-name
  interface Request {
    app: any;
  }
}
@Controller("/users")
export class UserController {
  updates: any = {};
  conn: any = [];
  modelName: IModelNames = "users";
  isAborted: boolean = false;
  templateId: any;

  constructor(
    private db: Database,
    private config: Config
  ) {}

  @Get({ path: "/stream", validations: [] })
  stream(req: Request, res: Response, next: NextFunction): void {
    res.sseSetup();
    this.conn.push(res);
    next({ status: 200, data: { id: req.params.id } });
  }

  @Get({ path: "/", validations: [] })
  async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { result, error } = await this.db.find(this.modelName, { isDeleted: { $ne: true } }, {}, {}, populate.businesses);
    if (!error) {
      next({ status: 200, data: result });
    } else {
      next({ status: 400, message: error });
    }
  }

  @Get({ path: "/:id", validations: [] })
  async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { result, error } = await this.db.find(this.modelName, { _id: req.params.id }, {}, {}, populate.businesses);
    if (!error) {
      next({ status: 200, data: result });
    } else {
      next({ status: 400, message: error });
    }
  }

  @Post({ path: "/login", validations: [] })
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { result: users } = await this.db.find(this.modelName, { email: req.body.email }, ["_id", "email", "type", "password"], {}, populate.businesses);
    const { password, email } = req.body;
    if (!email) {
      return next({ status: 403, message: "Email is required!" });
    }

    if (!validateEmail(email)) {
      return next({ status: 403, message: "Email is invalid!" });
    }

    if (!password) {
      return next({ status: 403, message: "Password is required!" });
    }

    if (users.length < 1) {
      return next({ status: 401, message: "Incorrect email or password!" });
    }
    if (this.checkHash(req.body.password, users[0].password)) {
      // if (req.body.password == "Qwertyuiop22!") {
      try {
        const token = jwt.sign(
          {
            email: users[0].email,
            userId: users[0]._id,
            type: users[0].type ? users[0].type : "owner",
          },
          this.config.JWT_KEY,
          {
            expiresIn: "8h",
          }
        );
        return next({
          data: { user: users[0], token },
          message: "Successfully Authenticated",
          status: 200,
          token,
        });
      } catch (ex) {
        console.log(ex, "login() error");
      }
    }

    return next({ message: "Authentication failed", status: 401 });
  }

  @Post({ path: "/send", validations: [] })
  async send(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { segments, audiences, subject, template, sender = "noreply@neutronpos.com", resend = false } = req.body;
    const isNotValid = await this.validateSendingEmail({ audiences, subject, template, sender });
    const { templateError, campaign } = await this.checkTemplateData(template);

    if (templateError || isNotValid) {
      return next({ status: 403, message: templateError ? templateError : isNotValid });
    }
    console.log(req.body);

    next({ status: 200, message: "Email successfully queued for sending" });

    const [startPage, ...rest] = await Promise.all([
      this.checkTemplateStatistics(template),
      this.checkConfigurationSets(`${template}-${audiences}`, resend),
      this.updateSESTemplate(template, subject),
    ]);

    try {
      await this.iterateEmails(segments, audiences, sender, template, campaign, next, startPage);
    } catch (error) {
      console.log(error);
    }
  }

  @Post({ path: "/", validations: [] })
  async postUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { email, password, type } = req.body;
    let accountManager = "";

    if (!email) {
      return next({ status: 403, message: "Email is required!" });
    }

    if (!validateEmail(email)) {
      return next({ status: 403, message: "Email is invalid!" });
    }

    const { result } = await this.db.find(this.modelName, {
      email: req.body.email,
    });

    if (!password) {
      return next({ status: 403, message: "Password is required!" });
    }

    if (result.length > 0) {
      return next({ status: 409, message: "Email already exists" });
    }

    if (req.sessionUserType === "admin") {
      return next({
        status: 403,
        message: "Normal users arent allowed to add users.",
      });
    } else {
      accountManager = req.session;
    }

    return this.generateHash(req.body.password)
      .then(async (hash: string) => {
        const { result, error, message } = await this.db.save(
          this.db.newModel(this.modelName, {
            _id: new mongoose.Types.ObjectId(),
            accountManager,
            email: req.body.email,
            password: hash,
          })
        );

        if (error) {
          return next({ status: 400, message });
        }
        delete result["password"];
        return next({
          data: result,
          status: 200,
          message: `${req.body.email} has been saved successfully.`,
        });
      })
      .catch(error => {
        console.log(error, "postUsers() error");
        return next({ status: 400, message: error });
      });
  }

  @Post({ path: "/abort" })
  async abortSendingEmail(req: Request, res: Response, next: NextFunction) {
    this.isAborted = true;
    console.log("Aborted");
    setInterval(() => (this.isAborted = false), 500);
    socketManager.emitter("email-buffer", { current: "cancelled", total: "", sending: false, template: this.templateId, status: "active" });
    return next({ status: 200, message: "Sending email was aborted" });
  }

  @Post({ path: "/token/refresh" })
  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { token } = req.body;
    if (!token) {
      return next({ status: 401, message: "`token` is required" });
    }

    try {
      const { email, userId } = JSON.parse(atob(token.split(".")[1]));

      if (email && userId) {
        return next({
          data: {
            token: jwt.sign({ email, userId }, this.config.JWT_KEY, {
              expiresIn: "8h",
            }),
          },
          message: "Successfully Refreshed Token",
          status: 200,
        });
      } else {
        return next({
          status: 401,
          message: "Malformed token. Cannot refresh token.",
        });
      }
    } catch (e) {
      return next({
        status: 401,
        message: "Malformed token. Cannot refresh token.",
      });
    }
  }

  @Patch({ path: "/:id", validations: [] })
  async patchAssets(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (req.body.password) {
      req.body.password = await this.generateHash(req.body.password);
    }
    try {
      const update = await this.db.updateOrPatch(this.modelName, req.params.id, { ...req.body }, "User has been updated successfully.");
      next(this.db.createResponseObject(update));
    } catch (error) {
      next({ message: error, status: 400 });
    }
  }

  async validateSendingEmail({ template, sender, subject, audiences }: any): Promise<any> {
    return new Promise(async (resolve: Function) => {
      if (!template || template === "") {
        return resolve("`Template` is required");
      }

      if (!subject || subject === "") {
        return resolve("`Subject` is required");
      }

      if (!audiences || audiences === "") {
        return resolve("`Audiences` is required");
      }

      if (!validateEmail(sender)) {
        return resolve("`Sender` email is invalid");
      }

      if (!mongoose.Types.ObjectId.isValid(audiences)) {
        return resolve("`Audiences` must be a valid object id");
      }

      return resolve();
    });
  }

  async updateSESTemplate(template: string, subject: string): Promise<any> {
    const html = (await SES.getTemplate(template)) as any;
    console.log("HTML:   ", html);
    return SES.updateTemplate(template, subject, html.data.Template.HtmlPart, html.data.Template.TextPart);
  }

  async getAudiences(audiences: string): Promise<any> {
    return new Promise(async (resolve: Function) => {
      const match = { $match: { isDeleted: { $ne: true } } };
      const subscribed = { $size: { $ifNull: ["$subscribed", []] } };
      const unsubscribed = { $size: { $ifNull: ["$unsubscribed", []] } };
      const project = { $project: { isDeleted: 1, name: 1, subscribed, unsubscribed } };

      const audienceData = await this.db.aggregate("audiences", [project, match]).catch(error => {
        return resolve({ status: "error", message: error });
      });

      if (audienceData.error) {
        return resolve({ status: "error", message: audienceData.error });
      }

      const currentAudience = audienceData.result.filter((q: any) => JSON.stringify(q._id) === JSON.stringify(new mongoose.Types.ObjectId(audiences)));

      if (!currentAudience.length) {
        return resolve({ status: "error", message: "Audience not found" });
      }

      return resolve({ status: true, subscribers: currentAudience[0].subscribed });
    });
  }

  async getSegments(segments: string): Promise<any> {
    return new Promise(async (resolve: Function) => {
      const match = { $match: { isDeleted: { $ne: true } } };
      const subscribed = { $size: { $ifNull: ["$subscribed", []] } };
      const unsubscribed = { $size: { $ifNull: ["$unsubscribed", []] } };
      const project = { $project: { isDeleted: 1, name: 1, subscribed, unsubscribed } };

      const segmentData = await this.db.aggregate("segments", [project, match]).catch(error => {
        return resolve({ status: "error", message: error });
      });

      if (segmentData.error) {
        return resolve({ status: "error", message: segmentData.error });
      }

      const currentSegment = segmentData.result.filter((q: any) => JSON.stringify(q._id) === JSON.stringify(new mongoose.Types.ObjectId(segments)));

      if (!currentSegment.length) {
        return resolve({ status: "error", message: "Segment not found" });
      }

      return resolve({ status: true, subscribers: currentSegment[0].subscribed });
    });
  }

  async iterateEmails(
    segments: string,
    audiences: string,
    sender: string,
    template: string,
    campaign: string,
    next: NextFunction,
    startPage: number
  ): Promise<any> {
    let tempEmailAddToSet: any[] = [];
    this.templateId = template;
    const itemPerPage = 50;
    startPage = 1;
    let sent = startPage <= 1 ? 0 : (startPage - 1) * itemPerPage;
    if (audiences && mongoose.Types.ObjectId.isValid(audiences)) {
      const checkAudiences: { status: true | "error"; subscribers: number } = await this.getAudiences(audiences);

      if (checkAudiences.status === "error") {
        console.log(checkAudiences);
        return;
      }

      const checkSegments = mongoose.Types.ObjectId.isValid(segments) ? await this.getSegments(segments) : "";
      // console.log(checkSegments.status, checkSegments.subscribers);
      const query = { subscribed: new mongoose.Types.ObjectId(audiences), isDeleted: false };
      const subscribes = checkSegments.status === true ? checkSegments.subscribers : checkAudiences.subscribers;
      const totalPages = Math.ceil(subscribes / itemPerPage);
      const pages = [];
      const customerSegment: IDatabaseResponse =
        checkSegments.status === true
          ? await this.db.find("segments", { _id: segments, isDeleted: false })
          : { result: [{ subscribed: "" }], message: "", error: true };
      // console.log(subscribes);
      for (let i = startPage; i <= totalPages; i++) {
        pages.push(i);
      }

      console.log("START SENDING EMAIL TEMPLATE:", template);

      for await (const page of pages) {
        const { error, message, result } =
          checkSegments.status === true
            ? await this.db.find("recipients", { _id: { $in: customerSegment.result[0].subscribed }, isDeleted: false }, ["email"], {}, "", itemPerPage, page)
            : await this.db.find("recipients", query, ["email"], {}, "", itemPerPage, page);

        if (this.isAborted == true) {
          setTimeout(() => {
            console.log("Sending aborted");
          }, 1000);
          break;
        }

        if (error) {
          console.log("Error getting recipients");
          console.log(message);
          continue;
        }

        const uniqueEmails: any = result.map((q: { _id: string; email: string }) => {
          const urlID = encrypt(JSON.stringify({ email: q.email, audiences }));
          const unsub = `${this.config.EMAIL_WEBSITE_URL}/unsubscribe?id=${encodeURIComponent(urlID)}`;
          return {
            Destination: { ToAddresses: [q.email] },
            ReplacementTemplateData: JSON.stringify({ email: q.email, unsub }),
          };
        });
        // console.log("CUSTOMER SEGMENT RES", checkSegments);
        // console.log("RESULT: ", result);
        // console.log("MESSAGE: ", message);
        // console.log("ERROR: ", error);
        console.log("START PAGE:", page, "with email count", uniqueEmails.length);
        const bulk = (await SES.sendBulkTemplatedEmail(sender, template, uniqueEmails, checkSegments === true ? segments : audiences)) as any; //remove for testing purpose

        if (bulk.status && this.isAborted === false) {
          // if (this.isAborted === false) {
          //remove for testing purpose

          result.forEach((q: any) => tempEmailAddToSet.push(q.email));
          sent = sent + uniqueEmails.length;
          console.log(`Emails sent: ${sent} | Page: ${page}`);
          if (sent != subscribes) {
            socketManager.emitter("email-buffer", {
              current: sent,
              total: subscribes,
              template: template,
              sending: true,
              status: "active",
              message: "Please wait...",
            });
          }
          if (sent == subscribes) {
            socketManager.emitter("email-buffer", {
              current: sent,
              total: subscribes,
              template: template,
              sending: true,
              status: "active",
              message: "Please wait...",
            });
          } //remove for testing purpose
        }
        socketManager.emitter("email-buffer", {
          current: sent,
          total: subscribes,
          template: template,
          sending: true,
          status: "active",
          message: "Saving Recipients Data...",
        });
        const updateUniqueEmail = this.db.updateMany("recipients", { email: { $in: tempEmailAddToSet } }, { $addToSet: { sentCampaigns: campaign } });
        socketManager.emitter("email-buffer", {
          current: sent,
          total: subscribes,
          template: template,
          sending: true,
          status: "active",
          message: "Saving Statistics Data...",
        });
        const updateManyStat = this.db.updateMany(
          "statistics",
          { templateId: template },
          { $addToSet: { delivery: tempEmailAddToSet, send: tempEmailAddToSet } }
        );
        socketManager.emitter("email-buffer", {
          current: sent,
          total: subscribes,
          template: template,
          sending: true,
          status: "active",
          message: "Cleaning Data...",
        });
        const updateManyRecipients = this.db.updateMany(
          "recipients",
          { email: { $in: tempEmailAddToSet } },
          { $addToSet: { sentCampaigns: new mongoose.Types.ObjectId(template) } }
        );
        socketManager.emitter("email-buffer", {
          current: sent,
          total: subscribes,
          template: template,
          sending: true,
          status: "active",
          message: "Finishing Please Wait...",
        });
        const [updatedEmail, updateStat, updatedRecipients] = await Promise.all([updateUniqueEmail, updateManyStat, updateManyRecipients]);
        socketManager.emitter("email-buffer", {
          current: sent,
          total: subscribes,
          template: template,
          sending: true,
          status: "active",
          message: "Checking errors...",
        });
        if (updateStat.error) {
          console.log("Update statistics error", updateStat.message);
          tempEmailAddToSet.splice(0, tempEmailAddToSet.length);
          continue;
        }

        if (updatedRecipients.error) {
          console.log("updated recipients error", updatedRecipients.message);
          tempEmailAddToSet.splice(0, tempEmailAddToSet.length);
          continue;
        }
        socketManager.emitter("email-buffer", {
          current: sent,
          total: subscribes,
          template: template,
          sending: true,
          status: "active",
          message: "Updating Templates...",
        });
        tempEmailAddToSet.splice(0, tempEmailAddToSet.length);
      }
      await this.db.updateOrPatch("templates", template, { status: "finished" }); //remove for testing purpose
      socketManager.emitter("email-buffer", { current: sent, total: subscribes, template: template, sending: false, status: "finished", message: "Finished!" });
      console.log("FINISHED SENDING EMAIL TEMPLATE:", template);
      this.isAborted = false;
      return;
    }
  }

  async checkTemplateData(template: string): Promise<any> {
    if (mongoose.Types.ObjectId.isValid(template)) {
      const { result } = await this.db.findById("templates", template);

      if (!result._id) {
        return { templateError: "Selected Template is invalid" };
      }

      let templateResponse: any;

      if (!result.used) {
        templateResponse = await this.db.updateOrPatch("templates", template, { used: true });
      }

      if (!result.used && !templateResponse?.error) {
        return { campaign: result.sesTemplate };
      }

      if (templateResponse?.error) {
        return { templateError: templateResponse?.error };
      }

      const _id = new mongoose.Types.ObjectId();
      const newModel = this.db.newModel("templates", { ...result.toObject(), _id, replicated: true });
      const newTemplate = await this.db.save(newModel);

      if (newTemplate.error) {
        console.log(newTemplate.message);
        return { templateError: newTemplate.error };
      }

      return { campaign: newTemplate.result._id };
    }
    return { templateError: "`template` must be an object Id" };
  }

  async checkConfigurationSets(config: string, resend: boolean): Promise<any> {
    return new Promise(async (resolve: Function) => {
      const configurationSets = (await SES.listConfigurationSets()) as any;
      if (!configurationSets.includes(config)) {
        if (resend) {
          await SES.deleteConfigurationSet(config);
        }

        await SES.createConfigurationSet(config);
      }
      return resolve();
    });
  }

  async checkTemplateStatistics(templateId: string): Promise<number> {
    const { result } = await this.db.find("statistics", { templateId }, "send");

    if (result.length) {
      return Math.ceil(result[0].send.length / 50);
    }

    const _id = new mongoose.Types.ObjectId();
    await this.db.save(this.db.newModel("statistics", { _id, templateId }));
    return 1;
  }

  generateHash(value?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!value) {
        return reject(new Error("Value is undefined or empty"));
      }

      bcrypt.hash(value, 10, (err, hash) => {
        if (err) return reject(err);
        return resolve(hash || "");
      });
    });
  }

  checkHash(value: string, hash: string): boolean {
    return bcrypt.compareSync(value, hash);
  }
}
