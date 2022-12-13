import chokidar from "chokidar";
import compile, { CliArgs } from "./internal/compile";
import type { BuildInvalidate } from "esbuild";

const dev = (args: CliArgs) => {
  let rebuilder: BuildInvalidate | undefined;
  process.env.NODE_ENV = process.env.NODE_ENV || "development";
  return new Promise((resolve) => {
    chokidar
      .watch(["src"])
      .on("add", (file) => {
        if (/src[\\/][a-z]+.tsx?$/.test(file)) {
          console.log(`building ${file}...`);
          compile({ ...args, opts: { incremental: true } }).then((r) => {
            const { rebuild } = r;
            rebuilder = rebuild;
            console.log(`successfully built ${file}...`);
          });
        }
      })
      .on("change", (file) => {
        console.log(`File ${file} has been changed`);
        if (rebuilder) {
          rebuilder()
            .then(() => console.log(`Rebuilt extension`))
            .catch((e) => console.error(`Failed to rebuild`, file, e));
        }
      });
    process.on("exit", resolve);
  }).then(() => 0);
};

export default dev;
