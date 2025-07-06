import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import multer from "multer";
import fs from "fs";
import atob from "atob";
import btoa from "btoa";
import { config } from "dotenv";
import { Readable } from "stream";

config();

interface ISendEmailParams {
  html: string;
  sender: string;
  subject: string;
  recipient: any;
}

const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION } = process.env;

const s3 = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID!,
    secretAccessKey: AWS_SECRET_ACCESS_KEY!,
  },
});

const ses = new SESClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID!,
    secretAccessKey: AWS_SECRET_ACCESS_KEY!,
  },
});

export const decrypt = (hash: any) => {
  return atob(hash.split("").reverse().join(""));
};

export const downloadHtml = async (bucket: string, key: string): Promise<string> => {
  try {
    const command = new GetObjectCommand({
      Bucket: "cdn-email-wysiwyg",
      Key: `${bucket}/${key}`,
    });

    const data = await s3.send(command);

    const streamToString = (stream: Readable): Promise<string> =>
      new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on("data", chunk => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      });

    return await streamToString(data.Body as Readable);
  } catch (err) {
    console.log("downloadHtml() error", err);
    throw err;
  }
};

export const encrypt = (text: any) => {
  return btoa(text).split("").reverse().join("");
};

export const getFileExtension = (filename: any) => `.${filename.split(".")[1]}`;

export const modifyEmailBeforeSending = (html: string, recipient: string): any => {
  return new Promise(resolve => {
    try {
      let tempHtml = html;
      tempHtml = tempHtml.replace("*|UNSUB|*", `${process.env.EMAIL_WEBSITE_URL}/unsubscribe?id=${encodeURIComponent(encrypt(recipient))}`);
      tempHtml = tempHtml.replace("mailto:*|EMAIL|*", `mailto:${recipient}`);
      tempHtml = tempHtml.replace("*|EMAIL|*", recipient);
      resolve(tempHtml);
    } catch (ex) {
      resolve(html);
    }
  });
};

export const removeAwsS3File = async (file: string): Promise<any> => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: "cdn-email-wysiwyg",
      Key: file,
    });
    const data = await s3.send(command);
    return data;
  } catch (err) {
    return err;
  }
};

export const sendEmail = async ({ sender, html, subject, recipient }: ISendEmailParams): Promise<any> => {
  try {
    const newHtml = await modifyEmailBeforeSending(html, recipient);

    const command = new SendEmailCommand({
      Source: sender,
      Destination: { ToAddresses: [recipient] },
      Message: {
        Subject: { Data: subject, Charset: "utf-8" },
        Body: {
          Html: { Data: newHtml, Charset: "utf-8" },
          Text: { Data: "", Charset: "utf-8" },
        },
      },
    });

    await ses.send(command);
    return { sent: true, email: recipient };
  } catch (err: any) {
    return { sent: false, email: recipient, message: err.message };
  }
};

export const titleCase = (str: string) => {
  const splitStr = str.toLowerCase().split(" ");
  for (let i = 0; i < splitStr.length; i++) {
    splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);
  }
  return splitStr.join(" ");
};

export const uniqueValues = (value: any, index: any, self: any) => self.indexOf(value) === index;

export const uploadSingleFile: any = (fieldName: string, fileName?: string) => {
  return multer({
    storage: multer.diskStorage({
      destination: "./uploads",
      filename: (_, file, cb) => {
        cb(null, `${fileName ? fileName : +new Date()}${getFileExtension(file.originalname)}`);
      },
    }),
  }).single(fieldName);
};
