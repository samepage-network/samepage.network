// import ngrok from "ngrok";
import { dev as remixDev } from "@remix-run/dev/dist/cli/commands";
// import { appPath } from "./common";
// import fs from "fs";
// import tailwindcss from "tailwindcss";

// HOW WOULD I INLINE TAILWIND?
//
//   await tailwindcss({
//     ...config,
//     content: ["./app/**/*.tsx", ...(content || [])],
//     theme: theme || { extend: {} },
//     watch: true,
//     minify: false,
//   });

type FeArgs = { port?: string };

const dev = async (args: FeArgs = {}): Promise<number> => {
  process.env.NODE_ENV = process.env.NODE_ENV || "development";
  if (args.port) process.env.PORT = args.port;

  return remixDev(process.cwd(), process.env.NODE_ENV).then(() => 0);
};

export default dev;
