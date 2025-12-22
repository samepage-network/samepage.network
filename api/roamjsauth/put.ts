import { apps, oauthClients } from "data/schema-postgres";
import { eq } from "drizzle-orm";
import createAPIGatewayProxyHandler from "samepage/backend/createAPIGatewayProxyHandler";
import getPostgres from "~/data/pg.server";

const logic = async ({
  service,
  otp,
  requestId: _,
  auth,
}: {
  requestId: string;
  service: string;
  otp: string;
  auth: string;
}) => {
  const cxn = await getPostgres();
  const appId = await cxn
    .select({ id: apps.id })
    .from(apps)
    .where(eq(apps.code, service))
    .then(([{ id }]) => id);
  await cxn
    .insert(oauthClients)
    .values({
      secret: auth,
      appId,
      id: otp,
    })
    .onConflictDoUpdate({ target: oauthClients.id, set: { secret: auth } });
  // await cxn.end();
  return { success: true };
};

export default createAPIGatewayProxyHandler({ logic, allowedOrigins: [".*"] });
