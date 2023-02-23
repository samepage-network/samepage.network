import { getAuth } from "@clerk/remix/ssr.server";
import { LoaderFunction, redirect } from "@remix-run/node";

const remixAuthedLoader: LoaderFunction = ({ request }) => {
  return getAuth(request).then((authData) => {
    if (!!authData.userId) {
      return redirect("/user");
    }
    return {};
  });
};

export default remixAuthedLoader;
