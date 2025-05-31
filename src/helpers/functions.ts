import aws from "aws-sdk";
import multer from "multer";
import fs from "fs";
import atob from "atob";
import btoa from "btoa";

interface ISendEmailParams {
  html: string;
  sender: string;
  subject: string;
  recipient: any;
}

const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET } = process.env;
const updateAwsConfig = () => {
  aws.config.update({
    accessKeyId: AWS_ACCESS_KEY_ID,
    region: AWS_REGION,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  });
};

export const decrypt = (hash: any) => {
  return atob(
    hash
      .split("")
      .reverse()
      .join("")
  );
};

export const downloadHtml = (bucket: string, key: string, res: any) => {
  return new Promise((resolve, reject) => {
    updateAwsConfig();
    const s3 = new aws.S3();
    const params = {
      Bucket: "cdn-email-wysiwyg",
      Key: `${bucket}/${key}`,
    };

    const file = fs.createWriteStream("temp.html");
    s3.getObject(params)
      .createReadStream()
      .on("end", () => {
        const data = fs.readFileSync("temp.html", "utf-8");
        resolve(data);
      })
      .on("error", error => {
        console.log(error, "downloadHTML() error");
      })
      .pipe(file);
  });
};

export const encrypt = (text: any) => {
  return btoa(text)
    .split("")
    .reverse()
    .join("");
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

export const removeAwsS3File = (file: string): Promise<any> => {
  return new Promise(resolve => {
    updateAwsConfig();
    const s3 = new aws.S3();
    s3.deleteObject(
      {
        Bucket: "cdn-email-wysiwyg",
        Key: file,
      },
      (err, data) => {
        if (err) {
          resolve(err);
        } else {
          resolve(data);
        }
      }
    );
  });
};

export const sendEmail = ({ sender, html, subject, recipient }: ISendEmailParams): Promise<any> => {
  return new Promise(
    async (resolve): Promise<void> => {
      updateAwsConfig();
      const ses = new aws.SES();
      const newHtml = await modifyEmailBeforeSending(html, recipient);
      ses.sendEmail(
        {
          Source: sender,
          Destination: { ToAddresses: [recipient] },
          Message: {
            Subject: { Data: subject, Charset: "utf-8" },
            Body: {
              Text: { Data: "", Charset: "utf-8" },
              Html: { Data: newHtml, Charset: "utf-8" },
            },
          },
        },
        err => {
          if (err) {
            resolve({ sent: false, email: recipient, message: err.message });
          } else {
            resolve({ sent: true, email: recipient });
          }
        }
      );
    }
  );
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
