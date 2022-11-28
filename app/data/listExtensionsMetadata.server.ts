import axios from "axios";
import APPS from "package/internal/apps";
import type { LoaderFunction } from "@remix-run/node";
import getGithubDownloadUrl from "./getGithubDownloadUrl.server";

const listExtensionsMetadata = async ({
  request,
}: Parameters<LoaderFunction>[0]) => {
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  if (id) {
    return getGithubDownloadUrl(id);
  }
  return Promise.all(
    APPS.slice(1).map((app) =>
      axios
        .get<
          {
            assets: { browser_download_url: string; name: string }[];
            tag_name: string;
          }[]
        >(
          `https://api.github.com/repos/samepage-network/${app.name.toLowerCase()}-samepage/releases`
        )
        .then(
          (
            releases
          ): {
            id: string;
            versions: { href: string; version: string }[];
          } => {
            const id = app.name.toLowerCase();
            return {
              versions: releases.data.slice(0, 5).map((r) => ({
                href:
                  r.assets.find(
                    (n) =>
                      n.name === `${id}.zip` || n.name === `${id}-samepage.zip`
                  )?.browser_download_url || "",
                version: r.tag_name,
              })),
              id,
            };
          }
        )
    )
  ).then((extensions) => ({
    versions: Object.fromEntries(extensions.map((e) => [e.id, e.versions])),
  }));
};

export default listExtensionsMetadata;
