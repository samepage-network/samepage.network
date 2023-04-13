import { LoaderArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import AtJsonRendered from "package/components/AtJsonRendered";
import Button from "~/components/Button";
import authenticateNotebook from "~/data/authenticateNotebook.server";
import getTitleState from "~/data/getTitleState.server";
import parseRemixContext from "~/data/parseRemixContext.server";
import { BadRequestResponse, NotFoundResponse } from "~/data/responses.server";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import { ActionFunction } from "@remix-run/node";
import { accessTokens, apps, notebooks, pageNotebookLinks } from "data/schema";
import { eq } from "drizzle-orm/expressions";
import { apiPost } from "package/internal/apiClient";
import downloadSharedPage from "~/data/downloadSharedPage.server";
import getMysql from "~/data/mysql.server";
import Automerge from "automerge";
import unwrapSchema from "package/utils/unwrapSchema";

const SingleWokflowEmbed = () => {
  const { title } = useLoaderData<Awaited<ReturnType<typeof loader>>>();
  return (
    <Form method={"post"}>
      <h1 className="text-3xl font-bold mb-8">
        <AtJsonRendered {...title} />{" "}
        <img
          src={"https://samepage.network/images/logo.png"}
          className={"inline h-12 w-12"}
        />
      </h1>
      <Button>Trigger</Button>
    </Form>
  );
};

const authenticateEmbed = async ({ request, context }: LoaderArgs) => {
  const searchParams = new URL(request.url).searchParams;
  const requestId = parseRemixContext(context).lambdaContext.awsRequestId;
  const uuid = searchParams.get("uuid");
  if (!uuid) {
    throw new BadRequestResponse(`Missing "uuid" query parameter`);
  }
  const token = searchParams.get("token");
  if (!token) {
    throw new BadRequestResponse(`Missing "token" query parameter`);
  }
  const cxn = await getMysql(requestId);
  const [page] = await cxn
    .select({
      notebookUuid: pageNotebookLinks.notebookUuid,
      notebookPageId: pageNotebookLinks.notebookPageId,
      cid: pageNotebookLinks.cid,
    })
    .from(pageNotebookLinks)
    .where(eq(pageNotebookLinks.uuid, uuid));
  if (!page) {
    await cxn.end();
    throw new NotFoundResponse(`No page found for uuid "${uuid}"`);
  }
  const { notebookUuid, notebookPageId, cid } = page;
  await authenticateNotebook({ notebookUuid, token, requestId });
  return { notebookUuid, notebookPageId, requestId, cid };
};

export const loader = async (args: LoaderArgs) => {
  const { notebookUuid, notebookPageId, requestId } = await authenticateEmbed(
    args
  );
  const cxn = await getMysql(requestId);
  const title = await getTitleState({
    notebookUuid,
    notebookPageId,
    requestId,
  });
  await cxn.end();
  return { title };
};

export const action: ActionFunction = async (args) => {
  const { notebookUuid, notebookPageId, requestId, cid } =
    await authenticateEmbed(args);
  const cxn = await getMysql(requestId);
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
  const { data: newNotebookPageId } = await apiPost({
    path: `extensions/${app}/backend`,
    data: {
      type: "CREATE_PAGE",
      data: {
        notebookPageId,
        path: "Getting-Started-73dc4bf6a0e74a07adc25798a2f5b468",
      },
    },
    authorization,
  });
  const state = unwrapSchema(Automerge.load(body));
  state.content = state.content.replace("<%DATE:today%>", "April 07, 2023");
  await apiPost({
    path: `extensions/${app}/backend`,
    data: {
      type: "APPLY_STATE",
      data: {
        notebookPageId: newNotebookPageId,
        state,
      },
    },
    authorization,
  });
  return { success: true };
};

export default SingleWokflowEmbed;
