import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { execSync } from "child_process";
dotenv.config();

const getPackageName = (): string =>
  (fs.existsSync("package.json")
    ? JSON.parse(fs.readFileSync("package.json").toString())?.name
    : path.basename(process.cwd())
  )?.replace(/^roamjs-/, "");

const publish = async ({
  path: destPath = getPackageName(),
  domain = "",
}: {
  path?: string;
  domain?: string;
}): Promise<number> => {
  if (!destPath) {
    return Promise.reject(new Error("`path` argument is required."));
  }

  const version = process.env.VERSION;
  console.log(
    `Preparing to publish zip to destination ${destPath} as version ${version}`
  );
  await execSync(`zip -qr ${destPath}.zip dist/*`);
  await execSync(
    `aws s3 cp ${destPath}.zip s3://${domain}/${destPath}/${version}.zip`
  );
  return 0;
};

export default () =>
  publish({
    path: getPackageName().replace(/-samepage$/, ""),
    domain: "samepage.network/extensions",
  });
