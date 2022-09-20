import fs from "fs";
import compile, { CliArgs } from "./internal/compile";

const toDoubleDigit = (n: number) => n.toString().padStart(2, "0");

const toVersion = (today = new Date()): string =>
  `${today.getFullYear()}-${toDoubleDigit(
    today.getMonth() + 1
  )}-${toDoubleDigit(today.getDate())}-${toDoubleDigit(
    today.getHours()
  )}-${toDoubleDigit(today.getMinutes())}`;

const build = (args: CliArgs = {}) => {
  process.env.NODE_ENV = process.env.NODE_ENV || "production";
  const version = toVersion();
  const envExisting = fs.existsSync(".env")
    ? fs.readFileSync(".env").toString()
    : "";
  fs.writeFileSync(
    ".env",
    `${envExisting.replace(
      /VERSION=[\d-]+\n/gs,
      ""
    )}VERSION=${version}\n`
  );
  return compile({ ...args, opts: { minify: true } }).then(() => {
    console.log("done");
    return 0;
  });
};

export default build;
