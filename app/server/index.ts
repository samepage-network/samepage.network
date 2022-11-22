import getRemixHandler from "@dvargas92495/app/backend/getRemixHandler.server";
import getGithubDownloadUrl from "~/data/getGithubDownloadUrl.server";

export const handler = getRemixHandler({
  // TODO - top three paths should live in /data
  originPaths: [
    {
      test: /^\/extensions\/[a-z0-9]+\.zip$/,
      mapper: (s: string) => {
        const id = s.replace(/\.zip$/, "").replace(/^\/extensions\//, "");
        console.log("LOOKING FOR ZIP FOR", s, id);
        return getGithubDownloadUrl(id).then((r) => r.href || s);
      },
    },
    /^\/extensions\/[a-z0-9]+\/[\d.-]+\.zip$/,
    /^\/extensions\/tests\/.+$/,
  ],
});
