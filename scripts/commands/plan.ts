import child_process from "child_process";
import compareSqlSchemas from "../../data/compareSqlSchemas";
import fs from "fs";
import nodeCompile from "../../package/scripts/internal/nodeCompile";
import readDir from "../../package/scripts/internal/readDir";

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
  await nodeCompile({
    functions: readDir("./data/scripts")
      .filter((f) => f.endsWith(".ts"))
      .map((f) => f.replace(/\.ts$/, "")),
    outdir: ".",
    root: ".",
  });
  if (sql) {
    await compareSqlSchemas();
  } else {
    // TODO - hack to get plan working in CI - look into madge warnings to see why this is happening
    patchConfigFile("tsconfig", (config) => {
      delete config["ts-node"];
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
