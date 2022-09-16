import jest from "jest-cli";

const test = () => {
  return jest
    .run(["-c", "./node_modules/samepage/scripts/internal/jest.config.js"])
    .then(() => 0)
    .catch(() => 1);
};

export default test;
