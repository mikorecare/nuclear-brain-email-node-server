import aws from "aws-sdk";
import multer from "multer";
import multerS3 from "multer-s3";
import { config } from "dotenv";

config();

interface IBulkEmailDestinations {
  Destination: {
    ToAddresses: Array<string>;
  };
  ReplacementTemplateData: string;
}

const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION } = process.env;
aws.config.update({
  accessKeyId: AWS_ACCESS_KEY_ID,
  region: AWS_REGION,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
});

const ses = new aws.SES({ correctClockSkew: true });
const s3 = new aws.S3({ correctClockSkew: true });

export const SES = {
  createConfigurationSet: (name: string) => {
    return new Promise(resolve => {
      ses.createConfigurationSet(
        {
          ConfigurationSet: {
            Name: name,
          },
        },
        (err, data) => {
          if (err) {
            resolve({ status: false, error: err });
          } else {
            const params = {
              ConfigurationSetName: name,
              EventDestination: {
                Enabled: true,
                MatchingEventTypes: ["bounce", "complaint", "open", "click", "reject"],
                Name: name,
                SNSDestination: {
                  TopicARN: "arn:aws:sns:us-east-1:971560487883:email-https",
                },
              },
            };
            ses.createConfigurationSetEventDestination(params, (configErr, configData) => {
              if (configErr) {
                resolve({ status: false, error: configErr });
              } else {
                resolve({ status: true, data: configData });
              }
            });
          }
        }
      );
    });
  },
  createTemplate: (name: string, html: string) => {
    return new Promise(resolve => {
      const params = {
        Template: {
          HtmlPart: html,
          SubjectPart: "N/A",
          TemplateName: name,
        },
      };
      ses.createTemplate(params, (err, data) => {
        if (err) {
          console.log("createTemplate()", err);
          resolve({ status: false, error: err });
        } else {
          resolve({ status: true, data });
        }
      });
    });
  },
  deleteConfigurationSet: (name: string) => {
    return new Promise<void>(resolve => {
      ses.deleteConfigurationSet(
        {
          ConfigurationSetName: name,
        },
        (err, _) => {
          resolve();
        }
      );
    });
  },
  deleteIdentity: (emailAddress: string) => {
    return new Promise(resolve => {
      ses.deleteIdentity(
        {
          Identity: emailAddress,
        },
        (err, data) => {
          if (err) {
            resolve({ status: false, error: err });
          } else {
            resolve({ status: true, data });
          }
        }
      );
    });
  },
  deleteTemplate: (name: string) => {
    return new Promise(resolve => {
      ses.deleteTemplate(
        {
          TemplateName: name,
        },
        (err, data) => {
          if (err) {
            console.log("deleteTemplate()", err);
            resolve({ status: false, error: err });
          } else {
            resolve({ status: true, data });
          }
        }
      );
    });
  },
  getTemplate: (name: String) => {
    return new Promise(resolve => {
      const params = {
        TemplateName: name as string,
      };
      ses.getTemplate(params, (err, data) => {
        if (err) {
          resolve({ status: false, error: err });
        } else {
          resolve({ status: true, data });
        }
      });
    });
  },
  listConfigurationSets: () => {
    return new Promise(resolve => {
      ses.listConfigurationSets(
        {
          NextToken: "",
          MaxItems: 1000,
        },
        (err, data) => {
          if (err) {
            return resolve([]);
          }
          return resolve(data.ConfigurationSets ? data.ConfigurationSets.map(q => q.Name) : []);
        }
      );
    });
  },
  listIdentities: () => {
    return new Promise(resolve => {
      const params = {
        IdentityType: "EmailAddress",
        MaxItems: 1000,
        NextToken: "",
      };
      ses.listIdentities(params, (err, data) => {
        if (err) {
          resolve({ status: false, error: err });
        } else {
          ses.getIdentityVerificationAttributes(
            {
              Identities: data.Identities,
            },
            (verifyError, verifyData) => {
              if (verifyError) {
                resolve({ status: false, error: verifyError });
              } else {
                resolve({ status: true, data: verifyData });
              }
            }
          );
        }
      });
    });
  },
  sendBulkTemplatedEmail: (source: string, template: string, destinations: Array<IBulkEmailDestinations>, audiences: string) => {
    return new Promise(resolve => {
      const params = {
        ConfigurationSetName: `${template}-${audiences}`,
        DefaultTemplateData: JSON.stringify({ unsub: "", email: "" }),
        Destinations: destinations,
        Source: source,
        Template: template,
      };
      ses.sendBulkTemplatedEmail(params, (err, data) => {
        if (err) {
          console.log("sendBulkTemplatedEmail() error", err);
          resolve({ status: false, error: err });
        } else {
          resolve({ status: true, data });
        }
      });
    });
  },
  updateTemplate: (TemplateName: string, SubjectPart: string, HtmlPart: string, TextPart: string) => {
    return new Promise(resolve => {
      if (!TemplateName) {
        return resolve({ status: false, error: "name is required" });
      }

      ses.updateTemplate({ Template: { TemplateName, SubjectPart, HtmlPart, TextPart } }, (err, data) => {
        if (!err) {
          resolve({ status: true, data });
        } else {
          console.log("updateTemplate() error", err);
          resolve({ status: false, error: err });
        }
      });
    });
  },
  verifyEmail: (emailAddress: string) => {
    return new Promise(resolve => {
      ses.verifyEmailIdentity(
        {
          EmailAddress: emailAddress,
        },
        (err, data) => {
          if (err) {
            resolve({ status: false, error: err });
          } else {
            resolve({ status: true, data });
          }
        }
      );
    });
  },
};

export const S3 = {
  removeFile: (bucket: string, key: string): any => {
    s3.deleteObject(
      {
        Bucket: bucket,
        Key: key,
      },
      (err: any, data: any) => {
        if (err) {
          console.log(err, "Error upon removing file: S3()");
        }
      }
    );
  },
  uploadFile: (fieldName: string, folder: string, fileName?: string): any => {
    return multer({
      storage: multerS3({
        acl: "public-read",
        bucket: `cdn-email-wysiwyg${folder}`,
        key(_: any, file: any, cb: Function): void {
          cb(null, `${fileName ? fileName : +new Date()}.${file.originalname.split(".")[1]}`);
        },
        metadata(_: any, file: any, cb: Function): void {
          cb(null, { fieldName: file.fieldname });
        },
        s3,
      }),
    }).single(fieldName);
  },
};
