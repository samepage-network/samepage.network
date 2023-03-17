import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { Octokit } from "@octokit/rest";
import readDir from "../package/scripts/internal/readDir";

const octokit = new Octokit();

const [, , id, app, workspace] = process.argv;
if (id === "help") {
  console.log("Usage: ts-node scripts/new.ts <id> <app> <workspace>");
  console.log("");
  console.log("Example: ts-node scripts/new.ts samepage SamePage workspace");
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
execSync(
  `git remote add origin https://github.com/samepage-network/${id}-samepage.git`,
  { stdio: "inherit" }
);
octokit.users
  .getAuthenticated()
  .then((r) => {
    if (r.data.name === "samepage-network") {
      console.log("Creating repo on github");
      // create repo on github first
      // execSync("git push origin main", { stdio: "inherit" });
    } else {
      console.log("Cannot create repo on github. Logged in as", r.data.name);
    }
  })
  .catch((e) =>
    console.error("Failed to get the authenticated user", e.response.data)
  );
