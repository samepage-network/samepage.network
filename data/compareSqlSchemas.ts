import path from "path";
import fs from "fs";
import { execSync } from "child_process";

const compareSqlSchemas = async () => {
  const OUT_DIR = path.join("out", "migrations");
  if (fs.existsSync(OUT_DIR)) fs.rmSync(OUT_DIR, { recursive: true });
  execSync(
    `npx drizzle-kit introspect:mysql --out ${OUT_DIR} --connectionString="${process.env.DATABASE_URL?.replace(
      /"/g,
      '\\"'
    )}"`,
    { stdio: "inherit" }
  );
  execSync(
    `npx drizzle-kit generate:mysql --out ${OUT_DIR} --schema data/schema.ts`,
    { stdio: "inherit" }
  );
  const migrationFile = fs
    .readdirSync(OUT_DIR)
    .filter((f) => /^\d{4}/.test(f))
    .sort((a, b) => parseInt(b.slice(0, 4)) - parseInt(a.slice(0, 4)))[0];
  const applyFile = path.join(OUT_DIR, "apply.sql");
  if (migrationFile) fs.cpSync(path.join(OUT_DIR, migrationFile), applyFile);

  // TODO: Possibly run data migrations here and append to applyFile

  if (fs.existsSync(applyFile)) {
    const migrationContent = fs.readFileSync(applyFile).toString();
    console.log(fs.readFileSync(path.join(OUT_DIR, migrationFile)).toString());
    console.log("");
    console.log(
      "Ready to apply",
      migrationContent.split("\n").length,
      "lines of sql..."
    );
  } else {
    console.log("No migrations to apply.");
  }
};

export default compareSqlSchemas;
