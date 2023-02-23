import type { LoaderFunction } from "@remix-run/node";
import remixAppLoader from "./remixAppLoader.server";

const isAdminLoader: LoaderFunction = (args) => {
  return remixAppLoader(args, async ({ userId }) => {
    const user = await import("@clerk/clerk-sdk-node").then((clerk) =>
      clerk.users.getUser(userId)
    );
    const isAdmin = user.emailAddresses.some((e) =>
      e.emailAddress?.endsWith("samepage.network")
    );
    return { isAdmin };
  });
};

export default isAdminLoader;
