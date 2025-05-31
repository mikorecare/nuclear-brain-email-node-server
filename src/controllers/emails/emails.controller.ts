import { Controller, Get, Post, Delete } from "../../@rocket";
import { NextFunction, Request, Response } from "express";
import { Database } from "../../helpers";
import { IModelNames } from "../../interfaces";
import mongoose from "mongoose";

@Controller("/emails")
export class EmailsController {
  modelName: IModelNames = "statistics";

  constructor(private db: Database) {}

  templateAggregatePipeline = (templateId: string) => {
    return [
      {
        $project: {
          send: { $size: { $ifNull: ["$send", []] } },
          templateId: 1,
        },
      },
      {
        $match: {
          templateId: mongoose.Types.ObjectId(templateId),
        },
      },
    ];
  };

  audienceAggregatePipeline = (audienceId: string) => {
    return [
      {
        $project: {
          subscribed: { $size: { $ifNull: ["$subscribed", []] } },
        },
      },
      {
        $match: {
          _id: mongoose.Types.ObjectId(audienceId),
        },
      },
    ];
  };

  async addStatistic(statistic: {
    eventType: any;
    email: string;
    templateId: string;
  }): Promise<{
    status: number;
    error: boolean;
  }> {
    const { eventType, email, templateId } = statistic;
    const newId = new mongoose.Types.ObjectId();
    const events = ["bounce", "click", "complaint", "delivery", "open", "reject", "send"];
    const newFields: any = {};

    events
      .filter((q: string) => q !== eventType.toLowerCase())
      .map((event: any) => {
        newFields[event] = [];
      });

    const addStatistics = await this.db.save(
      this.db.newModel(this.modelName, {
        _id: newId,
        ...newFields,
        [eventType.toLowerCase()]: [email],
        templateId,
      })
    );

    if (addStatistics.error) {
      console.log("add stats error");
      return { status: 422, error: addStatistics.error };
    }
    console.log("added stats");
    return { status: 200, error: false };
  }

  async updateSendStatistic(statistic: {
    eventType: any;
    email: string;
    templateId: string;
    audiences: string;
  }): Promise<{ status: number; data?: any; message?: string; error?: boolean }> {
    const { eventType, email, templateId, audiences } = statistic;
    const updateStat = await this.db.updateMany(this.modelName, { templateId }, { $addToSet: { [eventType.toLowerCase()]: email } });

    if (updateStat.error) {
      console.log("update stat error");
      return { status: 422, error: updateStat.error };
    }

    const isBounce = eventType.toLowerCase() === "bounce";
    const isComplaint = eventType.toLowerCase() === "complaint";
    const isReject = eventType.toLowerCase() === "reject";

    if (isBounce || isReject) {
      this.db.updateMany(this.modelName, { templateId }, { $pull: { delivery: { $in: [email] } } });
    }

    if (isBounce || isComplaint || isReject) {
      this.db.findOne("recipients", { email }).then((result: any) => {
        if (result.length) {
          this.removeRecipients({ userId: result[0]._id, audiences, templateId });
        }
      });
    }

    return { status: 200, data: updateStat.result };
  }

  async removeRecipients(options: { userId: string; audiences: string; templateId: string }): Promise<void> {
    const { userId, audiences, templateId } = options;
    const updateAudiences = await this.db.updateOrPatch("audiences", audiences, {
      $addToSet: { unsubscribed: [userId] },
      $pull: { subscribed: { $in: [userId] } },
    });

    if (updateAudiences.error) {
      console.log("updated audiences error");
    }

    const updatedRecipients = await this.db.updateOrPatch("recipients", userId, {
      $addToSet: {
        cleaned: audiences,
        unsentCampaigns: [mongoose.Types.ObjectId(templateId)],
      },
      $pull: { subscribed: { $in: [audiences] } },
    });

    if (updatedRecipients.error) {
      console.log("updated recipients error");
    }
  }

  @Post({ path: "/notifications" })
  async notify(req: Request, _: Response, next: NextFunction): Promise<any> {
    const logError = (value: any, message: string = "") => {
      console.log("******** ERROR CATCHED HERE START ******", "\n", value, message, "\n", "********* ERROR CATCHED HERE END *******");
    };

    const logStat = (email: string, type: any, message: string = "") => {
      console.log("***************", "\n", "Event type: ", type, "\n", "Sent to ", email, message, "\n", "***************");
    };

    try {
      const json = JSON.parse(req.body);
      let eventType;
      let msg;
      let stats: any;

      try {
        msg = JSON.parse(json.Message);
        eventType = msg.eventType;
      } catch (error) {
        logError(req.body);
        return next({ message: json.Message, status: 200 });
      }

      const configSet = msg.mail.tags["ses:configuration-set"][0];
      const templateId = configSet.split("-")[0];
      const audiences = configSet.split("-")[1];
      const email = msg.mail.destination[0];

      try {
        stats = await Promise.all([this.db.find(this.modelName, { templateId }, "send"), this.db.find("audiences", { _id: audiences }, "subscribed")]);
      } catch (error) {
        logError(email, error as string);
      }

      if (!stats) {
        return next({ message: "Error getting statistics.", status: 422 });
      }

      const [curStat, audStat] = stats;
      let subscribed, send;

      if (!audStat.result[0] || !audStat.result[0].subscribed || !curStat.result[0] || !curStat.result[0].send) {
        logError(email, "Error retrieving statistics informations");
        return next({ message: "Error retrieving statistics informations.", status: 422 });
      }

      subscribed = audStat.result[0].subscribed.length;
      send = curStat.result[0].send.length;

      if (curStat.error) {
        return next({ message: "Error getting current statistics.", status: 422 });
      }

      if (audStat.error) {
        return next({ status: 422, message: "Error getting audiences data." });
      }

      if (!curStat.result.length) {
        await this.addStatistic({ eventType, email, templateId });
      }

      if (subscribed > send && eventType !== "Rendering Failure") {
        const update = await this.updateSendStatistic({ eventType, email, templateId, audiences });
        logStat(email, eventType, "statistics updated");
        return next(update);
      } else {
        logStat(email, eventType, "delivered");
      }

      return next({ status: 200, message: "Delivered" });
    } catch (error) {
      // logError(req.body, error?.message ? error.message : error.toString());
      return next({ status: 422, message: "JSON parsing error" });
    }
  }

  @Get({ path: "/statistics/:templateId" })
  async getStats(req: Request, res: Response, next: NextFunction): Promise<any> {
    const { result, error, message } = await this.db.aggregate(this.modelName, [
      {
        $project: {
          bounce: 1,
          click: 1,
          complaint: 1,
          delivery: 1,
          open: 1,
          reject: 1,
          send: 1,
          templateId: 1,
          dateUpdated: 1,
        },
      },
      {
        $match: {
          templateId: mongoose.Types.ObjectId(req.params.templateId),
        },
      },
    ]);
    if (error) {
      return next({ status: 422, message, error });
    }
    return next({ status: 200, data: result });
  }

  // @Get({ path: "/statistics:templateId" })
  // async getStats(req: Request, res: Response, next: NextFunction): Promise<any> {
  //   const { result, error } = await this.db.find(this.modelName, { templateId: req.params.id });
  //   if (error) {
  //     return next({ status: 422, error });
  //   }
  //   return next({ status: 200, data: result });
  // }
}
