import { apps, oauthClients } from "data/schema";
import { and, eq } from "drizzle-orm";
import createAPIGatewayProxyHandler from "samepage/backend/createAPIGatewayProxyHandler";
import getPostgres from "~/data/pg.server";
import { z } from "zod";
import { BackendRequest } from "dist/internal/types";

const bodySchema = z.object({ state: z.string() });

const logic = async ({
  state,
  requestId: _,
}: BackendRequest<typeof bodySchema>) => {
  const cxn = await getPostgres();
  const [service, otp] = state.split("_");
  const [oauth] = await cxn
    .select({
      secret: oauthClients.secret,
    })
    .from(oauthClients)
    .innerJoin(apps, eq(apps.id, oauthClients.appId))
    .where(and(eq(oauthClients.id, otp), eq(apps.code, service)));
  // await cxn.end();
  return { success: !!oauth };
};

export default createAPIGatewayProxyHandler({
  logic,
  allowedOrigins: [".*"],
  bodySchema,
});
