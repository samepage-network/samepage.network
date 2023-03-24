import { build as esbuild } from "esbuild";
import { build as remixBuild } from "@remix-run/dev/dist/cli/commands";
import getDotEnvObject from "../../package/scripts/internal/getDotEnvObject";
import { execSync } from "child_process";

type BuildArgs = {
  readable?: boolean;
};

const build = async (args: BuildArgs = {}): Promise<number> => {
  process.env.NODE_ENV = process.env.NODE_ENV || "production";

  // TODO - Future versions of Remix have native Tailwind support
  execSync("npx tailwindcss -o ./app/tailwind.css --minify", {
    stdio: "inherit",
  });

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
