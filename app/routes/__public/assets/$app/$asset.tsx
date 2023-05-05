import { LoaderFunction } from "@remix-run/node";
import { Octokit } from "@octokit/rest";

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
  return fetch(content.url);
};
