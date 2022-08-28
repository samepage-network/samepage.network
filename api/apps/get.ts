import createAPIGatewayProxyHandler from "@dvargas92495/app/backend/createAPIGatewayProxyHandler.server";
import { APPS } from "@samepage/shared";

const logic = () => ({
  apps: Object.fromEntries(APPS.map(({ id, ...app }) => [id, app])),
});

export const handler = createAPIGatewayProxyHandler({
  logic,
  allowedOrigins: ["https://roamresearch.com", "https://logseq.com"],
});
