import { LinksFunction, LoaderArgs, redirect } from "@remix-run/node";
import authenticateEmbed from "./_authenticateEmbed";
import getMysql from "~/data/mysql.server";
import { useLoaderData } from "@remix-run/react";
import blueprintcss from "@blueprintjs/core/lib/css/blueprint.css";
import blueprinticonscss from "@blueprintjs/icons/lib/css/blueprint-icons.css";
import Button from "~/components/Button";
import SharedPageStatus from "package/components/SharedPageStatus";
import { pageNotebookLinks } from "data/schema";
import { and, eq } from "drizzle-orm/expressions";
import LinkWithSearch from "~/components/LinkWithSearch";
import useNavigateWithSearch from "~/components/useNavigateWithSearch";

const SingleSharedPageEmbedPage: React.FC = () => {
  const data = useLoaderData<Awaited<ReturnType<typeof loader>>>();
  const navigate = useNavigateWithSearch();
  return (
    <div>
      <LinkWithSearch to={"/embeds/shared-pages"} className="mb-4 inline-block">
        <Button type={"button"}>Back</Button>
      </LinkWithSearch>
      {!("auth" in data) ? (
        <div>User is not authenticated. Log in to manage this page.</div>
      ) : !data.notebookPageId ? (
        <div>
          User is authenticated, but does not have access to page{" "}
          {data.notebookPageId}
        </div>
      ) : (
        <SharedPageStatus
          notebookPageId={data.notebookPageId}
          onClose={() => navigate(`/embeds/shared-pages`)}
          credentials={data.credentials}
        />
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
  const cxn = await getMysql(result.requestId);
  const linkUuid = args.params.uuid || "";
  const [page] = await cxn
    .select({
      notebookPageId: pageNotebookLinks.notebookPageId,
    })
    .from(pageNotebookLinks)
    .where(
      and(
        eq(pageNotebookLinks.uuid, linkUuid),
        eq(pageNotebookLinks.notebookUuid, result.notebookUuid),
        eq(pageNotebookLinks.open, 0)
      )
    );
  await cxn.end();
  return {
    auth: true as const,
    notebookPageId: page?.notebookPageId,
    credentials: {
      notebookUuid: result.notebookUuid,
      token: result.token,
    }
  };
};

export const links: LinksFunction = () => {
  return [
    { rel: "stylesheet", href: blueprintcss },
    { rel: "stylesheet", href: blueprinticonscss },
  ];
};

export default SingleSharedPageEmbedPage;
