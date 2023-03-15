import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import appPath from "./appPath";
import dotenv from "dotenv";
import toVersion from "./toVersion";
import readDir from "./readDir";
dotenv.config();

// TODO - Move this to a central location
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      GITHUB_TOKEN: string;
      NODE_ENV: "development" | "production" | "test";
      STRIPE_SECRET_KEY: string;
      SVIX_SECRET: string;
    }
  }
}

export type CliArgs = {
  root?: string;
  out?: string;
  external?: string | string[];
  include?: string | string[];
  css?: string;
  format?: esbuild.Format;
  mirror?: string;
  env?: string | string[];
  analyze?: boolean;
  max?: string;
  finish?: string;
  entry?: string | string[];
};

// https://github.com/evanw/esbuild/issues/337#issuecomment-954633403
const importAsGlobals = (
  mapping: Record<string, string> = {}
): esbuild.Plugin => {
  const escRe = (s: string) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  const filter = new RegExp(
    Object.keys(mapping).length
      ? Object.keys(mapping)
          .map((mod) => `^${escRe(mod)}$`)
          .join("|")
      : /$^/
  );

  return {
    name: "global-imports",
    setup(build) {
      build.onResolve({ filter }, (args) => {
        if (!mapping[args.path]) {
          throw new Error("Unknown global: " + args.path);
        }
        return {
          path: args.path,
          namespace: "external-global",
        };
      });

      build.onLoad(
        {
          filter,
          namespace: "external-global",
        },
        async (args) => {
          const global = mapping[args.path];
          return {
            contents: `module.exports = ${global};`,
            loader: "js",
          };
        }
      );
    },
  };
};

const DEFAULT_FILES_INCLUDED = ["package.json", "README.md"];

