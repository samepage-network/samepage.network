import { execSync } from "child_process";
import path from "path";

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
  return 0;
};

export default publish;
