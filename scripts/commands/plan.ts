import child_process from "child_process";
import fs from "fs";

const plan = async ({ sql }: { sql?: boolean }): Promise<number> => {
  // This is a hack until https://github.com/cdktf/cdktf-provider-aws bumps up to 4.41.0
  if (fs.existsSync("./node_modules/@cdktf/provider-aws/lib")) {
    fs.readdirSync("./node_modules/@cdktf/provider-aws/lib").forEach((dir) => {
      const index = `./node_modules/@cdktf/provider-aws/lib/${dir}/index.js`;
      if (
        fs.existsSync(`./node_modules/@cdktf/provider-aws/lib/${dir}/index.js`)
      ) {
        fs.writeFileSync(
          index,
          fs
            .readFileSync(index)
            .toString()
            .replace(
              /providerVersion: '4\.39\.0',/,
              `providerVersion: '4.41.0',`
            )
        );
      }
    });
  }

  if (sql) {
    child_process.execSync(`npx ts-node-esm data/main.ts`, {
      stdio: "inherit",
      env: {
        ...process.env,
        FUEGO_ARGS_SQL: `true`,
      },
    });
  } else {
    // TODO - make this a non speculative plan
    child_process.execSync(`npx cdktf plan`, {
      stdio: "inherit",
    });
  }
  return 0;
};

export default plan;
