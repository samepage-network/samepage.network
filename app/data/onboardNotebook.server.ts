import { users } from "@clerk/clerk-sdk-node";
import { tokens } from "data/schema";
import { eq } from "drizzle-orm/expressions";
import { OnboardNotebookPayload } from "samepage/backend/types";
import {
  NotFoundError,
  UnauthorizedError,
  InternalServorError,
} from "./errors.server";
import getOrGenerateNotebookUuid from "./getOrGenerateNotebookUuid.server";
import getMysql from "./mysql.server";

const onboardNotebook = async ({
  email,
  password,
  label,
  app,
  workspace,
  requestId,
}: OnboardNotebookPayload & { requestId: string }) => {
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

  return { notebookUuid, token: tokenRecord.value };
};

export default onboardNotebook;
