import child_process from "child_process";
import compareSqlSchemas from "../../data/compareSqlSchemas";
import fs from "fs";

const patchConfigFile = (
  filename: string,
  edit: (config: Record<string, unknown>) => void
) => {
  const config = JSON.parse(fs.readFileSync(`${filename}.json`).toString());
  edit(config);
  fs.writeFileSync(`${filename}.json`, JSON.stringify(config, null, 2));
};

const plan = async ({
  sql,
  tf,
}: {
  sql?: boolean;
  tf?: boolean;
}): Promise<number> => {
  if (sql) {
    await compareSqlSchemas();
  } else {
    // TODO - when this issue resolves, use ts-node-esm again in cdktf.json
    // https://github.com/TypeStrong/ts-node/issues/2094
    patchConfigFile("package", (config) => {
      config.type = "module";
    });

    // TODO - hack to get plan working in CI - look into madge warnings to see why this is happening
    patchConfigFile("tsconfig", (config) => {
      delete config["ts-node"];
      config["module"] = "ESNext";
    });

    // TODO - make this a non speculative plan
    child_process.execSync(`npx cdktf plan`, {
      stdio: "inherit",
      env: tf
        ? {
            ...process.env,
            TF_ONLY: "true",
          }
        : { ...process.env },
    });
  }
  return 0;
};

export default plan;
