import AtJsonRendered, { References } from "package/components/AtJsonRendered";
import type { DataFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import downloadSharedPage from "~/data/downloadSharedPage.server";
import Automerge from "automerge";
import {
  InitialSchema,
  referenceAnnotation,
  Schema,
} from "package/internal/types";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import unwrapSchema from "package/utils/unwrapSchema";
import parseRemixContext from "~/data/parseRemixContext.server";
import getMysql from "~/data/mysql.server";
import { pageNotebookLinks } from "data/schema";
import { eq } from "drizzle-orm/expressions";
import { NotFoundResponse, ForbiddenResponse } from "~/data/responses.server";
import { z } from "zod";
import getTitleState from "~/data/getTitleState.server";

const PageUuidPage = () => {
  const data = useLoaderData<Awaited<ReturnType<typeof loader>>>();
  return (
    <div className="flex flex-col gap-2 h-full justify-between w-full p-16">
      <AtJsonRendered
        content={data.content}
        annotations={data.annotations}
        references={data.references}
      />
    </div>
  );
};

const getReferenceTitles = async ({
  requestId,
  state,
}: {
  requestId: string;
  state: InitialSchema;
}): Promise<References> => {
  const references: References = {};
  return state.annotations
    .filter(
      (a): a is z.infer<typeof referenceAnnotation> => a.type === "reference"
    )
    .map((annotation) => async (references: References) => {
      const { notebookUuid, notebookPageId } = annotation.attributes;
      if (!references[notebookUuid]) {
        references[notebookUuid] = {};
      }
      if (!references[notebookUuid][notebookPageId]) {
        const { uuid: link, ...titleState } = await getTitleState({
          requestId,
          notebookPageId,
          notebookUuid,
        });
        const nestedReferences = await getReferenceTitles({
          requestId,
          state: titleState,
        });
        references[notebookUuid][notebookPageId] = {
          data: titleState,
          href: link ? `/pages/${link}` : "",
        };
        Object.entries(nestedReferences).forEach(([notebookUuid, pages]) => {
          if (!references[notebookUuid]) {
            references[notebookUuid] = {};
          }
          Object.entries(pages).forEach(([notebookPageId, page]) => {
            references[notebookUuid][notebookPageId] = page;
          });
        });
      }
      return references;
    })
    .reduce((p, c) => {
      return p.then(c);
    }, Promise.resolve(references));
};

export const loader = async ({ params, context }: DataFunctionArgs) => {
  const uuid = params["uuid"];
  if (!uuid) {
    return { content: "", annotations: [], references: {} };
  }
  const requestId = parseRemixContext(context).lambdaContext.awsRequestId;
  const cxn = await getMysql(requestId);
  const [record] = await cxn
    .select({
      cid: pageNotebookLinks.cid,
      isPublic: pageNotebookLinks.isPublic,
      notebookUuid: pageNotebookLinks.notebookUuid,
      notebookPageId: pageNotebookLinks.notebookPageId,
    })
    .from(pageNotebookLinks)
    .where(eq(pageNotebookLinks.uuid, uuid));
  if (!record) {
    await cxn.end();
    throw new NotFoundResponse("Page not found");
  }
  const { cid, isPublic } = record;
  if (!isPublic) {
    await cxn.end();
    throw new ForbiddenResponse("Page is not public");
  }
  const memo = await downloadSharedPage({ cid });
  const doc = Automerge.load<Schema>(memo.body);
  const state = unwrapSchema(doc);
  const references = await getReferenceTitles({ requestId, state });
  await cxn.end();
  return { ...state, references };
};

export default PageUuidPage;