const compile = ({
  out,
  external,
  include,
  css,
  format,
  mirror,
  env,
  analyze,
  opts = {},
  finish: onFinishFile = "",
  root = ".",
  entry = [],
}: CliArgs & { opts?: esbuild.BuildOptions }) => {
  const srcRoot = path.join(root, "src");
  const functionsRoot = path.join(srcRoot, "functions");
  const rootDir = fs
    .readdirSync(srcRoot, { withFileTypes: true })
    .filter((f) => f.isFile())
    .map((f) => f.name);
  const rootTs = rootDir.filter((f) => /\.ts$/.test(f));
  const rootCss = rootDir.filter((f) => /\.css$/.test(f));
  const entryTs =
    rootTs.length === 1
      ? rootTs[0]
      : ["index.ts", "main.ts"].find((f) => rootTs.includes(f));
  const entryCss =
    rootCss.length === 1
      ? rootCss[0]
      : ["index.css", "main.css"].find((f) => rootCss.includes(f));
  if (!entryTs) {
    return Promise.reject(
      `Could not find a suitable entry file in ./src directory. Found: [${rootTs.join(
        ", "
      )}]`
    );
  }
  const externalModules = (
    typeof external === "string" ? [external] : external || []
  ).map((e) => e.split("="));
  const outdir = path.join(root, "dist");
  const envObject = Object.fromEntries(
    (typeof env === "string" ? [env] : env || [])
      .filter((s) => !!process.env[s])
      .map((s) => [`process.env.${s}`, `"${process.env[s]}"`])
  );
  const backendFunctions = fs.existsSync(functionsRoot)
    ? fs.readdirSync(functionsRoot).map((f) => f.replace(/\.ts$/, ""))
    : [];
  const backendOutdir = path.join(root, "out");

  return Promise.all(
    [
      esbuild.build({
        absWorkingDir: process.cwd(),
        entryPoints: [
          path.join(srcRoot, entryTs),
          ...(typeof entry === "string" ? [entry] : entry).map((e) =>
            path.join(srcRoot, e)
          ),
          ...(entryCss ? [path.join(srcRoot, entryCss)] : []),
        ],
        outdir,
        bundle: true,
        sourcemap:
          process.env.NODE_ENV === "production"
            ? undefined
            : process.env.NODE_ENV === "test"
            ? "linked"
            : "inline",
        define: {
          "process.env.BLUEPRINT_NAMESPACE": '"bp4"',
          "process.env.NODE_ENV": `"${process.env.NODE_ENV}"`,
          "process.env.VERSION": `"${toVersion()}"`,
          ...envObject,
        },
        format,
        entryNames: out,
        external: externalModules.map(([e]) => e).concat(["crypto"]),
        plugins: [
          importAsGlobals(
            Object.fromEntries(externalModules.filter((e) => e.length === 2))
          ),
        ],
        metafile: analyze,
        ...opts,
      }),
    ].concat(
      backendFunctions.length
        ? esbuild.build({
            bundle: true,
            outdir: backendOutdir,
            platform: "node",
            external: ["aws-sdk", "canvas", "@aws-sdk/*"],
            define: envObject,
            entryPoints: Object.fromEntries(
              backendFunctions.map((f) => [
                f,
                path.join(functionsRoot, `${f}.ts`),
              ])
            ),
            plugins: [
              {
                name: "lambda-adapter",
                setup(build) {
                  build.onLoad(
                    {
                      filter: /^.*\.ts$/,
                    },
                    async (args) => {
                      const originalContent = fs
                        .readFileSync(args.path)
                        .toString();
                      const defaultExport = originalContent.match(
                        /export\s+default\s+([^\s;]+)/
                      )?.[1];
                      const contents = defaultExport
                        ? `${originalContent}export const handler = ${defaultExport};`
                        : originalContent;
                      return {
                        contents,
                        loader: "js",
                      };
                    }
                  );
                },
              },
            ],
          })
        : []
    )
  ).then(async ([r]) => {
    if (r.metafile) {
      const text = await esbuild.analyzeMetafile(r.metafile);
      const files = text
        .trim()
        .split(/\n/)
        .filter((s) => !!s.trim())
        .map((s) => {
          const file = s.trim();
          const args = /([├└])?\s*([^\s]+)\s*(\d+(?:\.\d)?[kmg]?b)\s*/.exec(
            file
          );
          if (!args) throw new Error(`Failed to parse ${file} from metadata`);
          const [_, isFile, fileName, size] = args;
          if (!fileName)
            throw new Error(
              `Failed to parse filename from ${file} in metadata`
            );
          return { isFile, fileName, size };
        });
      type TreeNode = {
        fileName: string;
        size: number;
        children: TreeNode[];
      };
      const parseSize = (s: string) => {
        const [_, value, unit] = /(\d+(?:\.\d)?)([kmg]?b)/.exec(s) || [
          "0",
          "b",
        ];
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
      fs.writeFileSync(
        path.join(root, "analyze.txt"),
        printTree(tree).join("\n")
      );
    }
    const finish = () => {
      DEFAULT_FILES_INCLUDED.concat(
        typeof include === "string" ? [include] : include || []
      )
        .map((f) => path.join(root, f))
        .filter((f) => fs.existsSync(f))
        .forEach((f) => {
          fs.cpSync(f, path.join(outdir, path.basename(f)));
        });
      if (css) {
        const outCssFilename = path.join(
          outdir,
          `${css.replace(/.css$/, "")}.css`
        );
        const inputCssFiles = fs
          .readdirSync(outdir)
          .filter((f) => /.css$/.test(f));

        if (inputCssFiles.length === 0) {
          console.warn(`No css files in the ${outdir} directory`);
        } else if (inputCssFiles.length === 1) {
          fs.renameSync(path.join(outdir, inputCssFiles[0]), outCssFilename);
        } else {
          const baseOutput = path.basename(outCssFilename);
          if (!inputCssFiles.includes(baseOutput))
            fs.writeFileSync(outCssFilename, "");
          inputCssFiles.sort().forEach((f) => {
            if (baseOutput !== f) {
              const cssFileContent = fs
                .readFileSync(path.join(outdir, f))
                .toString();
              fs.rmSync(path.join(outdir, f));
              fs.appendFileSync(outCssFilename, cssFileContent);
              fs.appendFileSync(outCssFilename, "\n");
            }
          });
          // hoist all imports to the top
          const outlines = fs
            .readFileSync(outCssFilename)
            .toString()
            .split("\n");
          const imports = outlines.filter((l) => l.startsWith("@import"));
          const rest = outlines.filter((l) => !l.startsWith("@import"));
          fs.writeFileSync(outCssFilename, imports.concat(rest).join("\n"));
        }
      }
      if (onFinishFile && fs.existsSync(path.join(root, onFinishFile))) {
        const customOnFinish = require(path.resolve(
          path.join(root, onFinishFile)
        ));
        if (typeof customOnFinish === "function") {
          customOnFinish();
        }
      }
      if (mirror) {
        if (!fs.existsSync(mirror)) fs.mkdirSync(mirror, { recursive: true });
        readDir(outdir).forEach((f) =>
          fs.cpSync(appPath(f), path.join(mirror, path.relative(outdir, f)))
        );
      }
    };
    finish();
    const { rebuild: rebuilder } = r;
    return rebuilder
      ? {
          rebuild: () => rebuilder().then(finish),
          backendFunctions,
        }
      : { rebuild: () => Promise.resolve(), backendFunctions };
  });
};

export default compile;
