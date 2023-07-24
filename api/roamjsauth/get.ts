import { apps, oauthClients } from "data/schema";
import { and, eq } from "drizzle-orm/expressions";
import createAPIGatewayProxyHandler from "samepage/backend/createAPIGatewayProxyHandler";
import getMysql from "~/data/mysql.server";

const logic = async ({
  state,
  requestId,
}: {
  requestId: string;
  state: string;
}) => {
  const cxn = await getMysql(requestId);
  const [service, otp] = state.split("_");
  const [oauth] = await cxn
    .select({
      secret: oauthClients.secret,
    })
    .from(oauthClients)
    .innerJoin(apps, eq(apps.id, oauthClients.appId))
    .where(and(eq(oauthClients.id, otp), eq(apps.code, service)));
  await cxn.end();
  return { success: !!oauth };
};

export default createAPIGatewayProxyHandler({ logic, allowedOrigins: [".*"] });
