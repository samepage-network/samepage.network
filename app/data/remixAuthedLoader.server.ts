import { getAuth } from "@clerk/remix/ssr.server";
import { LoaderFunction, redirect } from "@remix-run/node";
import { apps, oauthClients } from "data/schema";
import { eq } from "drizzle-orm/expressions";
import getMysql from "./mysql.server";
// http://localhost:3000/admin/emails/79781358-3d87-47f9-ae71-b9568baadb45
const remixAuthedLoader: LoaderFunction = async (args) => {
  console.log("remixAuthedLoader", args.request.url);
  const authData = await getAuth(args);
  console.log("authData", !!authData.user);
  const searchParams = new URL(args.request.url).searchParams;
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
      const redirectUrl = `/oauth/${app.app}?client_uri=${redirectUri}`;
      if (!!authData.userId) return redirect(redirectUrl);
      return {
        redirectUrl: `/oauth/${app.app}?client_uri=${redirectUri}`,
      };
    }
  }
  const redirectParam = decodeURIComponent(searchParams.get("redirect") || "");
  if (!!authData.userId) {
    return redirect(redirectParam || `/user`);
  }
  if (redirectParam) {
    return {
      redirectUrl: redirectParam,
    };
  }
  return {
    redirectUrl: "/install?refresh=true",
  };
};

export default remixAuthedLoader;
