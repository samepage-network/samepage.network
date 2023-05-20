import { ActionArgs, LoaderArgs, redirect } from "@remix-run/node";
import authenticateEmbed from "./_authenticateEmbed.server";
import getMysql from "~/data/mysql.server";
import {
  accessTokens,
  apps,
  notebooks,
  pageNotebookLinks,
  tokenNotebookLinks,
  tokens,
} from "data/schema";
import { and, eq } from "drizzle-orm/expressions";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import {
  InternalServerResponse,
  NotFoundResponse,
} from "package/utils/responses";
import sharePageCommandCalback from "package/internal/sharePageCommandCallback";
import { apiPost } from "package/internal/apiClient";
import listSharedPages from "~/data/listSharedPages.server";
export { default as default } from "package/components/SharedPagesTab";

export const loader = async (args: LoaderArgs) => {
  const result = await authenticateEmbed(args);
  if (!result.auth) {
    await getMysql(result.requestId).then((c) => c.end());
    return redirect("/embeds");
  }
  const cxn = await getMysql(result.requestId);
  const pagesResult = await listSharedPages(result);
  await cxn.end();
  return pagesResult;
};

export const action = async (args: ActionArgs) => {
  const result = await authenticateEmbed(args);
  if (!result.auth) {
    await getMysql(result.requestId).then((c) => c.end());
    return redirect("/embeds");
  }
  const { request } = args;
  if (request.method !== "POST")
    throw new NotFoundResponse(`Unsupported method ${request.method}`);
  const data = await request.formData();
  const title = data.get("title") as string;
  const { requestId, notebookUuid, tokenUuid, token, param } = result;
  const cxn = await getMysql(requestId);

  const [{ actorId, app }] = await cxn
    .select({
      actorId: tokenNotebookLinks.uuid,
      app: apps.code,
    })
    .from(tokens)
    .innerJoin(
      tokenNotebookLinks,
      eq(tokens.uuid, tokenNotebookLinks.tokenUuid)
    )
    .innerJoin(notebooks, eq(accessTokens.notebookUuid, notebooks.uuid))
    .innerJoin(apps, eq(apps.id, notebooks.app))
    .where(
      and(
        eq(tokenNotebookLinks.notebookUuid, notebookUuid),
        eq(tokens.uuid, tokenUuid)
      )
    );
  const shared = await sharePageCommandCalback({
    getNotebookPageId: async () =>
      apiPost<{ notebookPageId: string }>({
        path: `extensions/${app}/backend`,
        data: {
          type: "ENSURE_PAGE_BY_TITLE",
          title: { content: title, annotations: [] },
        },
        authorization: `Basic ${Buffer.from(
          `${notebookUuid}:${token}`
        ).toString("base64")}`,
      }).then((r) => r.notebookPageId),
    encodeState: (notebookPageId) =>
      apiPost({
        path: `extensions/${app}/backend`,
        data: {
          type: "ENCODE_STATE",
          notebookPageId,
          notebookUuid,
        },
        authorization: `Basic ${Buffer.from(
          `${notebookUuid}:${token}`
        ).toString("base64")}`,
      }),
    actorId,
    credentials: {
      notebookUuid,
      token,
    },
  });
  if (!shared.success) throw new InternalServerResponse(shared.error);
  const [linkUuid] = await cxn
    .select({ linkUuid: pageNotebookLinks.uuid })
    .from(pageNotebookLinks)
    .where(
      and(
        eq(pageNotebookLinks.notebookUuid, notebookUuid),
        eq(pageNotebookLinks.notebookPageId, shared.notebookPageId)
      )
    );
  await cxn.end();
  if (!linkUuid)
    throw new InternalServerResponse(`Page ${title} did not share correctly`);
  return redirect(`/embeds/shared-pages/${linkUuid.linkUuid}?auth=${param}`);
};
