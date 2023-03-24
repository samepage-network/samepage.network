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

  // TODO - pass it into the remix dev command instead of setting it here
  const oldLog = console.log;
  console.log = (...args) => {
    if (
      typeof args[0] === "string" &&
      args[0].startsWith(`Remix App Server started`)
    ) {
      // ngrok
      //   .connect({
      //     addr: process.env.PORT || 3000,
      //     subdomain: "samepage-app",
      //   })
      //   .then((url) => {
      //     console.log("Started local ngrok tunneling:");
      //     console.log(url);
      //     return 0;
      //   });
    }
    return oldLog(...args);
  };

  return remixDev(process.cwd(), process.env.NODE_ENV).then(() => 0);
};

export default dev;
