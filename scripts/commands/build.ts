import { build as esbuild } from "esbuild";
import { build as remixBuild } from "@remix-run/dev/dist/cli/commands";
import getDotEnvObject from "../../package/scripts/internal/getDotEnvObject";

// HOW WOULD I BUNDLE TAILWIND?
//
//   await tailwindcss({
//     content: ["./app/**/*.tsx", ...(content || [])],
//     theme: theme || { extend: {} },
//     ...config,
//   });


type BuildArgs = {
  readable?: boolean;
};

const build = async (args: BuildArgs = {}): Promise<number> => {
  process.env.NODE_ENV = process.env.NODE_ENV || "production";

  return remixBuild(process.cwd(), process.env.NODE_ENV)
    .then(() =>
      esbuild({
        bundle: true,
        outdir: "out",
        platform: "node",
        target: "node14",
        entryPoints: ["app/server/index.ts"],
        external: [
          "aws-sdk",
          // "@aws-sdk/*" - when node18 is live on Lambda@Edge
        ],
        minify: !args.readable,
        define: getDotEnvObject(),
      })
    )
    .then(() => 0);
};

export default build;
