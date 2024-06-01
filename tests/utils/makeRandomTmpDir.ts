import fs from "fs";
import os from "os";
import path from "path";
import randomString from "~/data/randomString.server";

const makeRandomTmpDir = async () => {
  const dir = path.join(
    os.tmpdir(),
    await randomString({ length: 8, encoding: "hex" })
  );
  fs.mkdirSync(dir);
  return dir;
};

export default makeRandomTmpDir;
