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

  const [email, roamjsToken] = Buffer.from(
    authorization.replace(/^Bearer /, ""),
    "base64"
  )
    .toString()
    .split(":");

  const allUsers = await users.getUserList({
    emailAddress: [email],
  });

  const user = allUsers.find(
    (u) =>
      (u.privateMetadata.roamjsMetadata as Record<string, string>)?.rawToken ===
      roamjsToken
  );
  if (!user)
    throw new UnauthorizedError("No SamePage user found with RoamJS token");

  return user.id;
};

export default authenticateRoamJSToken;
