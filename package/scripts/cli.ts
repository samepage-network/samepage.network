#!/usr/bin/env node
import build from "./build";
import dev from "./dev";
import test from "./test";
import path from "path";
import fs from "fs";
import type { CliOpts } from "./internal/compile";

const mergeOpts = (args: CliOpts, rawPath: string): CliOpts => {
  const root = typeof args.root === "string" ? args.root : ".";
  const configPath = path.join(root, rawPath);
  const rawConfigOpts = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath).toString()).samepage || {}
    : {};
  rawConfigOpts.root = rawConfigOpts.root || root;
  const configOpts = rawConfigOpts.extends
    ? mergeOpts(rawConfigOpts, rawConfigOpts.extends)
    : rawConfigOpts;
  const mergedOpts: CliOpts = { ...configOpts };
  Object.keys(args).forEach((k) => {
    const mergedOptValue = mergedOpts[k];
    const argValue = args[k];
    if (Array.isArray(mergedOptValue)) {
      mergedOpts[k] = [
        ...mergedOptValue,
        ...(typeof argValue === "string"
          ? [argValue]
          : Array.isArray(argValue)
          ? argValue
          : [`${argValue}`]),
      ];
    } else {
      mergedOpts[k] = argValue;
    }
  });
  return mergedOpts;
};

const run = async (command: string, args: string[]): Promise<number> => {
  const cliOpts = args
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
    }, {} as CliOpts);
  const opts = mergeOpts(cliOpts, "package.json");
  switch (command) {
    case "build":
      return build(opts);
    case "start":
    case "dev":
      return dev(opts);
    case "test":
      return test(opts);
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
