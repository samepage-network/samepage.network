const fs = require("fs");
// Solve this issue in /app
// file a bug with Playwright related to dynamic paths - solve with patch-package
const buggedFile =
  "node_modules/@dvargas92495/app/backend/getRemixHandler.server.js";

const setup = () => {
  fs.writeFileSync(
    buggedFile,
    fs
      .readFileSync(buggedFile)
      .toString()
      .replace("~/server/build", "../../../../app/server/build")
  );
};

const teardown = () => {
  fs.writeFileSync(
    buggedFile,
    fs
      .readFileSync(buggedFile)
      .toString()
      .replace("../../../../app/server/build", "~/server/build")
  );
};

module.exports = { setup, teardown };
