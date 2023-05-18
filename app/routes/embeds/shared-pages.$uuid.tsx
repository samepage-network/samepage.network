import { LinksFunction, LoaderArgs, redirect } from "@remix-run/node";
import authenticateEmbed from "./_authenticateEmbed.server";
import getMysql from "~/data/mysql.server";
import blueprintcss from "@blueprintjs/core/lib/css/blueprint.css";
import blueprinticonscss from "@blueprintjs/icons/lib/css/blueprint-icons.css";
import { pageNotebookLinks, pageProperties } from "data/schema";
import { and, eq } from "drizzle-orm/expressions";
import { NotFoundResponse } from "package/utils/responses";
import { zSamePageSchema } from "package/internal/types";
export { default as default } from "package/components/SharedPageTab";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

export const loader = async (args: LoaderArgs) => {
  const result = await authenticateEmbed(args);
  if (!result.auth) {
    await getMysql(result.requestId).then((c) => c.end());
    return redirect("/embeds");
  }
  const cxn = await getMysql(result.requestId);
  const linkUuid = args.params.uuid || "";
  const [page] = await cxn
    .select({
      notebookPageId: pageNotebookLinks.notebookPageId,
      title: pageProperties.value,
    })
    .from(pageNotebookLinks)
    .innerJoin(
      pageProperties,
      eq(pageProperties.linkUuid, pageNotebookLinks.uuid)
    )
    .where(
      and(
        eq(pageNotebookLinks.uuid, linkUuid),
        eq(pageNotebookLinks.notebookUuid, result.notebookUuid),
        eq(pageNotebookLinks.open, 0),
        eq(pageProperties.key, "$title")
      )
    );
  await cxn.end();
  if (!page) {
    throw new NotFoundResponse(
      `User is authenticated, but does not have access to page ${linkUuid}`
    );
  }
  return {
    auth: true as const,
    notebookPageId: page.notebookPageId,
    title: zSamePageSchema.parse(page.title),
    credentials: {
      notebookUuid: result.notebookUuid,
      token: result.token,
    },
  };
};

export const links: LinksFunction = () => {
  return [
    { rel: "stylesheet", href: blueprintcss },
    { rel: "stylesheet", href: blueprinticonscss },
  ];
};
