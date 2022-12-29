import { getAuth } from "@clerk/remix/ssr.server";
import { offlinePrefs } from "./cookies.server";

const getUserId = (request: Request) => {
  const get = () => getAuth(request).then((authData) => authData.userId);
  return Promise.resolve(
    process.env.NODE_ENV === "development"
      ? offlinePrefs
          .parse(request.headers.get("Cookie"))
          .then((cookie) => (cookie?.userId as string) || get())
      : get()
  );
};

export default getUserId;
