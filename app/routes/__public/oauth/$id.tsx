import React from "react";
import { DataFunctionArgs, redirect } from "@remix-run/node";
import getUserId from "~/data/getUserId.server";
import { useLoaderData } from "@remix-run/react";
import { appsByCode, appsById } from "package/internal/apps";
import axios from "axios";
import parseRemixContext from "~/data/parseRemixContext.server";
import getOrGenerateNotebookUuid from "~/data/getOrGenerateNotebookUuid.server";
import getMysql from "~/data/mysql.server";
import { accessTokens, tokenNotebookLinks, tokens } from "data/schema";
import { eq } from "drizzle-orm/expressions";
import { sql } from "drizzle-orm/sql";
export { default as CatchBoundary } from "~/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const OauthConnectionPage = (): React.ReactElement => {
  const data = useLoaderData<Awaited<ReturnType<typeof loadData>>>();
  return "error" in data ? (
    <div className="text-red-800">{data.error}</div>
  ) : data.success ? (
    <div>
      <div>Success!</div>
      <div>
        You can close this window now and use SamePage within your newly
        connected notebook:
      </div>
      <div>
        <span className="text-xl font-bold">{data.data.appName}</span>{" "}
        <span>{data.data.workspace}</span>
      </div>
    </div>
  ) : (
    <div>
      <div>Something went wrong. Please try again.</div>
      <div className="text-red-800 bg-red-200 border border-red-800 rounded-md">
        Error: <code>{JSON.stringify(data.data)}</code>
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
  const { code, state, error } = searchParams;
  const appName = appsByCode[id]?.name;
  if (!appName) {
    return { error: `App ${id} is not currently supported on SamePage` };
  }
  if (error) {
    return { error: `Failed to install SamePage to ${appName}: ${error}` };
  }
  const response = await axios
    .post<{ app: number; workspace: string; accessToken: string }>(
      `${process.env.API_URL}/extensions/${id}/oauth`,
      {
        code,
        state,
        userId,
      }
    )
    .then((r) => ({ data: r.data, success: true }))
    .catch((e) => ({ data: e.response.data, success: false }));

  if (response.success) {
    const cxn = await getMysql(requestId);
    const notebookUuid = await getOrGenerateNotebookUuid({
      requestId,
      app: response.data.app,
      workspace: response.data.workspace,
    });
    const [{ uuid: tokenUuid }] = await cxn
      .select({ uuid: tokens.uuid })
      .from(tokens)
      .where(eq(tokens.userId, userId));
    await cxn.insert(tokenNotebookLinks).values({
      uuid: sql`UUID()`,
      tokenUuid,
      notebookUuid,
    });
    await cxn.insert(accessTokens).values({
      uuid: sql`UUID()`,
      notebookUuid,
      value: response.data.accessToken,
    })
    return {
      success: true,
      data: {
        appName: appsById[response.data.app].name,
        workspace: response.data.workspace,
      },
    };
  }
  return response;
};

export const loader = async ({
  request,
  params,
  context,
}: DataFunctionArgs) => {
  const userId = await getUserId(request);
  if (!userId) {
    return redirect(`/login?redirect=${encodeURIComponent(request.url)})}`);
  }
  const requestId = parseRemixContext(context).lambdaContext.awsRequestId;
  const searchParams = Object.fromEntries(new URL(request.url).searchParams);
  return loadData({ userId, requestId, params, searchParams });
};

export default OauthConnectionPage;
