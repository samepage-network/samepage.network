import React from "react";
import { SamePageSchema, SamePageState } from "../internal/types";
import AtJsonRendered from "./AtJsonRendered";
import Button from "./Button";
import LinkWithSearch from "./LinkWithSearch";
import SharedPageStatus from "./SharedPageStatus";
import useNavigateWithSearch from "./useNavigateWithSearch";
import { LoaderFunctionArgs, redirect, useLoaderData } from "react-router-dom";
import parseCredentialsFromRequest from "../internal/parseCredentialsFromRequest";
import apiClient from "../internal/apiClient";
import postToAppBackend from "../internal/postToAppBackend";
import useCredentials from "./useCredentials";

type HeadSharedPageResponse = {
  notebookPageId: string;
  title: SamePageSchema;
};

const SharedPageTab: React.FC = () => {
  const data = useLoaderData() as HeadSharedPageResponse;
  useCredentials();
  const navigate = useNavigateWithSearch();
  return (
    <div className="flex flex-col items-start h-full">
      <div className="flex-grow w-full">
        <h1 className="mb-8 text-3xl">
          <AtJsonRendered {...data.title} />
        </h1>
        <SharedPageStatus
          notebookPageId={data.notebookPageId}
          onClose={() => navigate(`../shared-pages`)}
          encodeState={
            async (notebookPageId) =>
              postToAppBackend({
                data: {
                  type: "ENCODE_STATE",
                  notebookPageId,
                },
              }) as Promise<SamePageState> // TODO - Parameterize
          }
        />
      </div>
      <LinkWithSearch to={"../shared-pages"} className="mb-4 inline-block">
        <Button type={"button"}>Back</Button>
      </LinkWithSearch>
    </div>
  );
};

export const loader = async (args: LoaderFunctionArgs) => {
  const result = parseCredentialsFromRequest(args);
  if (!result.auth) {
    return redirect("../..?warning=not-logged-in");
  }
  const linkUuid = args.params.uuid || "";
  return apiClient({
    // TODO - rename to get-shared-page, move existing get-shared-page to load-shared-page
    method: "head-shared-page",
    linkUuid,
    notebookUuid: result.notebookUuid,
    token: result.token,
  }).catch((e) => {
    if (e.status === 401) {
      return redirect("../..?warning=not-logged-in");
    }
    throw e;
  });
};

export default SharedPageTab;
