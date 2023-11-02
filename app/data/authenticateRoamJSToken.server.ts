import { UnauthorizedError } from "./errors.server";
import { users } from "@clerk/clerk-sdk-node";

const authenticateRoamJSToken = async ({
  authorization,
}: {
  authorization?: string;
}) => {
  if (!authorization) {
    throw new UnauthorizedError("No authorization header provided");
  }

  const allUsers = await users.getUserList({
    emailAddress: ["dvargas92495@gmail.com"],
  });
  if (!allUsers.length)
    throw new UnauthorizedError("No SamePage user found with RoamJS token");

  const user = allUsers[0];

  console.log(user.privateMetadata);

  return user.id;
};

export default authenticateRoamJSToken;
