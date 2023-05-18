import { LoaderFunction } from "@remix-run/node";
import { Octokit } from "@octokit/rest";
import { NotFoundResponse } from "package/utils/responses";
import mimeTypes from "mime-types";
import parseRemixContext from "~/data/parseRemixContext.server";
import decompress from "decompress";
import fs from "fs";

export const loader: LoaderFunction = async ({ params, request, context }) => {
  // TODO - actually query github for HEAD reqs
  if (request.method === "HEAD") return new Response("", { status: 200 });
  const { owner = "", repo = "", file = "", branch = "" } = params;
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });
  const {
    data: { workflow_runs },
  } = await octokit.actions.listWorkflowRunsForRepo({
    owner,
    repo,
    branch,
    status: "success",
  });
  if (!workflow_runs.length)
    throw new NotFoundResponse(`No workflow run found`);
  const run_id = workflow_runs[0].id;
  const {
    data: { artifacts },
  } = await octokit.actions.listWorkflowRunArtifacts({
    owner,
    repo,
    run_id,
  });
  const { url } = await octokit.actions.downloadArtifact({
    owner,
    repo,
    artifact_id: artifacts[0].id,
    archive_format: "zip",
  });
  //   console.log("url", url);
  const zip = await fetch(url).then((r) => r.text());
  //   console.log("zip", zip.length);
  const tmp = `/tmp/${parseRemixContext(context).lambdaContext.awsRequestId}`;
  fs.mkdirSync(tmp);
  fs.writeFileSync(`${tmp}/archive.zip`, zip);
  //   const files =
  await decompress(`${tmp}/archive.zip`, `${tmp}/out`);
  //   console.log("depressed", files);
  const body = fs.readFileSync(`${tmp}/out/${file}`);
  return new Response(body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": mimeTypes.lookup(file) || "application/octet-stream",
    },
  });
};
