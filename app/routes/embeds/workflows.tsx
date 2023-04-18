export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import { LoaderArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData } from "@remix-run/react";
import { pageNotebookLinks } from "data/schema";
import { and, eq } from "drizzle-orm/expressions";
import { alias } from "drizzle-orm/mysql-core";
import { pageProperties } from "data/schema";
import authenticateNotebook from "~/data/authenticateNotebook.server";
import getMysql from "~/data/mysql.server";
import parseRemixContext from "~/data/parseRemixContext.server";
import { BadRequestResponse } from "~/data/responses.server";

const WorkflowsEmbed = () => {
  const { workflows } = useLoaderData<Awaited<ReturnType<typeof loader>>>();
  return (
    <div>
      <div>
        {workflows.map((wf) => (
          <Link key={wf.uuid} to={wf.uuid}>
            {wf.title || wf.notebookPageId}
          </Link>
        ))}
      </div>
      <Outlet />
    </div>
  );
};

const authenticateEmbed = async ({ request, context }: LoaderArgs) => {
  const searchParams = new URL(request.url).searchParams;
  const requestId = parseRemixContext(context).lambdaContext.awsRequestId;
  const notebookUuid = searchParams.get("uuid");
  if (!notebookUuid) {
    throw new BadRequestResponse(`Missing "uuid" query parameter`);
  }
  const token = searchParams.get("token");
  if (!token) {
    throw new BadRequestResponse(`Missing "token" query parameter`);
  }
  await authenticateNotebook({ notebookUuid, token, requestId });
  return { notebookUuid, requestId };
};

export const loader = async (args: LoaderArgs) => {
  const { notebookUuid, requestId } = await authenticateEmbed(args);
  const cxn = await getMysql(requestId);
  const workflows = await cxn
    .select({
      uuid: pageNotebookLinks.uuid,
      title: alias(pageProperties, "title").value,
      notebookPageId: pageNotebookLinks.notebookPageId,
    })
    .from(pageNotebookLinks)
    .innerJoin(
      pageProperties,
      eq(pageProperties.linkUuid, pageNotebookLinks.uuid)
    )
    .leftJoin(
      alias(pageProperties, "title"),
      and(
        eq(pageProperties.linkUuid, pageNotebookLinks.uuid),
        eq(pageProperties.key, "title")
      )
    )
    .where(
      and(
        eq(pageNotebookLinks.notebookUuid, notebookUuid),
        eq(pageProperties.key, "SamePage")
      )
    );
  await cxn.end();
  return { workflows };
};

export default WorkflowsEmbed;
