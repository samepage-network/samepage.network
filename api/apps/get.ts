import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";
import listApps from "~/data/listApps.server";
import getMysql from "~/data/mysql.server";

const logic = async ({ requestId }: { requestId: string }) => ({
  apps: await listApps({ requestId }).then(async (apps) => {
    const cxn = await getMysql(requestId);
    await cxn.end();
    return apps;
  }),
});

export const handler = createAPIGatewayProxyHandler({
  logic,
  allowedOrigins: ["https://roamresearch.com", "https://logseq.com"],
});
