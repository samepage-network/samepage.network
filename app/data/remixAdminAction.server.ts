import { users } from "@clerk/clerk-sdk-node";
import { LoaderFunction } from "@remix-run/node";
import { UnauthorizedError } from "~/data/errors.server";
import remixAppAction, {
  RemixAppActionCallback,
} from "~/data/remixAppAction.server";

const verifyUser = (userId: string) =>
  users.getUser(userId).then((user) => {
    const isAdmin = user.emailAddresses.find((u) =>
      u.emailAddress?.endsWith("samepage.network")
    );
    if (!isAdmin) {
      throw new UnauthorizedError(
        `Must be an admin account to access this method`
      );
    }
    return Promise.resolve();
  });

const remixAdminAction = (
  args: Parameters<LoaderFunction>[0],
  callback?: RemixAppActionCallback
) => {
  return remixAppAction(
    args,
    typeof callback === "object"
      ? Object.fromEntries(
          Object.entries(callback).map(([method, handler]) => [
            method,
            (data) => verifyUser(data.userId).then(() => handler(data)),
          ])
        )
      : typeof callback === "function"
      ? (data) => verifyUser(data.userId).then(() => callback(data))
      : undefined
  );
};

export default remixAdminAction;
