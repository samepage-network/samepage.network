import React from "react";
import { DataFunctionArgs, redirect } from "@remix-run/node";
import getUserId from "~/data/getUserId.server";
import { useLoaderData } from "@remix-run/react";
import axios from "axios";
import parseRemixContext from "~/data/parseRemixContext.server";
import getOrGenerateNotebookUuid from "~/data/getOrGenerateNotebookUuid.server";
import getMysql from "~/data/mysql.server";
import {
  accessTokens,
  apps,
  authorizationCodes,
  oauthClients,
  tokens,
} from "data/schema";
import { eq } from "drizzle-orm/expressions";
import { sql } from "drizzle-orm/sql";
import randomString from "~/data/randomString.server";
import { zOauthResponse } from "package/internal/types";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const OauthConnectionPage = (): React.ReactElement => {
  const data = useLoaderData<typeof loadData>();
  return "error" in data ? (
    <div className="text-red-800">{data.error}</div>
  ) : data.success ? (
    <div>
      <h1 className="text-3xl font-bold mb-2">Success!</h1>
      {data.body.suggestExtension && (
        // check if chrome extension is installed, and if not, then show this message
        <div className="mb-2">
          We recommend installing the SamePage Chrome extension to use with{" "}
          {data.body.appName}. You can install it to your browser by{" "}
          <a
            href="https://chrome.google.com/webstore/category/extensions"
            className="text-sky-400"
          >
            clicking here!
          </a>
        </div>
      )}
      <div className="mb-2">
        You can close this window and use SamePage within your newly connected
        notebook:
      </div>
      <div>
        <span className="text-xl font-bold">{data.body.appName}</span>{" "}
        <span>{data.body.workspace}</span>
      </div>
    </div>
  ) : (
    <div>
      <div>Something went wrong. Please try again.</div>
      <div className="text-red-800 bg-red-200 border border-red-800 rounded-md">
        Error: <code>{JSON.stringify(data.body)}</code>
      </div>
    </div>
  );
};

const loadData = async ({
  userId,
  requestId,
  searchParams,
  params,
}: {
  userId: string;
  requestId: string;
  searchParams: Record<string, string>;
  params: Record<string, string | undefined>;
}) => {
  const { id = "" } = params;
  const { code, state, error, ...customParams } = searchParams;
  const cxn = await getMysql(requestId);
  const [app] = await cxn
    .select({ name: apps.name, id: apps.id })
    .from(apps)
    .where(eq(apps.code, id));
  if (!app) {
    return { error: `App ${id} is not currently supported on SamePage` };
  }
  const { name: appName, id: appId } = app;
  if (error) {
    return { error: `Failed to install SamePage to ${appName}: ${error}` };
  }
  const response = await axios
    .post(`${process.env.API_URL}/extensions/${id}/oauth`, {
      code,
      state,
      userId,
      customParams,
    })
    .then((r) => ({
      body: zOauthResponse.parse(r.data),
      success: true as const,
    }))
    .catch((e) => ({ body: e.response.data, success: false as const }));

  if (response.success) {
    const [{ uuid: tokenUuid }] = await cxn
      .select({ uuid: tokens.uuid })
      .from(tokens)
      .where(eq(tokens.userId, userId));
    const notebookUuid = await getOrGenerateNotebookUuid({
      requestId,
      app: appId,
      workspace: response.body.workspace,
      tokenUuid,
    });
    await cxn
      .insert(accessTokens)
      .values({
        uuid: sql`UUID()`,
        notebookUuid,
        value: response.body.accessToken,
        userId,
      })
      .onDuplicateKeyUpdate({ set: { value: response.body.accessToken } });
    return {
      success: true,
      body: {
        appName,
        workspace: response.body.label || response.body.workspace,
        suggestExtension: response.body.suggestExtension,
      },
    };
  }
  return response;
};

export const loader = async (args: DataFunctionArgs) => {
  const { request, params, context } = args;
  const userId = await getUserId(args);
  if (!userId) {
    return redirect(`/login?redirect=${encodeURIComponent(request.url)})}`);
  }
  const requestId = parseRemixContext(context).lambdaContext.awsRequestId;
  const searchParams = Object.fromEntries(new URL(request.url).searchParams);

  // the app is using SamePage as the OAuth provider
  if (searchParams.client_uri) {
    const { id = "" } = params;
    const cxn = await getMysql(requestId);
    const [client] = await cxn
      .select({ id: oauthClients.id })
      .from(oauthClients)
      .innerJoin(apps, eq(apps.id, oauthClients.appId))
      .where(eq(apps.code, id));
    const code = await randomString({
      length: 18,
      encoding: "base64url",
    });
    await cxn.insert(authorizationCodes).values({
      redirectUri: searchParams.client_uri,
      userId,
      clientId: client.id,
      code,
    });
    await cxn.end();
    return redirect(
      `${searchParams.client_uri}?code=${code}&state=${searchParams.state}`
    );
  }

  // SamePage is using the app as the OAuth provider
  return loadData({ userId, requestId, params, searchParams });
};

export default OauthConnectionPage;
