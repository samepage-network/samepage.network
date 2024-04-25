import { users } from "@clerk/clerk-sdk-node";
import { tokens } from "data/schema";
import { eq } from "drizzle-orm/expressions";
import {
  NotFoundError,
  UnauthorizedError,
  InternalServerError,
} from "./errors.server";
import getMysql from "./mysql.server";

const verifyUser = async ({
  email,
  password,
  requestId,
}: {
  email: string;
  password: string;
  requestId: string;
}) => {
  const userId = await users
    .getUserList({ emailAddress: [email] })
    .then((u) => u[0]?.id);
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
    .select({ uuid: tokens.uuid, value: tokens.value, userId: tokens.userId })
    .from(tokens)
    .where(eq(tokens.userId, userId));
  if (!tokenRecord) {
    await cxn.end();
    throw new InternalServerError("No token found");
  }
  return tokenRecord;
};

export default verifyUser;
