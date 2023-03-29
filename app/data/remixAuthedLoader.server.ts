import { getAuth } from "@clerk/remix/ssr.server";
import { LoaderFunction, redirect } from "@remix-run/node";
import { apps, oauthClients } from "data/schema";
import { eq } from "drizzle-orm/expressions";
import getMysql from "./mysql.server";

const remixAuthedLoader: LoaderFunction = async ({ request }) => {
  const authData = await getAuth(request);
  const searchParams = new URL(request.url).searchParams;
  if (!!authData.userId) {
    return redirect("/user");
  }
  const redirectParam = decodeURIComponent(searchParams.get("redirect") || "");
  if (redirectParam) {
    return {
      redirectUrl: redirectParam,
    };
  }
  const responseType = searchParams.get("response_type") || "";
  const redirectUri = searchParams.get("redirect_uri") || "";
  if (responseType === "code" && redirectUri) {
    const clientId = searchParams.get("client_id") || "";
    const cxn = await getMysql();
    const [app] = await cxn
      .select({ app: apps.code })
      .from(oauthClients)
      .innerJoin(apps, eq(apps.id, oauthClients.appId))
      .where(eq(oauthClients.id, clientId));
    await cxn.end();
    if (app) {
      return {
        redirectUrl: `/oauth/${app.app}?client_uri=${redirectUri}`,
      };
    }
  }
  return {
    redirectUrl: "/install?refresh=true",
  };
};

export default remixAuthedLoader;
