import api from "./api";
import dev from "./dev";
import yaml from "yaml";
import { homedir } from "os";
import path from "path";
import fs from "fs";
import ngrok from "ngrok";

const start = async ({}: {} = {}) => {
  const configPath = path.join(homedir(), ".ngrok2", "ngrok.yml");
  const config = yaml.parse(fs.readFileSync(configPath).toString());
  config.tunnels = {
    dev: {
      proto: "http",
      addr: 3000,
      hostname: "samepage-app.ngrok.io",
    },
    api: {
      proto: "http",
      addr: 3003,
      hostname: "samepage.ngrok.io",
    },
  };
  fs.writeFileSync(configPath, yaml.stringify(config));
  setTimeout(() => {
    ngrok
      .connect({
        configPath,
        onLogEvent: (data) => {
          console.log("[ngrok]", data);
        },
      })
      .then(console.log);
  }, 5000);
  return Promise.all([api(), dev()]).then(() => 0);
};

export default start;
