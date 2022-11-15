import fs from "fs";
import compile, { CliArgs } from "./internal/compile";
import toVersion from "./internal/toVersion";
import { execSync } from "child_process";
import getPackageName from "./internal/getPackageName";

const publish = async ({
  path: destPath = getPackageName().replace(/-samepage$/, ""),
  domain = "samepage.network/extensions",
  review,
  version,
}: {
  path?: string;
  domain?: string;
  review?: string;
  version?: string;
} = {}): Promise<number> => {
  if (!destPath) {
    return Promise.reject(new Error("`path` argument is required."));
  }

  console.log(
    `Preparing to publish zip to destination ${destPath} as version ${version}`
  );
  process.chdir("dist");
  execSync(`zip -qr ${destPath}.zip .`);
  execSync(
    `aws s3 cp ${destPath}.zip s3://${domain}/${destPath}/${version}.zip`
  );
  process.chdir("..");

  if (review && fs.existsSync(`${process.cwd()}/${review}`)) {
    await import(`${process.cwd()}/${review.replace(/\.[jt]s$/, "")}`)
      .then(
        //@ts-ignore
        (mod) => typeof mod.default === "function" && mod.default()
      )
      .catch((e) => console.error(e));
  }
  return 0;
};

const build = (args: CliArgs & { dry?: boolean; review?: string } = {}) => {
  process.env.NODE_ENV = process.env.NODE_ENV || "production";
  const version = toVersion();
  const envExisting = fs.existsSync(".env")
    ? fs.readFileSync(".env").toString()
    : "";
  fs.writeFileSync(
    ".env",
    `${envExisting.replace(/VERSION=[\d-]+\n/gs, "")}VERSION=${version}\n`
  );
  return compile({ ...args, opts: { minify: true }, version })
    .then(() =>
      args.dry ? Promise.resolve(0) : publish({ review: args.review, version })
    )
    .then((exitCode) => {
      console.log("done");
      return exitCode;
    });
};

export default build;
