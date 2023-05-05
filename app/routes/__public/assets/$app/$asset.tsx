import { LoaderFunction } from "@remix-run/node";
// import { Octokit } from "@octokit/rest";
// import { NotFoundResponse } from "~/data/responses.server";
// import mimeTypes from "mime-types";

// TODO - inline remix-lambda-adapter and move this logic there.
const illegalHeaders = ["transfer-encoding", "connection"];

export const loader: LoaderFunction = async ({ params }) => {
  const { app, asset = "" } = params;
  return fetch(
    `https://raw.githubusercontent.com/samepage-network/${app}-samepage/main/assets/${asset}`
  ).then((r) => {
    illegalHeaders.forEach((h) => r.headers.delete(h));
    return r;
  });
};
