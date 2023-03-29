import child_process from "child_process";
import compareSqlSchemas from "../../data/compareSqlSchemas";

const plan = async ({ sql }: { sql?: boolean }): Promise<number> => {
  if (sql) {
    await compareSqlSchemas();
  } else {
    // TODO - make this a non speculative plan
    child_process.execSync(`npx cdktf plan`, {
      stdio: "inherit",
    });
  }
  return 0;
};

export default plan;
