import React from "react";
import {
  ActionFunction,
  Form,
  LoaderFunctionArgs,
  useLoaderData,
  redirect,
} from "react-router-dom";
import Select from "./Select";
import AtJsonRendered from "./AtJsonRendered";
import Button from "./Button";
import { SamePageSchema } from "../internal/types";
import parseCredentialsFromRequest from "../internal/parseCredentialsFromRequest";
import apiClient, { apiPost } from "../internal/apiClient";
import unwrapSchema from "../utils/unwrapSchema";
import Automerge from "automerge";
import getAppCode from "../internal/getAppCode";
<<<<<<< HEAD
import base64 from "../internal/base64";
import base64ToBinary from "../internal/base64ToBinary";
=======
import base64 from "package/internal/base64";
import base64ToBinary from "package/internal/base64ToBinary";
>>>>>>> fbcdee9 (Unit tests should now pass)
import { setSetting } from "package/internal/registry";

const WorkflowTab: React.FC = () => {
  const data = useLoaderData() as {
    title: SamePageSchema;
    destinations: {
      notebookUuid: string;
      appName: string;
      workspaceName: string;
    }[];
  };
  return (
    <Form method={"post"}>
      <h1 className="text-3xl font-bold mb-8">
        <AtJsonRendered {...data.title} />{" "}
        <img
          src={"https://samepage.network/images/logo.png"}
          className={"inline h-12 w-12"}
        />
      </h1>
      <Select
        label="Destination"
        options={data.destinations.map((d) => ({
          id: d.notebookUuid,
          label: `${d.appName} ${d.workspaceName}`,
        }))}
      />
      <Button>Trigger</Button>
    </Form>
  );
};

export const loader = async (args: LoaderFunctionArgs) => {
  const result = parseCredentialsFromRequest(args);
  if (!result.auth) {
    return redirect("../..?warning=not-logged-in");
  }
  const { notebookUuid, token } = result;
  const uuid = args.params.uuid || "";
  return apiClient({
    method: "get-workflow",
    notebookUuid,
    token,
    workflowUuid: uuid,
  }).catch((e) => {
    if (e.status === 401) {
      return redirect("../..?warning=not-logged-in");
    }
    throw e;
  });
};

// TODO - FIX THIS IS BROKE
export const action: ActionFunction = async (args) => {
  const result = parseCredentialsFromRequest(args);
  if (!result.auth) {
    return redirect("../..?warning=not-logged-in");
  }
  const { notebookUuid, token } = result;
  setSetting("uuid", notebookUuid);
  setSetting("token", token);

  const workflowUuid = args.params.uuid || "";
  const page = await apiClient({
    method: "head-shared-page",
    notebookUuid,
    token,
    linkUuid: workflowUuid,
  });
  const { notebookPageId } = page;
  const app = await getAppCode();
  const { body } = await apiClient({
    method: "get-shared-page",
    notebookUuid,
    token,
    notebookPageId: page.notebookPageId as string,
  });
  const { notebookPageId: newNotebookPageId } = await apiPost({
    path: `extensions/${app}/backend`,
    data: {
      type: "ENSURE_PAGE_BY_TITLE",
      title: notebookPageId,
    },
    authorization: `Basic ${base64(`${notebookUuid}:${token}`)}`,
  });
  const state = unwrapSchema(
    Automerge.load(base64ToBinary(body as string) as Automerge.BinaryDocument)
  );
  await apiPost({
    path: `extensions/${app}/backend`,
    data: {
      type: "DECODE_STATE",
      notebookPageId: newNotebookPageId,
      state,
    },
    authorization: `Basic ${base64(`${notebookUuid}:${token}`)}`,
  });
  return { success: true };
};

export default WorkflowTab;
