import { users } from "@clerk/clerk-sdk-node";
import { AppData, LoaderFunction, redirect } from "@remix-run/node";
import remixAppLoader, {
  RemixAppLoaderCallback,
} from "./remixAppLoader.server";

const remixAdminLoader = <T = AppData>(
  args: Parameters<LoaderFunction>[0],
  callback?: RemixAppLoaderCallback<T>
): Promise<T> => {
  return remixAppLoader(args, (data) =>
    users.getUser(data.userId).then((user) => {
      const isAdmin = user.emailAddresses.find((u) =>
        u.emailAddress?.endsWith("samepage.network")
      );
      if (!isAdmin) {
        return redirect("/user");
      }
      return callback?.(data) || {};
    })
  );
};

export default remixAdminLoader;
