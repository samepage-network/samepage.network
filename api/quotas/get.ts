import { quotas } from "data/schema";
import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";
import getMysql from "~/data/mysql.server";

const logic = async ({ requestId }: { requestId: string }) => {
  const cxn = await getMysql(requestId);
  return {
    quotas: await cxn
      .select()
      .from(quotas)
      .then(async (quotas) => {
        await cxn.end();
        return quotas;
      }),
  };
};

export const handler = createAPIGatewayProxyHandler({
  logic,
  allowedOrigins: [/.*/],
});
