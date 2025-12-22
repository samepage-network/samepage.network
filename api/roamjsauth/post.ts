import { apps, oauthClients } from "data/schema-postgres";
import { and, eq } from "drizzle-orm";
import createAPIGatewayProxyHandler from "samepage/backend/createAPIGatewayProxyHandler";
import getPostgres from "~/data/pg.server";

const logic = async ({
  service,
  otp,
  requestId: _,
}: {
  requestId: string;
  service: string;
  otp: string;
}) => {
  const cxn = await getPostgres();
  const [oauth] = await cxn
    .select({
      secret: oauthClients.secret,
    })
    .from(oauthClients)
    .innerJoin(apps, eq(apps.id, oauthClients.appId))
    .where(and(eq(oauthClients.id, otp), eq(apps.code, service)));
  // await cxn.end();
  if (!oauth) return { code: 204 };
  return { auth: oauth.secret };
};

export default createAPIGatewayProxyHandler({ logic, allowedOrigins: [".*"] });
