import fs from "fs";
import compile, { CliArgs } from "./internal/compile";
import toVersion from "./internal/toVersion";
import { execSync } from "child_process";
import getPackageName from "./internal/getPackageName";
import axios from "axios";
import mimeTypes from "mime-types";
import path from "path";
import { Lambda, GetFunctionResponse } from "@aws-sdk/client-lambda";
import archiver from "archiver";
import crypto from "crypto";
import esbuild from "esbuild";

const publish = async ({
  root = ".",
  review,
  version,
}: {
  root?: string;
  review?: string;
  version?: string;
} = {}): Promise<void> => {
  const token = process.env.GITHUB_TOKEN;
  const destPath = getPackageName();
  if (token) {
    console.log(
      `Preparing to publish zip to destination ${destPath} as version ${version}`
    );
    const cwd = process.cwd();
    process.chdir(path.join(root, "dist"));
    execSync(`zip -qr ${destPath}.zip .`);
    const opts = {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
      },
    };
    const message = await axios
      .get<{ commit: { message: string } }>(
        `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/commits/${process.env.GITHUB_SHA}`,
        opts
      )
      .then((r) => r.data.commit.message)
      .catch((r) =>
        Promise.reject(
          new Error(
            `Failed to read commit message for ${process.env.GITHUB_SHA} in ${
              process.env.GITHUB_REPOSITORY
            }:\n${JSON.stringify(r.response.data || "No response data found")}`
          )
        )
      );
    const release = await axios
      .post(
        `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/releases`,
        {
          tag_name: version,
          name:
            message.length > 50 ? `${message.substring(0, 47)}...` : message,
          body: message.length > 50 ? `...${message.substring(47)}` : "",
        },
        opts
      )
      .catch((r) =>
        Promise.reject(
          new Error(
            `Failed to read post release ${version} for repo ${
              process.env.GITHUB_REPOSITORY
            }:\n${JSON.stringify(r.response.data || "No response data found")}`
          )
        )
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
    process.chdir(cwd);
  } else {
    console.log(
      "No GitHub token set - please set one to create a Github release"
    );
    console.warn(
      "No GitHub token set - please set one to create a Github release"
    );
  }

  const backendOutdir = path.join(root, "out");
  const backendFunctions = fs.existsSync(backendOutdir)
    ? fs.readdirSync(backendOutdir)
    : [];
  if (backendFunctions.length) {
    const lambda = new Lambda({});
    const options = {
      date: new Date("01-01-1970"),
    };
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
              `Function ${FunctionName} not found on trial ${trial} due to ${e}. Trying again...`
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
    const id = destPath.replace(/-samepage$/, "");
    await Promise.all(
      backendFunctions.map((f) => {
        const zip = archiver("zip", { gzip: true, zlib: { level: 9 } });
        console.log(`Zipping ${f}...`);

        zip.file(`${backendOutdir}/${f}.js`, {
          name: `extensions-${id}-${f}_post.js`,
          ...options,
        });
        const shasum = crypto.createHash("sha256");
        const data: Uint8Array[] = [];
        return new Promise((resolve, reject) =>
          zip
            .on("data", (d) => {
              data.push(d);
              shasum.update(d);
            })
            .on("end", () => {
              console.log(`Zip of ${f} complete (${data.length}).`);
              const sha256 = shasum.digest("base64");
              const FunctionName = `samepage-network_extensions-${id}-${f}_post`;
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
                  console.error(`deploy of ${f} failed:`);
                  reject(e);
                });
            })
            .finalize()
        );
      })
    );
  }

  if (review && fs.existsSync(path.join(root, review))) {
    await import(`${root}/${review.replace(/\.[jt]s$/, "")}`).then(
      //@ts-ignore
      (mod) => typeof mod.default === "function" && mod.default()
    );
  }
};

const analyzeMetafile = async (metafile: esbuild.Metafile, root = ".") => {
  const text = await esbuild.analyzeMetafile(metafile);
  const files = text
    .trim()
    .split(/\n/)
    .filter((s) => !!s.trim())
    .map((s) => {
      const file = s.trim();
      const args = /([├└])?\s*([^\s]+)\s*(\d+(?:\.\d)?[kmg]?b)\s*/.exec(file);
      if (!args) throw new Error(`Failed to parse ${file} from metadata`);
      const [_, isFile, fileName, size] = args;
      if (!fileName)
        throw new Error(`Failed to parse filename from ${file} in metadata`);
      return { isFile, fileName, size };
    });
  type TreeNode = {
    fileName: string;
    size: number;
    children: TreeNode[];
  };
  const parseSize = (s: string) => {
    const [_, value, unit] = /(\d+(?:\.\d)?)([kmg]?b)/.exec(s) || ["0", "b"];
    const mult =
      unit === "gb"
        ? 1000000000
        : unit === "mb"
        ? 1000000
        : unit === "kb"
        ? 1000
        : 1;
    return mult * Number(value);
  };
  const tree: TreeNode[] = [];
  let maxLength = 0;
  files.forEach((file) => {
    maxLength = Math.max(maxLength, file.fileName.length);
    if (file.isFile) {
      let root = tree.slice(-1)[0];
      const parts = file.fileName.split("/");
      parts.forEach((_, index, all) => {
        const fileName = all.slice(0, index + 1).join("/");
        const size = parseSize(file.size);
        const treeNode = root.children.find((c) => c.fileName === fileName);
        if (treeNode) {
          treeNode.size += size;
          root = treeNode;
        } else {
          const newRoot = { children: [], fileName, size };
          root.children.push(newRoot);
          root = newRoot;
        }
      });
    } else {
      tree.push({
        children: [],
        fileName: file.fileName,
        size: parseSize(file.size),
      });
    }
  });
  const calcSize = (t: TreeNode) => {
    if (t.children.length) {
      t.size = t.children.reduce((p, c) => p + calcSize(c), 0);
    }
    return t.size;
  };
  tree.forEach(calcSize);
  const printTree = (t: TreeNode[], level = 0): string[] =>
    t
      .sort((a, b) => b.size - a.size)
      .flatMap((tn) => {
        const indent = "".padStart(level * 2, " ");
        return [
          `${indent}${level ? "├ " : ""}${tn.fileName.padEnd(
            maxLength + (level ? 6 : 8) - indent.length
          )}${(tn.size >= 1000000000
            ? `${(tn.size / 1000000000).toFixed(1)}gb`
            : tn.size >= 1000000
            ? `${(tn.size / 1000000).toFixed(1)}mb`
            : tn.size >= 1000
            ? `${(tn.size / 1000).toFixed(1)}kb`
            : `${tn.size}b `
          ).padStart(7, " ")}`,
          ...printTree(tn.children, level + 1),
        ];
      });
  fs.writeFileSync(path.join(root, "analyze.txt"), printTree(tree).join("\n"));
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
  return compile({
    ...args,
    builder: (opts) =>
      esbuild
        .build({
          ...opts,
          minify: true,
        })
        .then(async (r) => {
          if (!r.metafile) return;
          return analyzeMetafile(r.metafile, args.root);
        }),
  })
    .then(() =>
      args.dry
        ? Promise.resolve()
        : publish({
            review: args.review,
            version,
            root: args.root,
          })
    )
    .then(() => {
      console.log("done");
      return 0;
    });
};

export default build;
