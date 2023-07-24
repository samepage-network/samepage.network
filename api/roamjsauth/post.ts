import { apps, oauthClients } from "data/schema";
import { and, eq } from "drizzle-orm/expressions";
import createAPIGatewayProxyHandler from "samepage/backend/createAPIGatewayProxyHandler";
import getMysql from "~/data/mysql.server";

const logic = async ({
  service,
  otp,
  requestId,
}: {
  requestId: string;
  service: string;
  otp: string;
}) => {
  const cxn = await getMysql(requestId);
  const [oauth] = await cxn
    .select({
      secret: oauthClients.secret,
    })
    .from(oauthClients)
    .innerJoin(apps, eq(apps.id, oauthClients.appId))
    .where(and(eq(oauthClients.id, otp), eq(apps.code, service)));
  await cxn.end();
  if (!oauth) return { code: 204 };
  return { auth: oauth.secret };
};

export default createAPIGatewayProxyHandler({ logic, allowedOrigins: [".*"] });
