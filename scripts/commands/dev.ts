import { dev as remixDev } from "@remix-run/dev/dist/cli/commands";
import { spawn } from "child_process";
import ngrok from "ngrok";
import os from "os";

const shell = os.platform() === "win32";

type FeArgs = { port?: string; local?: boolean };

const dev = async (args: FeArgs = {}): Promise<number> => {
  process.env.NODE_ENV = process.env.NODE_ENV || "development";
  process.env.OCTOKIT_URL =
    process.env.OCTOKIT_URL || "http://localhost:3003/mocks/octokit";
  if (args.port) process.env.PORT = args.port;

  // TODO - Future versions of Remix have native Tailwind support
  spawn("npx", ["tailwindcss", "-o", "./app/tailwind.css", "--watch"], {
    stdio: "inherit",
    shell,
  });

  if (!args.local) {
    setTimeout(() => {
      ngrok
        .connect({
          subdomain: "samepage",
          addr: process.env.PORT || 3000,
        })
        .then((url) => {
          console.log(`Public URL: ${url}`);
        });
    }, 5000);
  }

  return remixDev(process.cwd(), process.env.NODE_ENV).then(() => 0);
};

export default dev;
