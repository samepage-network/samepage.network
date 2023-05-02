import { ActionArgs, LoaderArgs, redirect } from "@remix-run/node";
import React from "react";
import authenticateEmbed from "./_authenticateEmbed";
import { Form, useLoaderData } from "@remix-run/react";
import getMysql from "~/data/mysql.server";
import {
  accessTokens,
  apps,
  notebooks,
  pageNotebookLinks,
  pageProperties,
  tokenNotebookLinks,
  tokens,
} from "data/schema";
import { and, eq } from "drizzle-orm/expressions";
import AtJsonRendered from "package/components/AtJsonRendered";
import { zSamePageSchema } from "package/internal/types";
import LinkWithSearch from "~/components/LinkWithSearch";
import TextInput from "~/components/TextInput";
import Button from "~/components/Button";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import {
  InternalServerResponse,
  NotFoundResponse,
} from "~/data/responses.server";
import sharePageCommandCalback from "package/internal/sharePageCommandCallback";
import { apiPost } from "package/internal/apiClient";

const SharedPagesEmbedPage: React.FC = () => {
  const data = useLoaderData<Awaited<ReturnType<typeof loader>>>();
  return (
    <div>
      {"auth" in data && (
        <div>
          <h1 className="font-bold mb-4 text-xl">Shared Pages</h1>
          <div className="mb-4">
            {/* TODO: import ViewSharedPages Modal Content here */}
            <ul>
              {data.pages.map((p) => (
                <li key={p.linkUuid} className="mb-2">
                  <LinkWithSearch to={p.linkUuid} className="text-sky-400">
                    <AtJsonRendered {...p.title} />
                  </LinkWithSearch>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-semibold mb-3 text-lg">
              Share Page on SamePage
            </h2>
            <Form method="post">
              <TextInput label={"Search"} name={"title"} />
              <Button>Share</Button>
            </Form>
          </div>
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
  const cxn = await getMysql(result.requestId);
  const pages = await cxn
    .select({
      linkUuid: pageNotebookLinks.uuid,
      title: pageProperties.value,
    })
    .from(pageNotebookLinks)
    .innerJoin(
      pageProperties,
      eq(pageProperties.linkUuid, pageNotebookLinks.uuid)
    )
    .where(
      and(
        eq(pageNotebookLinks.notebookUuid, result.notebookUuid),
        eq(pageProperties.key, "$title"),
        eq(pageNotebookLinks.open, 0)
      )
    );
  await cxn.end();
  return {
    auth: true as const,
    pages: pages.map((p) => ({
      linkUuid: p.linkUuid,
      title: zSamePageSchema.parse(p.title),
    })),
  };
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

  const [{ actorId, accessToken, app }] = await cxn
    .select({
      actorId: tokenNotebookLinks.uuid,
      accessToken: accessTokens.value,
      app: apps.code,
    })
    .from(tokens)
    .innerJoin(
      tokenNotebookLinks,
      eq(tokens.uuid, tokenNotebookLinks.tokenUuid)
    )
    .innerJoin(
      accessTokens,
      eq(accessTokens.notebookUuid, tokenNotebookLinks.notebookUuid)
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
        authorization: `Bearer ${accessToken}`,
      }).then((r) => r.notebookPageId),
    encodeState: (notebookPageId) =>
      apiPost({
        path: `extensions/${app}/backend`,
        data: {
          type: "ENCODE_STATE",
          notebookPageId,
          notebookUuid,
        },
        authorization: `Bearer ${accessToken}`,
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
  return redirect(`/embeds/shared-pages/${linkUuid}?auth=${param}`);
};

export default SharedPagesEmbedPage;
