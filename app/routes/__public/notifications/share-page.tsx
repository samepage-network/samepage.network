import { LoaderArgs } from "@remix-run/node";
import {
  accessTokens,
  messages,
  tokenNotebookLinks,
  tokens,
} from "data/schema";
import { and, eq } from "drizzle-orm/expressions";
import acceptSharePageOperation from "package/internal/acceptSharePageOperation";
import { apiPost } from "package/internal/apiClient";
import setupRegistry from "package/internal/registry";
import getUserId from "~/data/getUserId.server";
import getMysql from "~/data/mysql.server";
import parseRemixContext from "~/data/parseRemixContext.server";
import {
  BadRequestResponse,
  UnauthorizedResponse,
} from "~/data/responses.server";

export { default as CatchBoundary } from "~/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const SharePageOperationPage = () => {
  return <div>Success!</div>;
};

export const loader = async ({ request, context }: LoaderArgs) => {
  const userId = await getUserId(request);
  if (!userId) {
    // TODO - login/signup redirect instead of 401
    throw new UnauthorizedResponse(
      `Cannot access this page without being logged in`
    );
  }
  const requestId = parseRemixContext(context).lambdaContext.awsRequestId;
  const searchParams = Object.fromEntries(new URL(request.url).searchParams);
  const messageUuid = searchParams.uuid;
  const action = searchParams.action;
  if (action !== "accept") {
    throw new BadRequestResponse(`Unsupported action: ${action}`);
  }
  const cxn = await getMysql(requestId);
  const [{ notebookUuid, metadata }] = await cxn
    .select({
      notebookUuid: messages.target,
      metadata: messages.metadata,
    })
    .from(messages)
    .where(eq(messages.uuid, messageUuid));
  const [{ token, accessToken }] = await cxn
    .select({
      token: tokens.value,
      accessToken: accessTokens.value,
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
    .where(
      and(
        eq(tokenNotebookLinks.notebookUuid, notebookUuid),
        eq(tokens.userId, userId)
      )
    );
  await cxn.end();
  setupRegistry({
    getSetting: (s) => {
      if (s === "uuid") return notebookUuid;
      if (s === "token") return token;
      return "";
    },
  });
  await acceptSharePageOperation({
    doesPageExist: async () => false,
    initPage: async () => {},
    deletePage: async () => {},
    createPage: (notebookPageId) =>
      apiPost<{ data: string }>({
        path: `extensions/notion/backend`,
        data: {
          type: "CREATE_PAGE",
          data: {
            notebookPageId,
            path: `Getting-Started-73dc4bf6a0e74a07adc25798a2f5b468`,
          },
        },
        authorization: `Bearer ${accessToken}`,
      }).then((r) => r.data),
    openPage: async () => {},
    calculateState: (notebookPageId) =>
      apiPost({
        path: `extensions/notion/backend`,
        data: {
          type: "CALCULATE_STATE",
          data: {
            notebookPageId,
            notebookUuid,
          },
        },
        authorization: `Bearer ${accessToken}`,
      }),
    applyState: (notebookPageId, state) =>
      apiPost({
        path: `extensions/notion/backend`,
        data: {
          type: "APPLY_STATE",
          data: {
            notebookPageId,
            state,
          },
        },
        authorization: `Bearer ${accessToken}`,
      }),
    // @ts-ignore
  })(metadata);
  return { success: true };
};

export default SharePageOperationPage;
