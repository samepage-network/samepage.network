import React from "react";
import type { DataFunctionArgs } from "@remix-run/node";
import getUserId from "~/data/getUserId.server";
import { useLoaderData } from "@remix-run/react";
import { appsByCode } from "package/internal/apps";
import axios from "axios";
export { default as CatchBoundary } from "~/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const OauthConnectionPage = (): React.ReactElement => {
  const data = useLoaderData<Awaited<ReturnType<typeof loader>>>();
  return "error" in data ? (
    <div className="text-red-800">{data.error}</div>
  ) : data.success ? (
    <div>Success! you can close this window now.</div>
  ) : (
    <div>
      <div>Something went wrong. Please try again.</div>
      <div>
        Error: <code>{JSON.stringify(data.data)}</code>
      </div>
    </div>
  );
};

export const loader = async ({ request, params }: DataFunctionArgs) => {
  const userId = await getUserId(request);
  const searchParams = Object.fromEntries(new URL(request.url).searchParams);
  const { code, state, error } = searchParams;
  const { id = "" } = params;
  const appName = appsByCode[id]?.name;
  if (!appName) {
    return { error: `App ${id} is not currently supported on SamePage` };
  }
  if (error) {
    return { error: `Failed to install SamePage to ${appName}: ${error}` };
  }
  const response = await axios
    .post(`${process.env.API_URL}/extensions/${id}/oauth`, {
      code,
      state,
      userId,
    })
    .then((r) => ({ data: r.data, success: true }))
    .catch((e) => ({ data: e.response.data, success: false }));
  return response;
};

export default OauthConnectionPage;
