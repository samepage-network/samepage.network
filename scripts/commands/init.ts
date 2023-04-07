import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { Octokit } from "@octokit/rest";
import readDir from "../../package/scripts/internal/readDir";
import dotenv from "dotenv";
import getMysql from "~/data/mysql.server";
import { sql } from "drizzle-orm";
import { apps } from "data/schema";
dotenv.config();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const init = async ({
  code = "help",
  app = `${code.charAt(0).toUpperCase()}${code.slice(1)}`,
  workspace = "workspace",
}: {
  code?: string;
  app?: string;
  workspace?: string;
} = {}) => {
  if (code === "help") {
    console.log(
      "Usage: ts-node scripts/cli.ts init --id <id> --app <app> --workspace <workspace>"
    );
    console.log("");
    console.log(
      "Example: ts-node scripts/cli.ts init samepage SamePage workspace"
    );
    process.exit(0);
  }
  const cxn = await getMysql(code, { logger: true });
  const id = await cxn
    .select({ id: sql<number>`MAX(${apps.id}) + 1` })
    .from(apps)
    .then((r) => r[0].id);
  await cxn
    .insert(apps)
    .values({ id, name: app, code, workspaceLabel: workspace, live: false });
  await cxn.end();

  const files = readDir("template");
  const root = `../${code}-samepage`;
  const latest = JSON.parse(fs.readFileSync("package.json").toString()).version;
  fs.mkdirSync(root);
  files.forEach((f) => {
    const content = fs
      .readFileSync(f)
      .toString()
      .replace(/{{(id|code)}}/g, code)
      .replace(/{{(app|name)}}/g, app)
      .replace(/{{workspace}}/g, workspace)
      .replace(/{{latest}}/g, latest);
    const dest = f.replace(/^template/, root);
    if (!fs.existsSync(path.dirname(dest)))
      fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(f.replace(/^template/, root), content);
  });
  process.chdir(root);
  fs.writeFileSync(
    ".env",
    `SAMEPAGE_TEST_PASSWORD=${process.env.SAMEPAGE_TEST_PASSWORD}`
  );
  execSync("git init", { stdio: "inherit" });
  execSync("npm install", { stdio: "inherit" });
  execSync("git add --all", { stdio: "inherit" });
  execSync("git commit -m 'SamePage Initial Commit'", { stdio: "inherit" });

  const repo = await octokit.repos.createInOrg({
    org: "samepage-network",
    name: `${code}-samepage`,
    visibility: "public",
  });
  console.log("Created repo at", repo.data.html_url);
  execSync(`git remote add origin ${repo.data.html_url}.git`, {
    stdio: "inherit",
  });
  execSync("git push origin main", { stdio: "inherit" });
  return 0;
};

export default init;
