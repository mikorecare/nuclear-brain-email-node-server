const gulp = require("gulp");
const del = require("del");
const ts = require("gulp-typescript");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const { execSync } = require("child_process");
const args = require("yargs").argv;
require("dotenv").config();

const tsProject = ts.createProject("tsconfig.json");

const applicationName = "Metrolime Developers";
const environmentName = `email-server-${args.prod ? "prod" : "dev"}`;
const versionLabel = `v-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const zipFileName = `deploy-${versionLabel}.zip`;

const clean = () => del(["./dist", zipFileName]);

const copyEb = () => gulp.src(".ebextensions/**/*").pipe(gulp.dest("dist/.ebextensions"));

const compileTs = () => tsProject.src().pipe(tsProject()).js.pipe(gulp.dest("dist"));

const npmInstall = cb => {
  fs.mkdirSync("dist", { recursive: true });
  fs.copyFileSync("package.json", "dist/package.json");

  try {
    execSync("npm install --production", {
      cwd: path.resolve("dist"),
      stdio: "inherit",
    });
  } catch (err) {
    cb(err);
    return;
  }
  cb();
};

const zipDist = cb => {
  const output = fs.createWriteStream(zipFileName);
  const archive = archiver("zip", { zlib: { level: 9 } });

  output.on("close", () => cb());
  archive.on("error", err => cb(err));

  archive.pipe(output);
  archive.directory("dist/", false);
  archive.finalize();
};

const deploy = cb => {
  const bucket = process.env.AWS_ELASTIC_BEANSTALK_S3_BUCKET;

  try {
    // Upload to S3
    execSync(`aws s3 cp ${zipFileName} s3://${bucket}/${zipFileName}`, { stdio: "inherit" });

    // Create new application version
    execSync(
      `aws elasticbeanstalk create-application-version ` +
        `--application-name "${applicationName}" ` +
        `--version-label "${versionLabel}" ` +
        `--source-bundle S3Bucket="${bucket}",S3Key="${zipFileName}" ` +
        `--region ${process.env.AWS_REGION}`,
      { stdio: "inherit" }
    );

    // Deploy the version to the environment
    execSync(
      `aws elasticbeanstalk update-environment ` +
        `--environment-name "${environmentName}" ` +
        `--version-label "${versionLabel}" ` +
        `--region ${process.env.AWS_REGION}`,
      { stdio: "inherit" }
    );
  } catch (err) {
    cb(err);
    return;
  }

  cb();
};

exports.deploy = gulp.series(clean, copyEb, compileTs, npmInstall, zipDist, deploy);
