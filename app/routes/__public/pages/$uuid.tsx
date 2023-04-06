import AtJsonRendered from "package/components/AtJsonRendered";
import type { DataFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import downloadSharedPage from "~/data/downloadSharedPage.server";
import Automerge from "automerge";
import { Schema } from "package/internal/types";
export { default as CatchBoundary } from "~/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import unwrapSchema from "package/utils/unwrapSchema";
import parseRemixContext from "~/data/parseRemixContext.server";
import getMysql from "~/data/mysql.server";
import { pageNotebookLinks } from "data/schema";
import { eq } from "drizzle-orm/expressions";
import { NotFoundResponse, ForbiddenResponse } from "~/data/responses.server";

const PageUuidPage = () => {
  const data = useLoaderData<Awaited<ReturnType<typeof loader>>>();
  return (
    <div className="flex flex-col gap-2 h-full justify-between">
      <div className="flex-grow border border-opacity-50 border-gray-300 flex justify-between gap-1">
        <div>
          <AtJsonRendered
            content={data.content}
            annotations={data.annotations}
          />
        </div>
      </div>
    </div>
  );
};

export const loader = async ({ params, context }: DataFunctionArgs) => {
  const uuid = params["uuid"];
  if (!uuid) {
    return { content: "", annotations: [] };
  }
  const requestId = parseRemixContext(context).lambdaContext.awsRequestId;
  const cxn = await getMysql(requestId);
  const [record] = await cxn
    .select({
      cid: pageNotebookLinks.cid,
      isPublic: pageNotebookLinks.isPublic,
    })
    .from(pageNotebookLinks)
    .where(eq(pageNotebookLinks.uuid, uuid));
  await cxn.end();
  if (!record) {
    throw new NotFoundResponse("Page not found");
  }
  const { cid, isPublic } = record;
  if (!isPublic) {
    throw new ForbiddenResponse("Page is not public");
  }
  const memo = await downloadSharedPage({ cid });
  const doc = Automerge.load<Schema>(memo.body);
  return unwrapSchema(doc);
};

export default PageUuidPage;
