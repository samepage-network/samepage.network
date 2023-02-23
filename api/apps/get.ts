import createAPIGatewayProxyHandler from "~/data/createAPIGatewayProxyHandler.server";
import APPS from "package/internal/apps";

const logic = () => ({
  apps: Object.fromEntries(APPS.map(({ id, ...app }) => [id, app])),
});

export const handler = createAPIGatewayProxyHandler({
  logic,
  allowedOrigins: ["https://roamresearch.com", "https://logseq.com"],
});
