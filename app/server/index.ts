import getGithubDownloadUrl from "~/data/getGithubDownloadUrl.server";
// TODO - inline this
import { createRequestHandler } from "remix-lambda-at-edge";

export const handler = createRequestHandler({
  getBuild: () => require("./build"),
  originPaths: [
    "favicon.ico",
    // ignore tldraw asets for now since they're in S3, rest are in GH
    /^\/assets\/tld.+/,
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
    /^\/releases\/.*/,
    /^\/svgs\/.*/,
    /^\/videos\/.*/,
    /^\/.well-known\/.*/,
  ],
  onError: (e) => console.log("Send email to me", e),
});
