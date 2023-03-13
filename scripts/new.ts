import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const readDir = (s: string): string[] =>
  fs.existsSync(s)
    ? fs
        .readdirSync(s, { withFileTypes: true })
        .flatMap((f) =>
          f.isDirectory() ? readDir(`${s}/${f.name}`) : [`${s}/${f.name}`]
        )
    : [];

const [, , id, app, workspace] = process.argv;
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
  "git remote add origin https://github.com/samepage-network/google-samepage.git",
  { stdio: "inherit" }
);
// execSync("git push origin main", { stdio: "inherit" });
