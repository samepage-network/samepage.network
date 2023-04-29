export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import { LoaderArgs, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { pageNotebookLinks } from "data/schema";
import { and, eq } from "drizzle-orm/expressions";
import { alias } from "drizzle-orm/mysql-core";
import { pageProperties } from "data/schema";
import getMysql from "~/data/mysql.server";
import authenticateEmbed from "./_authenticateEmbed";
import LinkWithSearch from "~/components/LinkWithSearch";

const WorkflowsEmbed = () => {
  const data = useLoaderData<Awaited<ReturnType<typeof loader>>>();
  return (
    <div>
      {"auth" in data && (
        <div>
          {data.workflows.map((wf) => (
            <LinkWithSearch key={wf.uuid} to={wf.uuid}>
              {wf.title || wf.notebookPageId}
            </LinkWithSearch>
          ))}
        </div>
      )}
    </div>
  );
};

export const loader = async (args: LoaderArgs) => {
  const result = await authenticateEmbed(args);
  if (!result.auth) {
    await getMysql(result.requestId).then((c) => c.end());
    return redirect("/embeds");
  }
  const { notebookUuid, requestId } = result;
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
        eq(pageProperties.key, "$title")
      )
    )
    .where(
      and(
        eq(pageNotebookLinks.notebookUuid, notebookUuid),
        eq(pageProperties.key, "SamePage")
      )
    );
  await cxn.end();
  return { workflows, auth: true };
};

export default WorkflowsEmbed;
