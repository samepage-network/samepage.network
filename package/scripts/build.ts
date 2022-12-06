import fs from "fs";
import compile, { CliArgs } from "./internal/compile";
import toVersion from "./internal/toVersion";
import { execSync } from "child_process";
import getPackageName from "./internal/getPackageName";
import axios from "axios";
import mimeTypes from "mime-types";

const publish = async ({
  path: destPath = getPackageName(),
  review,
  version,
}: {
  path?: string;
  review?: string;
  version?: string;
} = {}): Promise<number> => {
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    if (!destPath) {
      return Promise.reject(new Error("`path` argument is required."));
    }

    console.log(
      `Preparing to publish zip to destination ${destPath} as version ${version}`
    );
    process.chdir("dist");
    execSync(`zip -qr ${destPath}.zip .`);
    const opts = {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
      },
    };
    const message = await axios
      .get(
        `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/commits/${process.env.GITHUB_SHA}`,
        opts
      )
      .then((r) => r.data.commit.message as string);
    const release = await axios.post(
      `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/releases`,
      {
        tag_name: version,
        name: message.length > 50 ? `${message.substring(0, 47)}...` : message,
        body: message.length > 50 ? `...${message.substring(47)}` : "",
      },
      opts
    );
    const { tag_name, id } = release.data;

    const assets = fs.readdirSync(".");
    await Promise.all(
      assets
        .filter((f) => f !== "README.md" && f !== "package.json")
        .map((asset) => {
          const content = fs.readFileSync(asset);
          const contentType = mimeTypes.lookup(asset);
          return axios.post(
            `https://uploads.github.com/repos/${process.env.GITHUB_REPOSITORY}/releases/${id}/assets?name=${asset}`,
            content,
            contentType
              ? {
                  ...opts,
                  headers: {
                    ...opts.headers,
                    "Content-Type": contentType,
                  },
                }
              : opts
          );
        })
    );

    console.log(`Successfully created github release for version ${tag_name}`);
    process.chdir("..");
  } else {
    console.warn(
      "No GitHub token set - please set one to create a Github release"
    );
  }

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

const build = (
  args: CliArgs & { dry?: boolean; review?: string; domain?: string } = {}
) => {
  process.env.NODE_ENV = process.env.NODE_ENV || "production";
  const version = toVersion();
  const envExisting = fs.existsSync(".env")
    ? fs.readFileSync(".env").toString()
    : "";
  fs.writeFileSync(
    ".env",
    `${envExisting.replace(/VERSION=[\d-]+\n/gs, "")}VERSION=${version}\n`
  );
  return compile({ ...args, opts: { minify: true } })
    .then(() =>
      args.dry ? Promise.resolve(0) : publish({ review: args.review, version })
    )
    .then((exitCode) => {
      console.log("done");
      return exitCode;
    });
};

export default build;
