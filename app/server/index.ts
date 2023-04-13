import getGithubDownloadUrl from "~/data/getGithubDownloadUrl.server";
import { createRequestHandler } from "remix-lambda-at-edge";

export const handler = createRequestHandler({
  getBuild: () => require("./build"),
  originPaths: [
    "favicon.ico",
    /^\/build\/.*/,
    {
      test: /^\/extensions\/[a-z0-9]+\.zip$/,
      mapper: (s: string) => {
        const id = s.replace(/\.zip$/, "").replace(/^\/extensions\//, "");
        return getGithubDownloadUrl(id).then((r) => r.href || s);
      },
    },
    /^\/extensions\/[a-z0-9]+\/[\d.-]+\.zip$/,
    /^\/extensions\/tests\/.+$/,
    /^\/fonts\/.*/,
    /^\/images\/.*/,
    /^\/svgs\/.*/,
    /^\/videos\/.*/,
    /^\/.well-known\/.*/
  ],
  onError: (e) => console.log("Send email to me", e),
});
