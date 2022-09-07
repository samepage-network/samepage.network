import chokidar from "chokidar";
import fs from "fs";
import compile, { CliArgs } from "./internal/compile";
import appPath from "./internal/appPath";
import path from "path";

const dev = ({
  mirror,
  ...cliArgs
}: CliArgs & {
  mirror?: string;
} = {}) => {
  let rebuilder: () => Promise<void>;
  const finish = () => {
    if (mirror) {
      if (!fs.existsSync(mirror)) fs.mkdirSync(mirror, { recursive: true });
      fs.readdirSync("dist").forEach((f) =>
        fs.cpSync(appPath(path.join(`dist`, f)), path.join(mirror, f))
      );
    }
  };
  return new Promise((resolve) => {
    chokidar
      .watch(["src"])
      .on("add", (file) => {
        if (/src\/[a-z]+.tsx?$/.test(file)) {
          console.log(`building ${file}...`);
          compile({ ...cliArgs, nodeEnv: "development" }).then((r) => {
            const { rebuild } = r;
            rebuilder = async () => rebuild && rebuild().then(finish);
            finish();
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
