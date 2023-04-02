import type { Handler } from "aws-lambda";
import { accessTokens, tokenNotebookLinks } from "data/schema";
import { and, eq } from "drizzle-orm/expressions";
import { z } from "zod";
import authenticateNotebook from "~/data/authenticateNotebook.server";
import getMysql from "~/data/mysql.server";

const zParams = z.object({
  authorization: z.string(),
});

export const handler: Handler = async (event, context) => {
  const { authorization } = zParams.parse(event);
  const requestId = context.awsRequestId;
  const cxn = await getMysql(requestId);
  const [uuid, token] = Buffer.from(
    authorization.replace(/^Basic /, ""),
    "base64"
  )
    .toString()
    .split(":");
  const { notebookUuid, tokenUuid } = await authenticateNotebook({
    requestId,
    notebookUuid: uuid,
    token,
  });
  const [accessTokenRecord] = await cxn
    .select({
      value: accessTokens.value,
    })
    .from(accessTokens)
    .innerJoin(
      tokenNotebookLinks,
      eq(tokenNotebookLinks.notebookUuid, accessTokens.notebookUuid)
    )
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
  return { accessToken: accessTokenRecord.value };
};
