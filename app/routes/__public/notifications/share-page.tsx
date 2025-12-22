import React, { useMemo } from "react";
import { LoaderArgs, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  accessTokens,
  apps,
  messages,
  notebooks,
  tokenNotebookLinks,
  tokens,
} from "data/schema";
import { and, eq } from "drizzle-orm";
import acceptSharePageOperation from "package/internal/acceptSharePageOperation";
import { apiPost } from "package/internal/apiClient";
import setupRegistry from "package/internal/registry";
import { useEffect } from "react";
import getUserId from "~/data/getUserId.server";
import getMysql from "~/data/mysql.server";
import parseRemixContext from "~/data/parseRemixContext.server";
import {
  BadRequestResponse,
  InternalServerResponse,
} from "package/utils/responses";
import { JSONData } from "package/internal/types";
import base64 from "package/internal/base64";

export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const REDIRECT_TIME = 10;

const SharePageOperationPage = () => {
  const { url, app } = useLoaderData<{
    success: true;
    url: string;
    app: string;
  }>();
  const startTime = useMemo(() => new Date().valueOf(), []);
  const endTime = useMemo(() => startTime + 1000 * REDIRECT_TIME, [startTime]);
  const [time, setTime] = React.useState(startTime);
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().valueOf();
      if (now >= endTime) {
        clearInterval(interval);
        setTime(endTime);
        window.location.assign(url);
      } else {
        setTime(now);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [url, endTime]);
  return (
    <div className="my-32 max-w-xl">
      <img
        src={"/images/logo.png"}
        className="mx-auto"
        style={{ maxHeight: "40vh", maxWidth: "40vh" }}
      />
      <h1 className="text-3xl font-bold mb-2">Success!</h1>
      <div className="mb-2">
        You will be redirected to your shared page in {app} in{" "}
        {Math.ceil(endTime - time)} seconds...
      </div>
    </div>
  );
};

export const loader = async (args: LoaderArgs) => {
  const userId = await getUserId(args);
  const { request, context } = args;
  if (!userId) {
    return redirect(`/login?redirect=${encodeURIComponent(request.url)}`);
  }
  const requestId = parseRemixContext(context).lambdaContext.awsRequestId;
  const searchParams = Object.fromEntries(new URL(request.url).searchParams);
  const messageUuid = searchParams.uuid;
  const action = searchParams.action;
  if (action !== "accept") {
    throw new BadRequestResponse(`Unsupported action: ${action}`);
  }
  const cxn = await getMysql(requestId);
  const [{ notebookUuid, metadata }] = await cxn
    .select({
      notebookUuid: messages.target,
      metadata: messages.metadata,
    })
    .from(messages)
    .where(eq(messages.uuid, messageUuid));
  const [{ token, app, appName }] = await cxn
    .select({
      token: tokens.value,
      app: apps.code,
      appName: apps.name,
    })
    .from(tokens)
    .innerJoin(
      tokenNotebookLinks,
      eq(tokens.uuid, tokenNotebookLinks.tokenUuid)
    )
    .innerJoin(notebooks, eq(accessTokens.notebookUuid, notebooks.uuid))
    .innerJoin(apps, eq(apps.id, notebooks.app))
    .where(
      and(
        eq(tokenNotebookLinks.notebookUuid, notebookUuid),
        eq(tokens.userId, userId)
      )
    );
  await cxn.end();
  if (!metadata) {
    throw new InternalServerResponse(
      `No metadata found for message ${messageUuid}`
    );
  }
  setupRegistry({
    getSetting: (s) => {
      if (s === "uuid") return notebookUuid;
      if (s === "token") return token;
      return "";
    },
  });
  const { url } = await acceptSharePageOperation({
    ensurePageByTitle: async (title) =>
      apiPost<{ notebookPageId: string; preExisting: boolean }>({
        path: `extensions/${app}/backend`,
        data: {
          type: "ENSURE_PAGE_BY_TITLE",
          title,
        },
        authorization: `Basic ${base64(`${notebookUuid}:${token}`)}`,
      }),
    initPage: async (notebookPageId) => {
      console.log("initPage", notebookPageId);
    },
    deletePage: (notebookPageId) =>
      apiPost({
        path: `extensions/${app}/backend`,
        data: {
          type: "DELETE_PAGE",
          notebookPageId,
        },
        authorization: `Basic ${base64(`${notebookUuid}:${token}`)}`,
      }),
    openPage: (notebookPageId) =>
      apiPost<{ url: string; notebookPageId: string }>({
        path: `extensions/${app}/backend`,
        data: {
          type: "OPEN_PAGE",
          notebookPageId,
        },
        authorization: `Basic ${base64(`${notebookUuid}:${token}`)}`,
      }),
    encodeState: (notebookPageId) =>
      apiPost({
        path: `extensions/${app}/backend`,
        data: {
          type: "ENCODE_STATE",
          notebookPageId,
        },
        authorization: `Basic ${base64(`${notebookUuid}:${token}`)}`,
      }),
    decodeState: (notebookPageId, state) =>
      apiPost({
        path: `extensions/${app}/backend`,
        data: {
          type: "DECODE_STATE",
          notebookPageId,
          state,
        },
        authorization: `Basic ${base64(`${notebookUuid}:${token}`)}`,
      }),
  })(metadata as JSONData);
  return { success: true, url, app: appName };
};

export default SharePageOperationPage;
