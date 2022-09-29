import dotenv from "dotenv";
import { execSync } from "child_process";
import getPackageName from "./internal/getPackageName";
dotenv.config();

const publish = async ({
  path: destPath = getPackageName().replace(/-samepage$/, ""),
  domain = "samepage.network/extensions",
}: {
  path?: string;
  domain?: string;
} = {}): Promise<number> => {
  if (!destPath) {
    return Promise.reject(new Error("`path` argument is required."));
  }

  const version = process.env.VERSION;
  console.log(
    `Preparing to publish zip to destination ${destPath} as version ${version}`
  );
  process.chdir("dist");
  await execSync(`zip -qr ${destPath}.zip .`);
  await execSync(
    `aws s3 cp ${destPath}.zip s3://${domain}/${destPath}/${version}.zip`
  );
  return 0;
};

export default publish;
