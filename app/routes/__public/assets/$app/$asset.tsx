import { LoaderFunction } from "@remix-run/node";
import { Octokit } from "@octokit/rest";
import { NotFoundResponse } from "~/data/responses.server";
import mimeTypes from "mime-types";

// TODO - inline remix-lambda-adapter and move this logic there.
// const illegalHeaders = ["transfer-encoding", "connection"];

export const loader: LoaderFunction = async ({ params }) => {
  const { app, asset = "" } = params;
  const octokit = new Octokit({
    baseUrl: process.env.OCTOKIT_URL,
  });
  const content = await octokit.repos.getContent({
    owner: "samepage-network",
    repo: `${app}-samepage`,
    path: `assets/${asset}`,
  });
  if (!("type" in content.data) || content.data.type !== "file") {
    throw new NotFoundResponse(`Asset ${asset} not a file in ${app}`);
  }
  return new Response(Buffer.from(content.data.content, "base64"), {
    status: 200,
    headers: {
      "content-type": mimeTypes.lookup(asset) || "application/octet-stream",
    },
  });
};
