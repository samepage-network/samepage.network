import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import appPath from "./appPath";
import dotenv from "dotenv";
import toVersion from "./toVersion";
import readDir from "./readDir";
import { getOpts as getNodeOpts } from "./nodeCompile";
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
  builder = async (opts) => {
    await esbuild.build(opts);
  },
}: CliArgs & {
  opts?: esbuild.BuildOptions;
  builder?: (opts: esbuild.BuildOptions) => Promise<void>;
}) => {
  const srcRoot = path.join(root, "src");
  const apiRoot = path.join(srcRoot, "api");
  const legacyApiRoot = path.join(srcRoot, "functions");
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
  const apiFunctions = fs.existsSync(apiRoot)
    ? fs.readdirSync(apiRoot).map((f) => f.replace(/\.ts$/, ""))
    : [];
  const legacyApiFunctions = fs.existsSync(legacyApiRoot)
    ? fs.readdirSync(legacyApiRoot).map((f) => f.replace(/\.ts$/, ""))
    : [];
  const backendOutdir = path.join(root, "out");

  return Promise.all(
    [
      builder({
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
    ]
      .concat(
        apiFunctions.length
          ? [
              builder(
                getNodeOpts({
                  outdir: backendOutdir,
                  functions: apiFunctions,
                  root: apiRoot,
                  define: envObject,
                })
              ),
            ]
          : []
      )
      .concat(
        legacyApiFunctions.length
          ? [
              builder(
                getNodeOpts({
                  outdir: backendOutdir,
                  functions: legacyApiFunctions,
                  root: legacyApiRoot,
                  define: envObject,
                })
              ),
            ]
          : []
      )
  ).then(async () => {
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
        const outlines = fs.readFileSync(outCssFilename).toString().split("\n");
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
    const backendFunctions = apiFunctions.concat(legacyApiFunctions);
    return process.env.NODE_ENV === "development"
      ? {
          backendFunctions,
        }
      : { backendFunctions };
  });
};

export default compile;
