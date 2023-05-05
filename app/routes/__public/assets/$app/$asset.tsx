import { LoaderFunction } from "@remix-run/node";
import { Octokit } from "@octokit/rest";

// TODO - inline remix-lambda-adapter and move this logic there.
const illegalHeaders = [
  "transfer-encoding",
  "connection",
];

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
  return fetch(content.url).then((r) => {
    illegalHeaders.forEach((h) => r.headers.delete(h));
    return r;
  });
};
