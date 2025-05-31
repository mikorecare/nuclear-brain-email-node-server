import AWS, { ElasticTranscoder } from "aws-sdk";
import { config } from "dotenv";
config();

export class Config {
  JWT_KEY: string = process.env.JWT_KEY || "JWT_KEY_UNDEFINED";
  IAM_ID: string = process.env.IAM_ID || "IAM_ID_UNDEFINED";
  IAM_SECRET: string = process.env.IAM_SECRET || "IAM_SECRET_UNDEFINED";
  MONGO_CONNECTION_URL: string = process.env.MONGO_CONNECTION_URL || "MONGO_CONNECTION_URL_UNDEFINED";
  MONGO_CONNECTION_URL_TEST: string = process.env.MONGO_CONNECTION_URL_TEST || "MONGO_CONNECTION_URL_TEST_UNDEFINED";
  HASH_ID_SALT: string = process.env.HASH_ID_SALT || "HASH_ID_SALT_UNDEFINED";
  EMAIL_WEBSITE_URL: string = process.env.EMAIL_WEBSITE_URL || "EMAIL_WEBSITE_URL_UNDEFINED";

  createAwsTranscoder(): ElasticTranscoder {
    return new AWS.ElasticTranscoder({
      accessKeyId: this.IAM_ID,
      apiVersion: "2012-09-25",
      region: "us-east-1",
      secretAccessKey: this.IAM_SECRET,
    });
  }
}
