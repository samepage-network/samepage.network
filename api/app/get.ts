import { apps } from "data/schema";
import { eq } from "drizzle-orm/expressions";
import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";
import { NotFoundError } from "~/data/errors.server";
import getMysql from "~/data/mysql.server";

const logic = async ({
  requestId,
  code,
}: {
  requestId: string;
  code: string;
}) => {
  const cxn = await getMysql(requestId);
  const [info] = await cxn
    .select({
      appName: apps.name,
      workspaceLabel: apps.workspaceLabel,
    })
    .from(apps)
    .where(eq(apps.code, code));
  await cxn.end();
  if (!info) throw new NotFoundError(`App ${code} not found`);
  return info;
};

export const handler = createAPIGatewayProxyHandler({
  logic,
  allowedOrigins: [/.*/],
});
