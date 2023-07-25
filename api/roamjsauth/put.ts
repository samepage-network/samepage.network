import { apps, oauthClients } from "data/schema";
import { eq } from "drizzle-orm/expressions";
import createAPIGatewayProxyHandler from "samepage/backend/createAPIGatewayProxyHandler";
import getMysql from "~/data/mysql.server";

const logic = async ({
  service,
  otp,
  requestId,
  auth,
}: {
  requestId: string;
  service: string;
  otp: string;
  auth: string;
}) => {
  const cxn = await getMysql(requestId);
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
    .onDuplicateKeyUpdate({ set: { secret: auth } });
  await cxn.end();
  return { success: true };
};

export default createAPIGatewayProxyHandler({ logic, allowedOrigins: [".*"] });
