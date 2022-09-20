import path from "path";
import fs from "fs";

const appPath = (p: string): string =>
  path.resolve(fs.realpathSync(process.cwd()), p);

export default appPath;
