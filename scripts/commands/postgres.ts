import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import dotenv from "dotenv";

dotenv.config();

const run = async () => {
    const OUT_DIR = path.join("out", "migrations");
  if (fs.existsSync(OUT_DIR)) fs.rmSync(OUT_DIR, { recursive: true });
  try {
  execSync(
    `npx drizzle-kit generate --config=data/drizzle.postgres.config.ts`,
    { stdio: "inherit" }
  );
} catch (e) {
    if (!fs.existsSync(OUT_DIR)) {
    throw e;
    } else {
        console.warn("command failed, but output directory is still there")
    }
}
execSync(`npx drizzle-kit migrate --config=data/drizzle.postgres.config.ts`, { stdio: "inherit" })

}

run().then(() => console.log("hooray")).catch((e) => console.error("no", e));