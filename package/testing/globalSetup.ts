import fs from "fs";

const globalSetup = async () => {
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  if (process.env.DEBUG || process.env.PWDEBUG)
    process.env.DEBUG = process.env.DEBUG || process.env.PWDEBUG;
  if (fs.existsSync(`${process.cwd()}/tests/config.ts`)) {
    await import(`${process.cwd()}/tests/config`)
      .then(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        (mod) => typeof mod.setup === "function" && mod.setup()
      )
      .catch((e) => console.error(e));
  }
};

export default globalSetup;
