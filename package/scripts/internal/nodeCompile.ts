import esbuild from "esbuild";
import path from "path";
import fs from "fs";

const IGNORE_ENV = ["HOME"];
const getDotEnvObject = (): Record<string, string> => {
  const env = {
    ...Object.fromEntries(
      Object.entries(process.env)
        .filter(([k]) => !/[()]/.test(k))
        .filter(([k]) => !IGNORE_ENV.includes(k))
    ),
  };
  return Object.fromEntries(
    Object.keys(env).map((k) => [`process.env.${k}`, JSON.stringify(env[k])])
  );
};

const nodeCompile = ({
  outdir = "build",
  functions,
  root = "api",
  define = getDotEnvObject(),
  opts = {},
}: {
  outdir?: string;
  functions: string[];
  root?: string;
  define?: Record<string, string>;
  opts?: esbuild.BuildOptions;
}) =>
  esbuild.build({
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

export default nodeCompile;
