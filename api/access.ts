import type { Handler } from "aws-lambda";
import {
  accessTokens,
  notebooks,
  tokenNotebookLinks,
  tokens,
} from "data/schema";
import { and, eq } from "drizzle-orm/expressions";
import {
  GetAccessTokenResponse,
  zGetAccessTokenPayload,
} from "package/backend/types";
import unbase64 from "package/internal/unbase64";
import authenticateNotebook from "~/data/authenticateNotebook.server";
import getMysql from "~/data/mysql.server";

export const handler: Handler<unknown, GetAccessTokenResponse> = async (
  event,
  context
) => {
  const { authorization } = zGetAccessTokenPayload.parse(event);
  const requestId = context.awsRequestId;
  const cxn = await getMysql(requestId);
  const [uuid, token] = unbase64(authorization.replace(/^Basic /, "")).split(
    ":"
  );
  const { notebookUuid, tokenUuid } = await authenticateNotebook({
    requestId,
    notebookUuid: uuid,
    token,
  });
  const [accessTokenRecord] = await cxn
    .select({
      accessToken: accessTokens.value,
      workspace: notebooks.workspace,
      notebookUuid: notebooks.uuid,
      token: tokens.value,
    })
    .from(accessTokens)
    .innerJoin(
      tokenNotebookLinks,
      eq(tokenNotebookLinks.notebookUuid, accessTokens.notebookUuid)
    )
    .innerJoin(notebooks, eq(tokenNotebookLinks.notebookUuid, notebooks.uuid))
    .innerJoin(tokens, eq(tokenNotebookLinks.tokenUuid, tokens.uuid))
    .where(
      and(
        eq(accessTokens.notebookUuid, notebookUuid),
        eq(tokenNotebookLinks.tokenUuid, tokenUuid)
      )
    );
  if (!accessTokenRecord) {
    throw new Error("No access token found");
  }
  await cxn.end();
  return accessTokenRecord;
};
