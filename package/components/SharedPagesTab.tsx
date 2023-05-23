import React from "react";
import {
  ActionFunctionArgs,
  Form,
  LoaderFunctionArgs,
  redirect,
  useLoaderData,
} from "react-router-dom";
import AtJsonRendered from "./AtJsonRendered";
import LinkWithSearch from "./LinkWithSearch";
import TextInput from "./TextInput";
import Button from "./Button";
import { ListSharedPages } from "../internal/types";
import parseCredentialsFromRequest from "../internal/parseCredentialsFromRequest";
import { InternalServerResponse, NotFoundResponse } from "../utils/responses";
import sharePageCommandCalback from "../internal/sharePageCommandCallback";
import apiClient, { apiPost } from "../internal/apiClient";
import redirectWithSearch from "../internal/redirectWithSearch";
import getAppCode from "../internal/getAppCode";
import base64 from "../internal/base64";
import { setSetting } from "../internal/registry";

const SharedPagesTab: React.FC = () => {
  const data = useLoaderData() as Awaited<ReturnType<ListSharedPages>>;
  return (
    <div>
      <h1 className="font-bold mb-4 text-xl">Shared Pages</h1>
      <div className="mb-4">
        {/* TODO: import ViewSharedPages Modal Content here */}
        {data.pages.length ? (
          <ul>
            {data.pages.map((p) => (
              <li key={p.linkUuid} className="mb-2">
                <LinkWithSearch to={p.linkUuid} className="text-sky-400">
                  <AtJsonRendered {...p.title} />
                </LinkWithSearch>
              </li>
            ))}
          </ul>
        ) : (
          <p>No shared pages yet - use the search modal below to share one!</p>
        )}
      </div>
      <div>
        <h2 className="font-semibold mb-3 text-lg">Share Page on SamePage</h2>
        <Form method="post">
          <TextInput label={"Search"} name={"title"} />
          <Button>Share</Button>
        </Form>
      </div>
    </div>
  );
};

export const loader = async (args: LoaderFunctionArgs) => {
  const result = parseCredentialsFromRequest(args);
  if (!result.auth) {
    return redirect("..?warning=not-logged-in");
  }
  return apiClient({
    method: "list-shared-pages",
    notebookUuid: result.notebookUuid,
    token: result.token,
  }).catch((e) => {
    if (e.status === 401) {
      return redirect("..?warning=not-logged-in");
    }
    throw e;
  });
};

export const action = () => async (args: ActionFunctionArgs) => {
  const result = parseCredentialsFromRequest(args);
  if (!result.auth) {
    return redirect("..?warning=not-logged-in");
  }

  const { request } = args;
  if (request.method !== "POST")
    throw new NotFoundResponse(`Unsupported method ${request.method}`);

  const data = await request.formData();
  const title = data.get("title") as string;
  const { notebookUuid, token } = result;
  setSetting("uuid", notebookUuid);
  setSetting("token", token);

  const app = await getAppCode();
  const shared = await sharePageCommandCalback({
    getNotebookPageId: async () =>
      apiPost<{ notebookPageId: string }>({
        path: `extensions/${app}/backend`,
        data: {
          type: "ENSURE_PAGE_BY_TITLE",
          title: { content: title, annotations: [] },
        },
        authorization: `Basic ${base64(`${notebookUuid}:${token}`)}`,
      }).then((r) => r.notebookPageId),
    encodeState: (notebookPageId) =>
      apiPost({
        path: `extensions/${app}/backend`,
        data: {
          type: "ENCODE_STATE",
          notebookPageId,
          notebookUuid,
        },
        authorization: `Basic ${base64(`${notebookUuid}:${token}`)}`,
      }),
  });
  if (!shared.success) throw new InternalServerResponse(shared.error);
  return redirectWithSearch(shared.linkUuid, request);
};

export default SharedPagesTab;
