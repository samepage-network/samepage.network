import { accessTokens } from "data/schema";
import { eq } from "drizzle-orm/expressions";
import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";
import { BackendRequest } from "package/internal/types";
import getMysql from "~/data/mysql.server";
import { z } from "zod";
import { UnauthorizedError } from "~/data/errors.server";
import { MySql2Database } from "drizzle-orm/mysql2";
import { MySqlColumn } from "drizzle-orm/mysql-core";

const bodySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
});

type Column = {
  data: string;
  driverParam: string | number;
  notNull: true;
  hasDefault: true;
  tableName: "access_tokens";
};

const fetchAccessToken = async (
  cxn: MySql2Database,
  field: MySqlColumn<Column>,
  value: string
) => {
  const accessTokenByCode = await cxn
    .select({ accessToken: accessTokens.value })
    .from(accessTokens)
    .where(eq(field, value));

  if (!accessTokenByCode) {
    throw new UnauthorizedError(
      "No access token found for the provided identifier"
    );
  }

  return accessTokenByCode[0]?.accessToken;
};

const logic = async (args: BackendRequest<typeof bodySchema>) => {
  const cxn = await getMysql(args.requestId);

  let returnedAccessToken;
  if (args?.code) {
    returnedAccessToken = await fetchAccessToken(
      cxn,
      accessTokens.code,
      args.code
    );
  } else if (args?.state) {
    returnedAccessToken = await fetchAccessToken(
      cxn,
      accessTokens.state,
      args.state
    );
  }

  await cxn.end();
  return { accessToken: returnedAccessToken };
};

export default createAPIGatewayProxyHandler({
  logic,
  allowedOrigins: [/.*/],
  bodySchema,
});
