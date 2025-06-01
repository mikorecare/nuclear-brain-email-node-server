import {
  SESClient,
  CreateConfigurationSetCommand,
  CreateConfigurationSetEventDestinationCommand,
  CreateTemplateCommand,
  DeleteConfigurationSetCommand,
  DeleteIdentityCommand,
  DeleteTemplateCommand,
  GetTemplateCommand,
  ListConfigurationSetsCommand,
  ListIdentitiesCommand,
  GetIdentityVerificationAttributesCommand,
  SendBulkTemplatedEmailCommand,
  UpdateTemplateCommand,
  VerifyEmailIdentityCommand,
} from "@aws-sdk/client-ses";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
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

const sesClient = new SESClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID!,
    secretAccessKey: AWS_SECRET_ACCESS_KEY!,
  },
});

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID!,
    secretAccessKey: AWS_SECRET_ACCESS_KEY!,
  },
});

export const SES = {
  createConfigurationSet: async (name: string) => {
    try {
      const createConfigSetCommand = new CreateConfigurationSetCommand({
        ConfigurationSet: { Name: name },
      });
      await sesClient.send(createConfigSetCommand);

      const createEventDestinationCommand = new CreateConfigurationSetEventDestinationCommand({
        ConfigurationSetName: name,
        EventDestination: {
          Enabled: true,
          MatchingEventTypes: ["bounce", "complaint", "open", "click", "reject"],
          Name: name,
          SNSDestination: {
            TopicARN: "arn:aws:sns:us-east-1:971560487883:email-https",
          },
        },
      });
      const data = await sesClient.send(createEventDestinationCommand);
      return { status: true, data };
    } catch (error) {
      return { status: false, error };
    }
  },
  createTemplate: async (name: string, html: string) => {
    try {
      const command = new CreateTemplateCommand({
        Template: {
          HtmlPart: html,
          SubjectPart: "N/A",
          TemplateName: name,
        },
      });
      const data = await sesClient.send(command);
      return { status: true, data };
    } catch (error) {
      console.log("createTemplate()", error);
      return { status: false, error };
    }
  },
  deleteConfigurationSet: async (name: string) => {
    try {
      const command = new DeleteConfigurationSetCommand({
        ConfigurationSetName: name,
      });
      await sesClient.send(command);
    } catch (error) {
      throw error;
    }
  },
  deleteIdentity: async (emailAddress: string) => {
    try {
      const command = new DeleteIdentityCommand({
        Identity: emailAddress,
      });
      const data = await sesClient.send(command);
      return { status: true, data };
    } catch (error) {
      return { status: false, error };
    }
  },
  deleteTemplate: async (name: string) => {
    try {
      const command = new DeleteTemplateCommand({
        TemplateName: name,
      });
      const data = await sesClient.send(command);
      return { status: true, data };
    } catch (error) {
      console.log("deleteTemplate()", error);
      return { status: false, error };
    }
  },
  getTemplate: async (name: string) => {
    try {
      const command = new GetTemplateCommand({
        TemplateName: name,
      });
      const data = await sesClient.send(command);
      return { status: true, data };
    } catch (error) {
      return { status: false, error };
    }
  },
  listConfigurationSets: async () => {
    try {
      const command = new ListConfigurationSetsCommand({
        MaxItems: 1000,
      });
      const data = await sesClient.send(command);
      return data.ConfigurationSets ? data.ConfigurationSets.map(q => q.Name) : [];
    } catch (error) {
      return [];
    }
  },
  listIdentities: async () => {
    try {
      const listCommand = new ListIdentitiesCommand({
        IdentityType: "EmailAddress",
        MaxItems: 1000,
      });
      const data = await sesClient.send(listCommand);

      const verifyCommand = new GetIdentityVerificationAttributesCommand({
        Identities: data.Identities!,
      });
      const verifyData = await sesClient.send(verifyCommand);
      return { status: true, data: verifyData };
    } catch (error) {
      return { status: false, error };
    }
  },
  sendBulkTemplatedEmail: async (source: string, template: string, destinations: Array<IBulkEmailDestinations>, audiences: string) => {
    try {
      const command = new SendBulkTemplatedEmailCommand({
        ConfigurationSetName: `${template}-${audiences}`,
        DefaultTemplateData: JSON.stringify({ unsub: "", email: "" }),
        Destinations: destinations,
        Source: source,
        Template: template,
      });
      const data = await sesClient.send(command);
      return { status: true, data };
    } catch (error) {
      console.log("sendBulkTemplatedEmail() error", error);
      return { status: false, error };
    }
  },
  updateTemplate: async (TemplateName: string, SubjectPart: string, HtmlPart: string, TextPart: string) => {
    if (!TemplateName) {
      return { status: false, error: "name is required" };
    }
    try {
      const command = new UpdateTemplateCommand({
        Template: { TemplateName, SubjectPart, HtmlPart, TextPart },
      });
      const data = await sesClient.send(command);
      return { status: true, data };
    } catch (error) {
      console.log("updateTemplate() error", error);
      return { status: false, error };
    }
  },
  verifyEmail: async (emailAddress: string) => {
    try {
      const command = new VerifyEmailIdentityCommand({
        EmailAddress: emailAddress,
      });
      const data = await sesClient.send(command);
      return { status: true, data };
    } catch (error) {
      return { status: false, error };
    }
  },
};

export const S3 = {
  removeFile: async (bucket: string, key: string) => {
    try {
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      await s3Client.send(command);
    } catch (error) {
      console.log(error, "Error upon removing file: S3()");
    }
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
        s3: s3Client as any,
      }),
    }).single(fieldName);
  },
};
