import fs from "fs";
import randomString from "~/data/randomString.server";

const makeRandomTmpDir = async () => {
  const dir = `/tmp/${await randomString({ length: 8, encoding: "hex" })}`;
  fs.mkdirSync(dir);
  return dir;
};

export default makeRandomTmpDir;
