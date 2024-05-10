import { accessTokens } from "data/schema";
import { eq } from "drizzle-orm/expressions";
import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";
import { BackendRequest } from "package/internal/types";
import getMysql from "~/data/mysql.server";
import { z } from "zod";
import { UnauthorizedError } from "~/data/errors.server";
import { MySql2Database } from "drizzle-orm/mysql2";
import { MySqlColumn } from "drizzle-orm/mysql-core";
import ServerError from "package/backend/ServerError";

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

const maskString = (s = "") =>
  `${s
    .split("")
    .slice(0, -4)
    .map(() => "*")
    .join("")}${s.slice(-4)}`;

const logic = async (args: BackendRequest<typeof bodySchema>) => {
  const cxn = await getMysql(args.requestId);

  let returnedAccessToken;
  try {
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
  } catch (e) {
    const error = e as Error;
    await cxn.end();
    console.error("Failed to fetch access token");
    console.error(e);
    console.error("Arguments:");
    const maskedArgs = {
      ...args,
      code: maskString(args.code),
      state: maskString(args.state),
    };
    console.error(maskedArgs);
    throw new ServerError(
      `Failed to get installation details: ${error.message}`,
      401
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
