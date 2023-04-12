import api from "./api";
import dev from "./dev";
import yaml from "yaml";
import { homedir } from "os";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import debug from "../../package/utils/debugger";

const log = debug("ngrok");

const start = async ({}: {} = {}) => {
  const configPath = path.join(homedir(), ".ngrok2", "ngrok.yml");
  const config = yaml.parse(fs.readFileSync(configPath).toString());
  config.tunnels = {
    dev: {
      proto: "http",
      addr: 3000,
      hostname: "samepage.ngrok.io",
    },
    api: {
      proto: "http",
      addr: 3003,
      hostname: "api.samepage.ngrok.io",
    },
  };
  fs.writeFileSync(configPath, yaml.stringify(config));
  setTimeout(() => {
    const proc = spawn("ngrok", ["start", "--all", "--log=stdout"]);
    proc.stdout.on("data", (data) => log(data));
    proc.stdout.on("error", (data) => console.error(data));
  }, 3000);
  return Promise.all([api({ local: true }), dev({ local: true })]).then(
    () => 0
  );
};

export default start;
