import { CloudFront } from "@aws-sdk/client-cloudfront";
import { S3 } from "@aws-sdk/client-s3";
import { Lambda } from "@aws-sdk/client-lambda";
import fs from "fs";
import mime from "mime-types";
import path from "path";
import archiver from "archiver";
import crypto from "crypto";
import readDir from "../../package/scripts/internal/readDir";
import appPath from "../../package/scripts/internal/appPath";

const FE_PUBLIC_DIR = "public";
const s3 = new S3({});
const cloudfront = new CloudFront({});
const lambda = new Lambda({});

const waitForLambda = ({
  trial = 0,
  Qualifier,
  FunctionName,
}: {
  trial?: number;
  Qualifier: string;
  FunctionName: string;
}): Promise<string> => {
  return lambda
    .getFunction({ FunctionName, Qualifier })
    .then((r) => r.Configuration?.State)
    .then((status) => {
      if (status === "Active") {
        return "Done, Lambda is Active!";
      } else if (trial === 60) {
        return "Ran out of time waiting for lambda...";
      } else {
        console.log(
          `Lambda had state ${status} on trial ${trial}. Trying again...`
        );
        return new Promise((resolve) =>
          setTimeout(
            () =>
              resolve(
                waitForLambda({ trial: trial + 1, Qualifier, FunctionName })
              ),
            1000
          )
        );
      }
    });
};

const waitForCloudfront = (trial = 0): Promise<string> => {
  return cloudfront
    .getDistribution({ Id: process.env.CLOUDFRONT_DISTRIBUTION_ID || "" })
    .then((r) => r.Distribution?.Status)
    .then((status) => {
      if (status === "Deployed") {
        return "Done, Cloudfront is Enabled!";
      } else if (trial === 60) {
        return "Ran out of time waiting for cloudfront...";
      } else {
        console.log(
          `Distribution had status ${status} on trial ${trial}. Trying again...`
        );
        return new Promise<string>((resolve) =>
          setTimeout(() => resolve(waitForCloudfront(trial + 1)), 5000)
        );
      }
    });
};

const options = {
  date: new Date("09-24-1995"),
};

const deployRemixServer = (domain: string) => {
  const zip = archiver("zip", { gzip: true, zlib: { level: 9 } });
  readDir("out").forEach((f) =>
    zip.file(appPath(f), { name: `origin-request.js`, ...options })
  );
  const FunctionName = `${domain.replace(/\./g, "-")}_origin-request`;
  return new Promise<{ sha256: string; data: Uint8Array[] }>((resolve) => {
    const shasum = crypto.createHash("sha256");
    const data: Uint8Array[] = [];
    zip
      .on("data", (d) => {
        data.push(d);
        shasum.update(d);
      })
      .on("end", () => {
        const sha256 = shasum.digest("base64");
        resolve({ sha256, data });
      })
      .finalize();
  }).then(({ sha256, data }) =>
    lambda
      .getFunction({
        FunctionName,
      })
      .then((l) => {
        if (sha256 === l.Configuration?.CodeSha256) {
          console.log(`No need to upload ${FunctionName}, shas match.`);
          return Promise.resolve();
        } else {
          return lambda
            .updateFunctionCode({
              FunctionName,
              Publish: true,
              ZipFile: Buffer.concat(data),
            })
            .then((upd) => {
              console.log(
                `Succesfully uploaded ${FunctionName} V${upd.Version} at ${upd.LastModified}`
              );
              return waitForLambda({
                Qualifier: upd.Version || "",
                FunctionName,
              })
                .then(console.log)
                .then(() =>
                  cloudfront.getDistribution({
                    Id: process.env.CLOUDFRONT_DISTRIBUTION_ID || "",
                  })
                )
                .then((config) => {
                  if (
                    !config.Distribution ||
                    !config.Distribution.DistributionConfig ||
                    !config.Distribution.DistributionConfig.DefaultCacheBehavior
                  )
                    throw new Error("Failed to find Distribution");
                  const DistributionConfig = {
                    ...config.Distribution.DistributionConfig,
                    DefaultCacheBehavior: {
                      ...config.Distribution.DistributionConfig
                        .DefaultCacheBehavior,
                      LambdaFunctionAssociations: {
                        Quantity:
                          config.Distribution.DistributionConfig
                            .DefaultCacheBehavior?.LambdaFunctionAssociations
                            ?.Quantity || 0,
                        Items: (
                          config.Distribution.DistributionConfig
                            .DefaultCacheBehavior?.LambdaFunctionAssociations
                            ?.Items || []
                        ).map((l) =>
                          l.LambdaFunctionARN?.includes("origin-request")
                            ? {
                                ...l,
                                LambdaFunctionARN: upd.FunctionArn || "",
                              }
                            : l
                        ),
                      },
                    },
                  };
                  return cloudfront
                    .updateDistribution({
                      DistributionConfig,
                      Id: process.env.CLOUDFRONT_DISTRIBUTION_ID || "",
                      IfMatch: config.ETag,
                    })
                    .then((r) => {
                      console.log(
                        `Updated. Current Status: ${r.Distribution?.Status}`
                      );
                      return waitForCloudfront().then(console.log);
                    });
                });
            });
        }
      })
  );
};

const deploy = ({
  domain = path.basename(process.cwd()),
  keys,
  impatient = false,
}: {
  domain?: string;
  keys?: string[];
  impatient?: boolean;
}): Promise<number> => {
  const publicAssets = keys
    ? keys.filter((k) => fs.existsSync(k))
    : readDir(FE_PUBLIC_DIR);
  console.log("uploading", publicAssets.length, "assets to S3");
  return Promise.all(
    publicAssets.map((p) => {
      const Key = p.substring(FE_PUBLIC_DIR.length + 1);
      const uploadProps = {
        Bucket: domain,
        ContentType: mime.lookup(Key) || undefined,
      };
      console.log(`Uploading ${p} to ${Key}...`);
      return s3.putObject({
        Key,
        ...uploadProps,
        Body: fs.createReadStream(p),
      });
    })
  )
    .then(() => (impatient ? Promise.resolve() : deployRemixServer(domain)))
    .then(() => 0)
    .catch((e) => {
      console.error(`deploy failed:`);
      console.error(e);
      return 1;
    });
};

export const targetedDeploy = (keys?: string[]): void | Promise<void> =>
  process.env.NODE_ENV === "production"
    ? deploy({
        keys,
        domain: (process.env.ORIGIN || "").replace(/^https?:\/\//, ""),
        impatient: true,
      }).then(() => console.log("deployed successfully"))
    : console.log("Wrote locally");

export default deploy;
