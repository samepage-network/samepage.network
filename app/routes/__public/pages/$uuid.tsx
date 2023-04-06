import AtJsonRendered from "package/components/AtJsonRendered";
import type { DataFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import downloadSharedPage from "~/data/downloadSharedPage.server";
import Automerge from "automerge";
import { referenceAnnotation, Schema } from "package/internal/types";
export { default as CatchBoundary } from "~/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import unwrapSchema from "package/utils/unwrapSchema";
import parseRemixContext from "~/data/parseRemixContext.server";
import getMysql from "~/data/mysql.server";
import { pageNotebookLinks } from "data/schema";
import { and, eq } from "drizzle-orm/expressions";
import { NotFoundResponse, ForbiddenResponse } from "~/data/responses.server";
import { MySql2Database } from "drizzle-orm/mysql2";
import { z } from "zod";

const PageUuidPage = () => {
  const data = useLoaderData<Awaited<ReturnType<typeof loader>>>();
  return (
    <div className="flex flex-col gap-2 h-full justify-between w-full p-16">
      <AtJsonRendered content={data.content} annotations={data.annotations} />
    </div>
  );
};

const getPageState = async ({
  cxn,
  uuid,
}: {
  cxn: MySql2Database;
  uuid: string;
}) => {
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
    throw new NotFoundResponse("Page not found");
  }
  const { cid, isPublic, notebookUuid, notebookPageId } = record;
  if (!isPublic) {
    throw new ForbiddenResponse("Page is not public");
  }
  const memo = await downloadSharedPage({ cid });
  const doc = Automerge.load<Schema>(memo.body);
  const state = unwrapSchema(doc);
  const references = {
    [notebookUuid]: {
      [notebookPageId]: state,
    },
  };
  await Promise.all(
    state.annotations
      .filter(
        (a): a is z.infer<typeof referenceAnnotation> => a.type === "reference"
      )
      .map(async (annotation) => {
        const { notebookUuid, notebookPageId } = annotation.attributes;
        if (!references[notebookUuid]) {
          references[notebookUuid] = {};
        }
        if (!references[notebookUuid][notebookPageId]) {
          const [link] = await cxn
            .select({
              linkUuid: pageNotebookLinks.uuid,
            })
            .from(pageNotebookLinks)
            .where(
              and(
                eq(pageNotebookLinks.notebookUuid, notebookUuid),
                eq(pageNotebookLinks.notebookPageId, notebookPageId)
              )
            );
          if (link) {
            const outcome = await getPageState({
              cxn,
              uuid: link.linkUuid,
            }).catch(() => undefined);
            if (outcome) {
              references[notebookUuid][notebookPageId] = {
                content: outcome.content,
                annotations: outcome.annotations,
              };
              Object.entries(outcome.references).forEach(
                ([notebookUuid, pages]) => {
                  if (!references[notebookUuid]) {
                    references[notebookUuid] = {};
                  }
                  Object.entries(pages).forEach(([notebookPageId, page]) => {
                    references[notebookUuid][notebookPageId] = page;
                  });
                }
              );
            }
          }
        }
      })
  );
  return { ...state, references };
};

export const loader = async ({ params, context }: DataFunctionArgs) => {
  const uuid = params["uuid"];
  if (!uuid) {
    return { content: "", annotations: [] };
  }
  const requestId = parseRemixContext(context).lambdaContext.awsRequestId;
  const cxn = await getMysql(requestId);
  const outcome = await getPageState({ cxn, uuid }).catch(async (e) => {
    await cxn.end();
    throw e;
  });
  await cxn.end();
  return outcome;
};

export default PageUuidPage;
