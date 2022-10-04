import nearleyCompile from "./nearley";
import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import appPath from "./appPath";
import dotenv from "dotenv";
import toVersion from "./toVersion";
dotenv.config();

// Why is this not picked up from Remix?
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: "development" | "production" | "test";
    }
  }
}

// TODO - import from fuegojs/utils/readDir
const readDir = (s: string): string[] =>
  fs.existsSync(s)
    ? fs
        .readdirSync(s, { withFileTypes: true })
        .flatMap((f) =>
          f.isDirectory() ? readDir(`${s}/${f.name}`) : [`${s}/${f.name}`]
        )
    : [];

export type CliArgs = {
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
  version,
  finish: onFinishFile,
}: CliArgs & { opts?: esbuild.BuildOptions; version?: string }) => {
  const rootDir = fs
    .readdirSync("./src", { withFileTypes: true })
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

  return esbuild
    .build({
      absWorkingDir: process.cwd(),
      entryPoints: out
        ? {
            [out]: `./src/${entryTs}`,
            ...(entryCss ? { [out]: `./src/${entryCss}` } : {}),
          }
        : [`./src/${entryTs}`, ...(entryCss ? [`./src/${entryCss}`] : [])],
      outdir: "dist",
      bundle: true,
      define: {
        "process.env.BLUEPRINT_NAMESPACE": '"bp4"',
        "process.env.NODE_ENV": `"${process.env.NODE_ENV}"`,
        "process.env.VERSION": `"${version}"`,
        ...Object.fromEntries(
          (typeof env === "string" ? [env] : env || []).map((s) => [
            `process.env.${s}`,
            `"${process.env[s]}"`,
          ])
        ),
      },
      format,
      external: externalModules.map(([e]) => e),
      plugins: [
        {
          name: "nearley",
          setup(build) {
            build.onResolve({ filter: /\.ne$/ }, (args) => ({
              path: path.resolve(args.resolveDir, args.path),
              namespace: "nearley-ns",
            }));
            build.onLoad({ filter: /.*/, namespace: "nearley-ns" }, (args) =>
              nearleyCompile(args.path).then((contents) => ({
                contents,
                loader: "ts",
                resolveDir: path.dirname(args.path),
              }))
            );
          },
        },
        importAsGlobals(
          Object.fromEntries(externalModules.filter((e) => e.length === 2))
        ),
      ],
      metafile: analyze,
      ...opts,
    })
    .then((r) => {
      const finish = () => {
        DEFAULT_FILES_INCLUDED.concat(
          typeof include === "string" ? [include] : include || []
        )
          .filter((f) => fs.existsSync(f))
          .forEach((f) => {
            fs.cpSync(f, path.join("dist", path.basename(f)));
          });
        const distributedPackageJson = path.join("dist", "package.json");
        fs.writeFileSync(
          distributedPackageJson,
          fs
            .readFileSync(distributedPackageJson)
            .toString()
            .replace(
              /"version": "[\d.-]+",/,
              `"version": "${version || toVersion()}",`
            )
        );
        if (css) {
          const outCssFilename = path.join(
            "dist",
            `${css.replace(/.css$/, "")}.css`
          );
          const inputCssFiles = fs
            .readdirSync("dist")
            .filter((f) => /.css$/.test(f));

          if (inputCssFiles.length === 0) {
            console.warn("No css files in the dist/ directory");
          } else if (inputCssFiles.length === 1) {
            fs.renameSync(path.join("dist", inputCssFiles[0]), outCssFilename);
          } else {
            const baseOutput = path.basename(outCssFilename);
            if (!inputCssFiles.includes(baseOutput))
              fs.writeFileSync(outCssFilename, "");
            inputCssFiles.forEach((f) => {
              if (baseOutput !== f) {
                const cssFileContent = fs
                  .readFileSync(path.join("dist", f))
                  .toString();
                fs.rmSync(path.join("dist", f));
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
        if (fs.existsSync(`${process.cwd()}/${onFinishFile}`)) {
          const customOnFinish = require(`${process.cwd()}/${onFinishFile}`);
          if (typeof customOnFinish === "function") {
            customOnFinish();
          }
        }
        if (mirror) {
          if (!fs.existsSync(mirror)) fs.mkdirSync(mirror, { recursive: true });
          readDir("dist").forEach((f) =>
            fs.cpSync(appPath(f), path.join(mirror, f.replace(/^dist\//, "")))
          );
        }
      };
      finish();
      const { rebuild: rebuilder } = r;
      return rebuilder
        ? {
            ...r,
            rebuild: (() =>
              rebuilder()
                .then(finish)
                .then(() => rebuilder)) as esbuild.BuildInvalidate,
          }
        : r;
    });
};

export default compile;
