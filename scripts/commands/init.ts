import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { Octokit } from "@octokit/rest";
import readDir from "../../package/scripts/internal/readDir";
import dotenv from "dotenv";
dotenv.config();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const init = async ({
  id = "help",
  app = `${id.charAt(0).toUpperCase()}${id.slice(1)}`,
  workspace = "workspace",
}: {
  id?: string;
  app?: string;
  workspace?: string;
} = {}) => {
  if (id === "help") {
    console.log(
      "Usage: ts-node scripts/cli.ts init --id <id> --app <app> --workspace <workspace>"
    );
    console.log("");
    console.log(
      "Example: ts-node scripts/cli.ts init samepage SamePage workspace"
    );
    process.exit(0);
  }
  const files = readDir("template");
  const root = `../${id}-samepage`;
  const latest = JSON.parse(fs.readFileSync("package.json").toString()).version;
  fs.mkdirSync(root);
  files.forEach((f) => {
    const content = fs
      .readFileSync(f)
      .toString()
      .replace(/{{id}}/g, id)
      .replace(/{{app}}/g, app)
      .replace(/{{workspace}}/g, workspace)
      .replace(/{{latest}}/g, latest);
    const dest = f.replace(/^template/, root);
    if (!fs.existsSync(path.dirname(dest)))
      fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(f.replace(/^template/, root), content);
  });
  process.chdir(root);
  execSync("git init", { stdio: "inherit" });
  execSync("npm install", { stdio: "inherit" });
  execSync("git add --all", { stdio: "inherit" });
  execSync("git commit -m 'SamePage Initial Commit'", { stdio: "inherit" });

  const repo = await octokit.repos.createInOrg({
    org: "samepage-network",
    name: `${id}-samepage`,
    visibility: "public",
  });
  console.log("Created repo at", repo.data.html_url);
  execSync(
    `git remote add origin ${repo.data.html_url}.git`,
    { stdio: "inherit" }
  );
  execSync("git push origin main", { stdio: "inherit" });
  return 0;
};

export default init;
