import { getAuth } from "@clerk/remix/ssr.server";
import { offlinePrefs } from "./cookies.server";

const getUserId = async (request: Request) => {
  const get = () => getAuth(request).then((authData) => authData.userId);
  return process.env.NODE_ENV === "development"
    ? get().catch(() =>
        offlinePrefs
          .parse(request.headers.get("Cookie"))
          .then((cookie) => cookie?.userId as string)
      )
    : get();
};

export default getUserId;
