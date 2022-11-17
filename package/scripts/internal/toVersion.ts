import fs from "fs";

const toVersion = (): string => {
  const json = JSON.parse(fs.readFileSync("package.json").toString());
  return json?.version || "LIVE";
};

export default toVersion;
