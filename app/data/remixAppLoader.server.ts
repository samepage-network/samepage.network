import { AppData, LoaderArgs, redirect } from "@remix-run/node";
import type { Params } from "react-router";
import handleAsResponse from "./handleAsResponse.server";
import getUserId from "./getUserId.server";
import parseRemixContext from "~/data/parseRemixContext.server";

export type RemixAppLoaderCallback<T = AppData> = (args: {
  userId: string;
  params: Params<string>;
  searchParams: Record<string, string>;
  requestId: string;

  // Deprecated, use root requestId instead
  context: { requestId: string };
}) => Promise<T> | T;

const remixAppLoader = (
  args: LoaderArgs,
  callback?: RemixAppLoaderCallback
) => {
  const { request, params, context: remixContext } = args;
  return getUserId(args).then((userId) => {
    if (!userId) {
      return redirect(`/login?redirect=${encodeURIComponent(request.url)}`);
    }
    const searchParams = Object.fromEntries(new URL(request.url).searchParams);
    const requestId =
      parseRemixContext(remixContext).lambdaContext.awsRequestId;
    const context = {
      requestId,
    };
    const response = callback
      ? callback({ userId, params, searchParams, context, requestId })
      : {};
    return handleAsResponse(response, "Unknown Application Loader Error");
  });
};

export default remixAppLoader;
