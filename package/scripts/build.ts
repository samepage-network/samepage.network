import fs from "fs";
import compile, { CliOpts } from "./internal/compile";
import toVersion from "./internal/toVersion";
import { execSync } from "child_process";
import getPackageName from "./internal/getPackageName";
import axios from "axios";
import mimeTypes from "mime-types";
import path from "path";
import esbuild from "esbuild";
import appPath from "./internal/appPath";
import updateLambdaFunctions from "./internal/updateLambdaFunctions";
import { z } from "zod";

const publish = async ({
  api,
  root = ".",
  review,
  version,
}: {
  api?: string;
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
      .catch((r) => {
        const { data } = r.response;
        if (data && data.errors && data.errors[0].code === "already_exists") {
          return axios.get(
            `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/releases/tags/${version}`,
            opts
          );
        }
        return Promise.reject(
          new Error(
            `Failed to read post release ${version} for repo ${
              process.env.GITHUB_REPOSITORY
            }:\n${JSON.stringify(data || "No response data found")}`
          )
        );
      });
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
    console.warn(
      "No GitHub token set - please set one to create a Github release"
    );
  }

  await updateLambdaFunctions({
    api,
    out: "out",
    root,
    prefix: `extensions-${destPath.replace(/-samepage$/, "")}-`,
  });

  if (review && fs.existsSync(path.join(root, review))) {
    await import(appPath(`${root}/${review.replace(/\.[jt]s$/, "")}`)).then(
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

const zBuildArgs = z.object({
  root: z.string().optional(),
  dry: z.boolean().optional(),
  review: z.string().optional(),
  domain: z.string().optional(),
  api: z.string().optional(),
});

const build = (args: CliOpts = {}) => {
  const { root, review, api } = zBuildArgs.parse(args);
  process.env.NODE_ENV = process.env.NODE_ENV || "production";
  process.env.ORIGIN = process.env.ORIGIN || "https://samepage.network";
  const version = toVersion();
  const envExisting = fs.existsSync(".env")
    ? fs.readFileSync(".env").toString()
    : "";
  fs.writeFileSync(
    ".env",
    `${envExisting.replace(/VERSION=[\d.-]+\n/gs, "")}VERSION=${version}\n`
  );
  return compile({
    opts: args,
    builder: (opts) =>
      esbuild
        .build({
          ...opts,
          minify: true,
        })
        .then(async (r) => {
          if (!r.metafile) return;
          return analyzeMetafile(r.metafile, root);
        }),
  })
    .then(() =>
      args.dry
        ? Promise.resolve()
        : publish({
            review,
            version,
            root,
            api,
          })
    )
    .then(() => {
      console.log("done");
      return 0;
    });
};

export default build;
