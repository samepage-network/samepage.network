#!/usr/bin/env node
// import new from "./commands/new";
import build from "./commands/build";
import deploy from "./commands/deploy";
import dev from "./commands/dev";
import compile from "./commands/compile";
import update from "./commands/update";
import api from "./commands/api";
import apply from "./commands/apply";
import plan from "./commands/plan";
import packageCmd from "./commands/package";
import dotenv from "dotenv";
dotenv.config();

const run = async (command: string, args: string[]): Promise<number> => {
  const opts = args
    .map(
      (a, i) =>
        [
          a,
          args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true,
        ] as const
    )
    .filter(([k]) => k.startsWith("--"))
    .map(
      ([k, v]) =>
        [
          k
            .replace(/^--/, "")
            .split(/-/g)
            .map((s, i) =>
              i === 0
                ? s
                : `${s.substring(0, 1).toUpperCase()}${s.substring(1)}`
            )
            .join(""),
          v,
        ] as const
    )
    .reduce((prev, [k, v]) => {
      const prevK = prev[k];
      if (v === true) {
        prev[k] = v;
      } else if (prevK) {
        if (typeof prevK === "string") {
          prev[k] = [prevK, v];
        } else if (prevK !== true) {
          prev[k] = [...prevK, v];
        }
      } else {
        prev[k] = v;
      }
      return prev;
    }, {} as Record<string, string | string[] | boolean>);
  switch (command) {
    // APP
    case "build":
      return build(opts);
    case "deploy":
      return deploy(opts);
    case "dev":
      return dev(opts);

    // API
    case "compile":
      return compile(opts);
    case "update":
      return update(opts);
    case "api":
      return api(opts);

    // DATA
    case "plan":
      return plan(opts);
    case "apply":
      return apply(opts);
    // case "sync":
    //   console.log("Coming soon!");
    //   return 0;

    // NPM
    case "package":
      return packageCmd(opts);

    // MISC
    // case "init":
    //   return init(opts);
    // case "postinstall":
    //   return postinstall();
    // case "test":
    //   console.log("Coming soon!");
    //   return 0;
    // case "start":
    //   console.log("Coming soon!");
    //   return 0;
    default:
      console.error("Command", command, "is unsupported");
      return 1;
  }
};

run(process.argv[2], process.argv.slice(3))
  .then((code) => code >= 0 && process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
