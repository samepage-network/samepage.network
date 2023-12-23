import child_process from "child_process";
import compareSqlSchemas from "../../data/compareSqlSchemas";
import fs from "fs";

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
    // TODO - hack to get plan working in CI - look into madge warnings to see why this is happening
    const tsconfig = JSON.parse(fs.readFileSync("tsconfig.json").toString());
    delete tsconfig["ts-node"];
    fs.writeFileSync("tsconfig.json", JSON.stringify(tsconfig, null, 2));
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
    // TODO - when this issue resolves, use ts-node-esm again in cdktf.json
    // https://github.com/TypeStrong/ts-node/issues/2094
  }
  return 0;
};

export default plan;
