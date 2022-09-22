import fs from "fs";
import path from "path";

const getPackageName = (): string =>
  (fs.existsSync("package.json")
    ? JSON.parse(fs.readFileSync("package.json").toString())?.name
    : path.basename(process.cwd())
  )?.replace(/^roamjs-/, "");

export default getPackageName;
