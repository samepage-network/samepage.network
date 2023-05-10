import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import os from "os";
import { z } from "zod";
import appPath from "./appPath";
import dotenv from "dotenv";
import toVersion from "./toVersion";
import readDir from "./readDir";
import { getOpts as getNodeOpts } from "./nodeCompile";
import getDotEnvObject from "./getDotEnvObject";
import esbuildPlugins from "./esbuildPlugins";
// @ts-ignore
import { build as tw } from "tailwindcss/lib/cli/build";
dotenv.config();

// TODO - Move this to a central location
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      API_URL: string;
      CLERK_PUBLISHABLE_KEY: string;
      GITHUB_TOKEN: string;
      NODE_ENV: "development" | "production" | "test";
      ORIGIN: string;
      STRIPE_PUBLIC_KEY: string;
      STRIPE_SECRET_KEY: string;
      SVIX_SECRET: string;
    }
  }
}

export type CliOpts = Record<string, string | string[] | boolean>;

const cliArgs = z.object({
  out: z.string().optional(),
  root: z.string().optional(),
  external: z.union([z.string(), z.string().array()]).optional(),
  include: z.union([z.string(), z.string().array()]).optional(),
  css: z.string().optional(),
  format: z.enum(["iife", "cjs", "esm"]).optional(),
  mirror: z.string().optional(),
  analyze: z.boolean().optional(),
  max: z.string().optional(),
  finish: z.string().optional(),
  entry: z.union([z.string(), z.string().array()]).optional(),
  extends: z.string().optional(),
});

export type CliArgs = z.infer<typeof cliArgs>;

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
          if (fs.existsSync(global)) {
            return {
              contents: fs.readFileSync(global).toString(),
              loader: "js",
              resolveDir: path.dirname(global),
            };
          }
          return {
            contents: `module.exports = ${global};`,
            loader: "js",
            resolveDir: process.cwd(),
          };
        }
      );
    },
  };
};

const DEFAULT_FILES_INCLUDED = ["package.json", "README.md"];

type Builder = (opts: esbuild.BuildOptions) => Promise<void>;
const compile = ({
  builder = async (opts) => {
    await esbuild.build(opts);
  },
  opts,
}: {
  opts: CliOpts;
  builder?: Builder;
}) => {
  const {
    root = ".",
    out,
    external,
    include,
    css,
    format,
    mirror,
    analyze,
    finish: onFinishFile = "",
    entry = [],
  } = cliArgs.parse(opts);

  const srcRoot = path.join(root, "src");
  const apiRoot = path.join(root, "api");
  const rootDir = fs
    .readdirSync(srcRoot, { withFileTypes: true })
    .filter((f) => f.isFile())
    .map((f) => f.name);
  const rootTs = rootDir.filter((f) => /\.tsx?$/.test(f));
  const rootCss = rootDir.filter((f) => /\.css$/.test(f));
  const entryTs =
    rootTs.length === 1
      ? rootTs[0]
      : ["index.ts", "main.ts"].find((f) => rootTs.includes(f));
  const entryCss =
    rootCss.length === 1
      ? rootCss[0]
      : ["index.css", "main.css"].find((f) => rootCss.includes(f));
  const externalModules = (
    typeof external === "string" ? [external] : external || []
  ).map((e) => e.split("="));
  const outdir = path.join(root, "dist");
  const envObject = getDotEnvObject();
  const apiFunctions = fs.existsSync(apiRoot)
    ? readDir(apiRoot).map((f) => f.replace(/^api\//, "").replace(/\.ts$/, ""))
    : [];
  const backendOutdir = path.join(root, "out");

  return Promise.all(
    ([] as Promise<void>[])
      .concat(
        entryTs
          ? [
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
                  "process.env.ORIGIN":
                    process.env.NODE_ENV === "production"
                      ? '"https://samepage.network"'
                      : '"http://localhost:3000"',
                  ...envObject,
                },
                format,
                entryNames: out,
                external: externalModules.map(([e]) => e).concat(["crypto"]),
                plugins: [
                  importAsGlobals(
                    Object.fromEntries(
                      externalModules
                        .filter((e) => e.length > 1)
                        .map(([e, ...g]) => [e, g.join("=")])
                    )
                  ),
                  {
                    name: "tailwind",
                    setup(build) {
                      build.onResolve({ filter: /samepage\.css$/ }, () => {
                        return {
                          path: "samepage.css",
                          namespace: "samepage",
                        };
                      });
                      build.onLoad(
                        { filter: /samepage\.css$/, namespace: "samepage" },
                        async () => {
                          const out = path.join(os.tmpdir(), "tailwind.css");
                          await tw({
                            _: ["build"],
                            "--config": path.resolve(
                              path.join(__dirname, ".."),
                              "tailwind.config.js"
                            ),
                            "--output": out,
                          });
                          return {
                            // TODO - rid of blueprint once we cut over fully to our own component library
                            contents: `@import "normalize.css";\n@import "@blueprintjs/core/lib/css/blueprint.css";\n${fs
                              .readFileSync(out)
                              .toString()}`,
                            loader: "css",
                            resolveDir: process.cwd(),
                          };
                        }
                      );
                    },
                  },
                  ...esbuildPlugins("src"),
                  {
                    name: "onFinish",
                    setup(build) {
                      build.onEnd(async () => {
                        DEFAULT_FILES_INCLUDED.concat(
                          typeof include === "string"
                            ? [include]
                            : include || []
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
                            console.warn(
                              `No css files in the ${outdir} directory`
                            );
                          } else if (inputCssFiles.length === 1) {
                            fs.renameSync(
                              path.join(outdir, inputCssFiles[0]),
                              outCssFilename
                            );
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
                                fs.appendFileSync(
                                  outCssFilename,
                                  cssFileContent
                                );
                                fs.appendFileSync(outCssFilename, "\n");
                              }
                            });
                            // hoist all imports to the top
                            const outlines = fs
                              .readFileSync(outCssFilename)
                              .toString()
                              .split("\n");
                            const imports = outlines.filter((l) =>
                              l.startsWith("@import")
                            );
                            const rest = outlines.filter(
                              (l) => !l.startsWith("@import")
                            );
                            fs.writeFileSync(
                              outCssFilename,
                              imports.concat(rest).join("\n")
                            );
                          }
                        }
                        if (
                          onFinishFile &&
                          fs.existsSync(path.join(root, onFinishFile))
                        ) {
                          const customOnFinish = require(path.resolve(
                            path.join(root, onFinishFile)
                          ));
                          if (typeof customOnFinish === "function") {
                            customOnFinish();
                          }
                        }
                        if (mirror) {
                          const mirrorPath = path.resolve(root, mirror);
                          if (!fs.existsSync(mirrorPath))
                            fs.mkdirSync(mirrorPath, { recursive: true });
                          readDir(outdir).forEach((f) => {
                            fs.cpSync(
                              appPath(f),
                              path.join(mirrorPath, path.relative(outdir, f))
                            );
                          });
                        }
                      });
                    },
                  },
                ],
                metafile: analyze,
                loader: {
                  ".woff": "file",
                  ".woff2": "file",
                  ".yaml": "text",
                },
              }),
            ]
          : []
      )
      .concat(
        apiFunctions.length
          ? [
              builder(
                getNodeOpts({
                  outdir: backendOutdir,
                  functions: apiFunctions,
                  root: apiRoot,
                  define: envObject,
                  external: externalModules
                    .filter((e) => e.length === 1)
                    .map((e) => e[0]),
                })
              ),
            ]
          : []
      )
  );
};

export default compile;
