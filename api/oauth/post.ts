import {
  accessTokens,
  authorizationCodes,
  oauthClients,
  tokenNotebookLinks,
  tokens,
} from "data/schema";
import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm/expressions";
import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";
import { zBaseHeaders } from "package/internal/types";
import { z } from "zod";
import { ConflictError, UnauthorizedError } from "~/data/errors.server";
import getOrGenerateNotebookUuid from "~/data/getOrGenerateNotebookUuid.server";
import getPrimaryUserEmail from "~/data/getPrimaryUserEmail.server";
import getMysql from "~/data/mysql.server";
import randomString from "~/data/randomString.server";

const bodySchema = z
  .object({
    grant_type: z.literal("authorization_code"),
    client_id: z.string(),
    client_secret: z.string(),
    code: z.string(),
    redirect_uri: z.string(),
  })
  .and(zBaseHeaders);

const logic = async (args: z.infer<typeof bodySchema>) => {
  const cxn = await getMysql(args.requestId);
  const [client] = await cxn
    .select({ secret: oauthClients.secret, appId: oauthClients.appId })
    .from(oauthClients)
    .where(eq(oauthClients.id, args.client_id));
  if (client.secret !== args.client_secret) {
    throw new UnauthorizedError(`Invalid client secret`);
  }
  const [authorization] = await cxn
    .select({
      expiresAt: authorizationCodes.expiresAt,
      userId: authorizationCodes.userId,
      redirectUri: authorizationCodes.redirectUri,
    })
    .from(authorizationCodes)
    .where(eq(authorizationCodes.code, args.code));
  if (!authorization) {
    throw new UnauthorizedError(`Invalid authorization code`);
  }
  if (authorization.expiresAt.valueOf() < new Date().valueOf()) {
    throw new UnauthorizedError(`Authorization code has expired`);
  }
  if (authorization.redirectUri !== args.redirect_uri) {
    throw new UnauthorizedError(`Invalid redirect URI`);
  }
  const email = await getPrimaryUserEmail(authorization.userId);
  if (!email) {
    throw new ConflictError(`Failed to find primary email for user`);
  }
  const [{ uuid: tokenUuid }] = await cxn
    .select({ uuid: tokens.uuid })
    .from(tokens)
    .where(eq(tokens.userId, authorization.userId));
  const notebookUuid = await getOrGenerateNotebookUuid({
    requestId: args.requestId,
    workspace: email,
    app: client.appId,
    tokenUuid,
  });
  await cxn.insert(tokenNotebookLinks).values({
    uuid: sql`UUID()`,
    tokenUuid,
    notebookUuid,
  });
  const access_token = await randomString({ length: 18, encoding: "base64url" });
  await cxn.insert(accessTokens).values({
    uuid: sql`UUID()`,
    notebookUuid,
    value: access_token,
  });
  await cxn.end();
  return {
    access_token: access_token,
  };
};

export default createAPIGatewayProxyHandler({ logic, bodySchema });
