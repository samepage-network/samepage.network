import { users } from "@clerk/clerk-sdk-node";
import type { Handler } from "aws-lambda";
import { tokens } from "data/schema";
import { eq } from "drizzle-orm/expressions";
import {
  OnboardNotebookResponse,
  zOnboardNotebookPayload,
} from "package/backend/types";
import {
  InternalServorError,
  NotFoundError,
  UnauthorizedError,
} from "~/data/errors.server";
import getOrGenerateNotebookUuid from "~/data/getOrGenerateNotebookUuid.server";
import getMysql from "~/data/mysql.server";

export const handler: Handler<unknown, OnboardNotebookResponse> = async (
  event,
  context
) => {
  const { email, password, app, workspace, label } =
    zOnboardNotebookPayload.parse(event);
  const userId = await users
    .getUserList({ emailAddress: [email] })
    .then((u) => u[0].id);
  if (!userId) {
    throw new NotFoundError("Could not find user");
  }
  const { verified } = await users
    .verifyPassword({ userId, password })
    .catch(() => ({ verified: false }));
  if (!verified) {
    throw new UnauthorizedError("Invalid password");
  }
  const requestId = context.awsRequestId;
  const cxn = await getMysql(requestId);
  const [tokenRecord] = await cxn
    .select({ uuid: tokens.uuid, value: tokens.value })
    .from(tokens)
    .where(eq(tokens.userId, userId));
  if (!tokenRecord) {
    throw new InternalServorError("No token found");
  }

  const notebookUuid = await getOrGenerateNotebookUuid({
    app,
    workspace,
    requestId,
    tokenUuid: tokenRecord.uuid,
    label,
  });

  await cxn.end();
  return { notebookUuid, token: tokenRecord.value };
};
