import esbuild, { BuildOptions } from "esbuild";
import path from "path";
import fs from "fs";
import getDotEnvObject from "./getDotEnvObject";
import esbuildPlugins from "./esbuildPlugins";

type Args = {
  outdir?: string;
  functions: string[];
  root?: string;
  define?: Record<string, string>;
  opts?: esbuild.BuildOptions;
  external?: string[];
};

const jsdomPatch: esbuild.Plugin = {
  name: "jsdom-patch",
  setup: (build) => {
    build.onLoad({ filter: /XMLHttpRequest-impl\.js$/ }, async (args) => {
      let contents = await fs.promises.readFile(args.path, "utf8");

      contents = contents.replace(
        'const syncWorkerFile = require.resolve ? require.resolve("./xhr-sync-worker.js") : null;',
        `const syncWorkerFile = null;`
      );

      return { contents, loader: "js" };
    });
  },
};

export const getOpts = ({
  outdir = "build",
  functions,
  root = "api",
  define = getDotEnvObject(),
  opts = {},
  external = [],
}: Args): BuildOptions => ({
  bundle: true,
  outdir,
  platform: "node",
  external: ["aws-sdk", "canvas", "@aws-sdk/*", "esbuild"].concat(external),
  define,
  entryPoints: Object.fromEntries(
    functions.map((f) => [f, path.join(root, `${f}.ts`)])
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
            const originalContent = fs.readFileSync(args.path).toString();
            const defaultExport = originalContent.match(
              /export\s+default\s+([^;]+);/s
            )?.[1];
            const contents = defaultExport
              ? `${originalContent}export const handler = ${defaultExport}`
              : originalContent;
            return {
              contents,
              loader: "ts",
            };
          }
        );
      },
    },
    jsdomPatch,
    ...esbuildPlugins("api"),
  ],
  ...opts,
});

const nodeCompile = (args: Args) => esbuild.build(getOpts(args));

export default nodeCompile;
