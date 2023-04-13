import { LoaderArgs, LoaderFunction, redirect } from "@remix-run/node";
import type { Params } from "react-router";
import handleAsResponse from "./handleAsResponse.server";
import getUserId from "./getUserId.server";
import parseRemixContext from "~/data/parseRemixContext.server";

export type RemixAppLoaderCallback = (args: {
  userId: string;
  params: Params<string>;
  searchParams: Record<string, string>;
  context: { requestId: string };
}) => ReturnType<LoaderFunction>;

const remixAppLoader = (
  args: LoaderArgs,
  callback?: RemixAppLoaderCallback
) => {
  const { request, params, context: remixContext } = args;
  return getUserId(args).then((userId) => {
    if (!userId) {
      return redirect("/login");
    }
    const searchParams = Object.fromEntries(new URL(request.url).searchParams);
    const context = {
      requestId: parseRemixContext(remixContext).lambdaContext.awsRequestId,
    };
    const response = callback
      ? callback({ userId, params, searchParams, context })
      : {};
    return handleAsResponse(response, "Unknown Application Loader Error");
  });
};

export default remixAppLoader;
