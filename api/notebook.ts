import { users } from "@clerk/clerk-sdk-node";
import type { Handler } from "aws-lambda";
import { apps, notebooks, tokenNotebookLinks, tokens } from "data/schema";
import { and, eq } from "drizzle-orm/expressions";
import {
  GetNotebookCredentialsResponse,
  zGetNotebookCredentialsPayload,
} from "package/backend/types";
import { NotFoundError, UnauthorizedError } from "~/data/errors.server";
import getMysql from "~/data/mysql.server";

export const handler: Handler<unknown, GetNotebookCredentialsResponse> = async (
  event,
  context
) => {
  const { email, app, workspace } = zGetNotebookCredentialsPayload.parse(event);
  const requestId = context.awsRequestId;
  const userId = await users
    .getUserList({ emailAddress: [email] })
    .then((u) => u[0]?.id);
  if (!userId) {
    throw new UnauthorizedError(`No SamePage user found with ${email}`);
  }

  const cxn = await getMysql(requestId);
  const [notebook] = await cxn
    .select({
      uuid: notebooks.uuid,
      token: tokens.value,
    })
    .from(notebooks)
    .innerJoin(
      tokenNotebookLinks,
      eq(tokenNotebookLinks.notebookUuid, notebooks.uuid)
    )
    .innerJoin(apps, eq(apps.id, notebooks.app))
    .innerJoin(tokens, eq(tokenNotebookLinks.tokenUuid, tokens.uuid))
    .where(
      and(
        eq(notebooks.workspace, workspace),
        eq(apps.code, app),
        eq(tokens.userId, userId)
      )
    );
  await cxn.end();

  if (!notebook) {
    throw new NotFoundError(
      `No ${app} notebook found with workspace name ${workspace} under account ${email}`
    );
  }
  return notebook;
};
