import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import { Octokit } from "@octokit/rest";

const publish = async ({}: {} = {}): Promise<number> => {
  const cwd = process.cwd();
  ["internal", "backend", "external", "testing", "scripts", "."].forEach(
    (dir) => {
      execSync(`npm publish --access public`, {
        cwd: path.join(cwd, "dist", dir),
        stdio: "inherit",
      });
    }
  );
  const version = JSON.parse(
    fs.readFileSync("package.json").toString()
  ).version;
  if (version) {
    await new Octokit({
      auth: process.env.GITHUB_TOKEN,
    }).repos.createRelease({
      owner: "samepage-network",
      repo: "samepage.network",
      tag_name: version,
      name: version,
    });
  }
  return 0;
};

export default publish;
