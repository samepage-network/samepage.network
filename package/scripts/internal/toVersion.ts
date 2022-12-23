import fs from "fs";
import path from "path";

const toVersion = (root = "."): string => {
  const filename = path.join(root, "package.json");
  const json = fs.existsSync(filename)
    ? JSON.parse(fs.readFileSync(filename).toString())
    : {};
  return json?.version || "LIVE";
};

export default toVersion;
