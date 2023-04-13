import { getAuth } from "@clerk/remix/ssr.server";
import { DataFunctionArgs } from "@remix-run/node";
import { offlinePrefs } from "./cookies.server";

const getUserId = async (args: DataFunctionArgs) => {
  const get = () => getAuth(args).then((authData) => authData.userId);
  return process.env.NODE_ENV === "development"
    ? get().catch(() =>
        offlinePrefs
          .parse(args.request.headers.get("Cookie"))
          .then((cookie) => cookie?.userId as string)
      )
    : get();
};

export default getUserId;
