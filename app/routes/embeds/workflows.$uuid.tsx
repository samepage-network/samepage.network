import { LoaderArgs, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import AtJsonRendered from "package/components/AtJsonRendered";
import Button from "package/components/Button";
import getTitleState from "~/data/getTitleState.server";
import { NotFoundResponse } from "package/utils/responses";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import { ActionFunction } from "@remix-run/node";
import {
  accessTokens,
  apps,
  notebooks,
  pageNotebookLinks,
  tokenNotebookLinks,
} from "data/schema";
import { and, eq } from "drizzle-orm/expressions";
import { apiPost } from "package/internal/apiClient";
import downloadSharedPage from "~/data/downloadSharedPage.server";
import getMysql from "~/data/mysql.server";
import Automerge from "automerge";
import unwrapSchema from "package/utils/unwrapSchema";
import authenticateEmbed from "./_authenticateEmbed.server";
import Select from "package/components/Select";

const SingleWokflowEmbed = () => {
  const data = useLoaderData<Awaited<ReturnType<typeof loader>>>();
  return "auth" in data ? (
    <Form method={"post"}>
      <h1 className="text-3xl font-bold mb-8">
        <AtJsonRendered {...data.title} />{" "}
        <img
          src={"https://samepage.network/images/logo.png"}
          className={"inline h-12 w-12"}
        />
      </h1>
      <Select
        label="Destination"
        options={data.destinations.map((d) => ({
          id: d.notebookUuid,
          label: `${d.app} ${d.workspace}`,
        }))}
      />
      <Button>Trigger</Button>
    </Form>
  ) : (
    <div>User is unauthenticates. Click Home to log in.</div>
  );
};

export const loader = async (args: LoaderArgs) => {
  const result = await authenticateEmbed(args);
  if (!result.auth) {
    await getMysql(result.requestId).then((c) => c.end());
    return redirect("/embeds");
  }
  const { requestId, notebookUuid, tokenUuid } = result;
  const uuid = args.params.uuid || "";
  const cxn = await getMysql(requestId);
  const [page] = await cxn
    .select({
      notebookPageId: pageNotebookLinks.notebookPageId,
    })
    .from(pageNotebookLinks)
    .where(
      and(
        eq(pageNotebookLinks.uuid, uuid),
        eq(pageNotebookLinks.notebookUuid, notebookUuid)
      )
    );
  if (!page) {
    await cxn.end();
    throw new NotFoundResponse(`No page found for uuid "${uuid}"`);
  }
  const { notebookPageId } = page;
  const title = await getTitleState({
    notebookUuid,
    notebookPageId,
    requestId,
  });
  const destinations = await cxn
    .select({
      notebookUuid: notebooks.uuid,
      app: apps.name,
      workspace: notebooks.workspace,
    })
    .from(notebooks)
    .innerJoin(
      tokenNotebookLinks,
      eq(tokenNotebookLinks.notebookUuid, notebooks.uuid)
    )
    .innerJoin(apps, eq(apps.id, notebooks.app))
    .where(eq(tokenNotebookLinks.tokenUuid, tokenUuid));
  await cxn.end();
  return { title, auth: true, destinations };
};

export const action: ActionFunction = async (args) => {
  const result = await authenticateEmbed(args);
  if (!result.auth) {
    await getMysql(result.requestId).then((c) => c.end());
    return redirect("/embeds");
  }
  const { requestId, notebookUuid } = result;
  const cxn = await getMysql(requestId);
  const uuid = args.params.uuid || "";
  const [page] = await cxn
    .select({
      notebookPageId: pageNotebookLinks.notebookPageId,
      cid: pageNotebookLinks.cid,
    })
    .from(pageNotebookLinks)
    .where(
      and(
        eq(pageNotebookLinks.uuid, uuid),
        eq(pageNotebookLinks.notebookUuid, notebookUuid)
      )
    );
  if (!page) {
    await cxn.end();
    throw new NotFoundResponse(`No page found for uuid "${uuid}"`);
  }
  const { notebookPageId, cid } = page;
  const [{ authorization, app }] = await cxn
    .select({
      authorization: accessTokens.value,
      app: apps.code,
    })
    .from(accessTokens)
    .innerJoin(notebooks, eq(accessTokens.notebookUuid, notebooks.uuid))
    .innerJoin(apps, eq(apps.id, notebooks.app))
    .where(eq(accessTokens.notebookUuid, notebookUuid));
  const { body } = await downloadSharedPage({ cid });
  const { notebookPageId: newNotebookPageId } = await apiPost({
    path: `extensions/${app}/backend`,
    data: {
      type: "ENSURE_PAGE_BY_TITLE",
      title: notebookPageId,
    },
    authorization,
  });
  const state = unwrapSchema(Automerge.load(body));
  await apiPost({
    path: `extensions/${app}/backend`,
    data: {
      type: "DECODE_STATE",
      notebookPageId: newNotebookPageId,
      state,
    },
    authorization,
  });
  return { success: true };
};

export default SingleWokflowEmbed;
