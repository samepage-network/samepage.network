import { dev as remixDev } from "@remix-run/dev/dist/cli/commands";
import { spawn } from "child_process";

type FeArgs = { port?: string; local?: boolean };

const dev = async (args: FeArgs = {}): Promise<number> => {
  process.env.NODE_ENV = process.env.NODE_ENV || "development";
  if (args.port) process.env.PORT = args.port;

  // TODO - Future versions of Remix have native Tailwind support
  spawn("npx", ["tailwindcss", "-o", "./app/tailwind.css", "--watch"], {
    stdio: "inherit",
  });

  if (!args.local) {
    setTimeout(() => {
      spawn("ngrok", ["start", "dev"], { stdio: "inherit" });
    }, 5000);
  }

  return remixDev(process.cwd(), process.env.NODE_ENV).then(() => 0);
};

export default dev;
