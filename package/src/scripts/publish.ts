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
  path: destPathInput = getPackageName(),
}: {
  path?: string;
}): Promise<number> => {
  if (!destPathInput) {
    return Promise.reject(new Error("`path` argument is required."));
  }
  const destPath = destPathInput.replace(/\/$/, "").replace(/-samepage$/, "");
  const version = process.env.VERSION;
  console.log(
    `Preparing to publish zip to destination ${destPath} as version ${version}`
  );
  await execSync(`zip -qr ${destPath}.zip dist`);
  await execSync(
    `aws s3 cp ${destPath}.zip s3://samepage.network/extensions/roam/${version}.zip`
  );
  return 0;
};

export default publish;
