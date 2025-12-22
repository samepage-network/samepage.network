import React, { useEffect, useState } from "react";
import { DataFunctionArgs, redirect } from "@remix-run/node";
import getUserId from "~/data/getUserId.server";
import { useLoaderData } from "@remix-run/react";
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
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm/sql";
import randomString from "~/data/randomString.server";
import { zOauthResponse } from "package/internal/types";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import { apiPost } from "package/internal/apiClient";

const OauthConnectionPage = (): React.ReactElement => {
  const data = useLoaderData<typeof loadData>();
  const [message, setMessage] = useState<string>("Please Wait");
  const postMessage = () => {
    if (window.opener && !window.opener.closed && "accessToken" in data) {
      window.opener.postMessage(data.accessToken, "*");
    }
    if ("state" in data) {
      let attemptAmount = 0;
      const check = () => {
        if (attemptAmount < 30) {
          apiPost({
            path: "access-token",
            data: { state: data.state },
          }).then((r) => {
            if (r?.accessToken) {
              setMessage("Success! You may close this page.");
              setTimeout(() => window.close(), 4000);
            } else {
              attemptAmount++;
              setTimeout(check, 1000);
            }
          });
        } else {
          setMessage(
            `If you are using the app instead of the browser, please authorize in app.
            Otherwise please contact mclicks+samepage@gmail.com`
          );
        }
      };
      setTimeout(check, 1500);
    }
  };

  useEffect(() => {
    postMessage();
  }, []);

  return "error" in data ? (
    <div className="text-red-800">{data.error}</div>
  ) : "accessToken" in data ? (
    <div className="text-center">{message}</div>
  ) : data.success ? (
    <div>
      <h1 className="text-3xl font-bold mb-2">Success!</h1>
      {data.body?.suggestExtension && (
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
      {"roamjs" in data ? (
        <div className="mb-2">You can close this window</div>
      ) : (
        <>
          <div className="mb-2">
            You can close this window and use SamePage within your newly
            connected notebook:
          </div>
          <div className="mb-8">
            <span className="text-xl font-bold">{data.body.appName}</span>{" "}
            <span>{data.body.workspace}</span>
          </div>
        </>
      )}
      {data.body && !data.body.postInstallResult?.success && (
        <div>
          Our post-install process failed however, with the following reason{" "}
          {data.body.postInstallResult.reason}. Our support team has already
          been notified.
        </div>
      )}
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
  console.log("loadData searchParams", searchParams);
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
  const response = await apiPost(`extensions/${id}/oauth`, {
    code,
    state,
    userId,
    grant_type: "authorization_code",
    customParams,
  })
    .then((r) => ({
      body: zOauthResponse.parse(r),
      success: true as const,
    }))
    .catch((e) => ({ body: e.message, success: false as const }));

  if (response.success) {
    const [{ uuid: tokenUuid, token }] = await cxn
      .select({ uuid: tokens.uuid, token: tokens.value })
      .from(tokens)
      .where(eq(tokens.userId, userId));
    const notebookUuid = await getOrGenerateNotebookUuid({
      requestId,
      app: appId,
      workspace: response.body.workspace,
      tokenUuid,
      label: response.body.label,
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
    const postInstallResult = response.body.postInstall
      ? await apiPost<{ success: false; reason: string } | { success: true }>(
          `extensions/${id}/postinstall`,
          {
            workspace: response.body.workspace,
            accessToken: response.body.accessToken,
            notebookUuid,
            token,
          }
        )
      : { success: true as const };
    if (!postInstallResult.success)
      await apiPost({
        path: "errors",
        data: {
          method: "web-app-error",
          path: `/oauth/${id}`,
          stack: postInstallResult.reason,
          data: {
            notebookUuid,
          },
        },
      });

    return {
      success: true,
      body: {
        appName,
        workspace: response.body.label || response.body.workspace,
        suggestExtension:
          process.env.NODE_ENV === "development" &&
          response.body.suggestExtension,
        postInstallResult,
      },
    };
  }
  return response;
};

const getAnonymousAccessToken = async ({
  requestId,
  params,
  searchParams,
}: {
  requestId: string;
  params: Record<string, string | undefined>;
  searchParams: Record<string, string>;
}) => {
  const { id = "" } = params;
  const { code, installation_id, state, ...customParams } = searchParams;
  const cxn = await getMysql(requestId);

  const accessTokenByCode = await cxn
    .select({ accessToken: accessTokens.value })
    .from(accessTokens)
    .where(eq(accessTokens.code, searchParams.code))
    .execute();

  if (accessTokenByCode.length) {
    return {
      accessToken: accessTokenByCode[0].accessToken,
      state: state || "",
    };
  }

  const response = await apiPost(`extensions/${id}/oauth`, {
    code,
    state,
    grant_type: "authorization_code",
    customParams,
  })
    .then((r) => ({
      body: zOauthResponse.parse(r),
      success: true as const,
    }))
    .catch((e) => ({ body: e.message, success: false as const }));

  if (response.success) {
    try {
      await cxn.insert(accessTokens).values({
        uuid: sql`UUID()`,
        value: response.body.accessToken,
        code,
        installationId: installation_id || "",
        userId: installation_id || "",
        state: state || "",
      });
      return { accessToken: response.body.accessToken, state: state || "" };
    } catch (error) {
      console.error("Failed to insert or update access token:", error);
      return { error: "Database operation failed." };
    }
  }

  return response;
};

export const loader = async (args: DataFunctionArgs) => {
  const { request, params, context } = args;
  const searchParams = Object.fromEntries(new URL(request.url).searchParams);
  const requestId = parseRemixContext(context).lambdaContext.awsRequestId;

  if (searchParams.anonymous === "true") {
    return getAnonymousAccessToken({ requestId, params, searchParams });
  }

  const userId = await getUserId(args);
  if (!userId) {
    return redirect(`/login?redirect=${encodeURIComponent(request.url)}`);
  }

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
