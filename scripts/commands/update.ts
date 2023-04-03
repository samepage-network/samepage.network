import fs from "fs";
import archiver from "archiver";
import path from "path";
import crypto from "crypto";
import { Lambda, GetFunctionResponse } from "@aws-sdk/client-lambda";
import readDir from "../../package/scripts/internal/readDir";
import appPath from "../../package/scripts/internal/appPath";

const lambda = new Lambda({});

const getFunction = ({
  FunctionName,
  trial = 0,
}: {
  FunctionName: string;
  trial?: number;
}): Promise<GetFunctionResponse> =>
  lambda
    .getFunction({
      FunctionName,
    })
    .catch((e) => {
      if (trial < 100) {
        console.warn(
          `Function ${FunctionName} not found on trial ${trial}. Trying again...`
        );
        return new Promise((resolve) =>
          setTimeout(
            () => resolve(getFunction({ FunctionName, trial: trial + 1 })),
            10000
          )
        );
      } else {
        throw e;
      }
    });

const BUILD_DIR = "build";
const options = {
  date: new Date("09-24-1995"),
};
const ignorePaths = ["mocks"];
const update = ({}: {}): Promise<number> => {
  // including a date in the zip produces consistent hashes
  const name = path.basename(process.cwd());
  return fs.existsSync(BUILD_DIR)
    ? Promise.all(
        readDir(BUILD_DIR)
          .filter(
            (f) =>
              /\.js$/.test(f) &&
              !ignorePaths.some((i) => new RegExp(`^${BUILD_DIR}/${i}`).test(f))
          )
          .map((f) => {
            const apiName = name.replace(/\./g, "-");
            const zip = archiver("zip", { gzip: true, zlib: { level: 9 } });
            console.log(`Zipping ${f}...`);
            const functionName = f
              .replace(/\.js$/, "")
              .replace(/[\\/]/g, "_")
              .replace(new RegExp(`^${BUILD_DIR}_`), "");
            zip.file(appPath(f), { name: `${functionName}.js`, ...options });
            const shasum = crypto.createHash("sha256");
            const data: Uint8Array[] = [];
            return new Promise<void>((resolve, reject) =>
              zip
                .on("data", (d) => {
                  data.push(d);
                  shasum.update(d);
                })
                .on("end", () => {
                  console.log(
                    `Zip of ${functionName} complete (${data.length}).`
                  );
                  const sha256 = shasum.digest("base64");
                  const FunctionName = `${apiName}_${functionName}`;
                  getFunction({
                    FunctionName,
                  })
                    .then((l) => {
                      if (sha256 === l.Configuration?.CodeSha256) {
                        return `No need to upload ${FunctionName}, shas match.`;
                      } else {
                        return lambda
                          .updateFunctionCode({
                            FunctionName,
                            Publish: true,
                            ZipFile: Buffer.concat(data),
                          })
                          .then(
                            (upd) =>
                              `Succesfully uploaded ${FunctionName} at ${upd.LastModified}`
                          );
                      }
                    })
                    .then(console.log)
                    .then(resolve)
                    .catch((e) => {
                      console.error(`deploy of ${functionName} failed:`);
                      reject(e);
                    });
                })
                .finalize()
            );
          })
      ).then(() => 0)
    : Promise.resolve().then(() => {
        console.log(`No \`${BUILD_DIR}\` directory to compile. Exiting...`);
        return 0;
      });
};

export default update;
