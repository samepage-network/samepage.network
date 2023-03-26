import esbuild, { BuildOptions } from "esbuild";
import path from "path";
import fs from "fs";
import getDotEnvObject from "./getDotEnvObject";

type Args = {
  outdir?: string;
  functions: string[];
  root?: string;
  define?: Record<string, string>;
  opts?: esbuild.BuildOptions;
};

export const getOpts = ({
  outdir = "build",
  functions,
  root = "api",
  define = getDotEnvObject(),
  opts = {},
}: Args): BuildOptions => ({
  bundle: true,
  outdir,
  platform: "node",
  external: ["aws-sdk", "canvas", "@aws-sdk/*", "esbuild"],
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
              /export\s+default\s+([^\s;]+)/
            )?.[1];
            const contents = defaultExport
              ? `${originalContent}export const handler = ${defaultExport};`
              : originalContent;
            return {
              contents,
              loader: "ts",
            };
          }
        );
      },
    },
  ],
  ...opts,
});

const nodeCompile = (args: Args) => esbuild.build(getOpts(args));

export default nodeCompile;
