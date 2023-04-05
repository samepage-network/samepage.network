import path from "path";
import fs from "fs";
import { Lambda } from "@aws-sdk/client-lambda";
import archiver from "archiver";
import crypto from "crypto";
import readDir from "./readDir";
import appPath from "./appPath";

const ignorePaths = ["mocks"];

const updateLambdaFunctions = async ({
  out,
  root = ".",
  prefix = "",
}: {
  out: string; // TODO - make this consistent
  root?: string;
  prefix?: string;
}) => {
  const backendOutdir = path.join(root, out);
  const backendFunctions = fs.existsSync(backendOutdir)
    ? readDir(backendOutdir)
    : [];
  if (backendFunctions.length) {
    const lambda = new Lambda({});
    const options = {
      date: new Date("01-01-1970"),
    };
    await Promise.all(
      backendFunctions
        .filter(
          (f) =>
            /\.js$/.test(f) &&
            !ignorePaths.some((i) =>
              new RegExp(`^${backendOutdir}/${i}`).test(f)
            )
        )
        .map((f) => {
          const zip = archiver("zip", { gzip: true, zlib: { level: 9 } });
          console.log(`Zipping ${f}...`);

          const functionName = f
            .replace(/\.js$/, "")
            .replace(new RegExp(`^${backendOutdir}/`), "")
            .replace(/[\\/]/g, "_");
          zip.file(appPath(f), { name: `${prefix}${functionName}.js`, ...options });
          const shasum = crypto.createHash("sha256");
          const data: Uint8Array[] = [];
          return new Promise((resolve, reject) =>
            zip
              .on("data", (d) => {
                data.push(d);
                shasum.update(d);
              })
              .on("end", () => {
                console.log(`Zip of ${functionName} complete (${data.length}).`);
                const sha256 = shasum.digest("base64");
                const FunctionName = `samepage-network_${prefix}${functionName}`;
                lambda
                  .getFunction({
                    FunctionName,
                  })
                  .catch((e) => {
                    console.warn(
                      `Function ${FunctionName} not found due to ${e}.`
                    );
                    return false as const;
                  })
                  .then((l) => {
                    if (!l) {
                      return `Skipping...`;
                    } else if (sha256 === l.Configuration?.CodeSha256) {
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
                    console.error(`deploy of ${f} failed:`);
                    reject(e);
                  });
              })
              .finalize()
          );
        })
    );
  }
};

export default updateLambdaFunctions;
