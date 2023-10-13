import { v4 } from "uuid";
import { UnauthorizedError } from "./errors.server";
import { users } from "@clerk/clerk-sdk-node";

const authenticateRoamJSToken = async ({
  authorization,
  requestId,
}: {
  authorization?: string;
  requestId?: string;
}) => {
  if (!authorization) {
    throw new UnauthorizedError("No authorization header provided");
  }

  const allUsers = await users.getUserList({
    emailAddress: ["dvargas92495@gmail.com"],
  });
  const user = allUsers[0];

  return {
    notebookUuid: user.id,
    token: authorization,
  };
};

export default authenticateRoamJSToken;
