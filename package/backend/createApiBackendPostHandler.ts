import {
  BackendRequest,
  CommandLibrary,
  DecodeState,
  DeletePage,
  EncodeState,
  EnsurePageByTitle,
  OpenPage,
  zCommandArgs,
  zSamePageSchema,
  zSamePageState,
  zWorkflowContext,
} from "../internal/types";
import createAPIGatewayProxyHandler from "./createAPIGatewayProxyHandler";
import { z } from "zod";
import debug from "../utils/debugger";
import getAccessToken from "./getAccessToken";
import setupCrossNotebookWorkflows from "package/protocols/crossNotebookWorkflows";

// TODO - do we want to align this with Credentials in ./createApiMessageHandler.ts?
type Credentials = {
  accessToken: string;
  workspace: string;
};

const log = debug("api:backend");

const zMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SETUP") }),
  z.object({
    type: z.literal("OPEN_PAGE"),
    notebookPageId: z.string(),
  }),
  z.object({
    type: z.literal("ENSURE_PAGE_BY_TITLE"),
    title: zSamePageSchema,
    path: z.string().optional(),
  }),
  z.object({
    type: z.literal("DELETE_PAGE"),
    notebookPageId: z.string(),
  }),
  z.object({
    type: z.literal("ENCODE_STATE"),
    notebookPageId: z.string(),
    notebookUuid: z.string(),
  }),
  z.object({
    type: z.literal("DECODE_STATE"),
    notebookPageId: z.string(),
    state: zSamePageState,
  }),
  z.object({
    type: z.literal("COMMAND_HANDLER"),
    notebookUuid: z.string(),
    args: zCommandArgs,
    text: z.string(),
    workflowContext: zWorkflowContext,
  }),
  z.object({
    type: z.literal("TRIGGER_WORKFLOW"),
    notebookUuid: z.string(),
    source: z.string(),
    target: z.string(),
  }),
]);

const createApiBackendPostHandler = ({
  getDecodeState,
  getEncodeState,
  getEnsurePageByTitle,
  getCommandLibrary,
  getDeletePage,
  getOpenPage,
}: {
  getEnsurePageByTitle: (credentials: Credentials) => EnsurePageByTitle;
  getEncodeState: (credentials: Credentials) => EncodeState;
  getDecodeState: (credentials: Credentials) => DecodeState;
  getCommandLibrary: (credentials: Credentials) => CommandLibrary;
  getDeletePage: (credentials: Credentials) => DeletePage;
  getOpenPage: (credentials: Credentials) => OpenPage;
}) => {
  const logic = async (args: BackendRequest<typeof zMessage>) => {
    const { authorization, ...data } = args;
    if (!authorization) {
      throw new Error("Unauthorized");
    }
    log("backend post", data.type);

    const accessToken = authorization.startsWith("Basic")
      ? await getAccessToken({
          authorization,
        }).then(({ accessToken }) => accessToken)
      : // TODO - how to get workspace??
        authorization.replace(/^Bearer /, "");
    try {
      switch (data.type) {
        case "SETUP": {
          // TODO: Do we need this anymore?
          return { success: true };
        }
        case "ENSURE_PAGE_BY_TITLE": {
          const { path = "", title } = data;
          return getEnsurePageByTitle({ accessToken, workspace: "" })(
            title,
            path
          );
        }
        case "DELETE_PAGE": {
          const { notebookPageId } = data;
          await getDeletePage({ accessToken, workspace: "" })(notebookPageId);
          return { success: true };
        }
        case "OPEN_PAGE": {
          const { notebookPageId } = data;
          return getOpenPage({ accessToken, workspace: "" })(notebookPageId);
        }
        case "ENCODE_STATE": {
          const { notebookPageId } = data;
          return getEncodeState({ accessToken, workspace: "" })(notebookPageId);
        }
        case "DECODE_STATE": {
          const { notebookPageId, state } = data;
          await getDecodeState({ accessToken, workspace: "" })(
            notebookPageId,
            state
          );
          return { success: true };
        }
        case "COMMAND_HANDLER": {
          const { notebookUuid: _, args, text, workflowContext } = data;
          const commands = getCommandLibrary({ accessToken, workspace: "" });
          const response = await commands[text].handler(args, workflowContext);
          return { response };
        }
        case "TRIGGER_WORKFLOW": {
          const { notebookUuid: _, source, target } = data;
          const { triggerWorkflow } = setupCrossNotebookWorkflows({
            decodeState: getDecodeState({ accessToken, workspace: "" }),
            encodeState: getEncodeState({ accessToken, workspace: "" }),
            appCommands: getCommandLibrary({ accessToken, workspace: "" }),
          });
          await triggerWorkflow({ source, target });
          return { success: true };
        }
        default:
          throw new Error(`Unknown type ${data["type"]}`);
      }
    } catch (e) {
      log("error", e);
      throw new Error(`Backend request ${data.type} failed`, {
        cause: e as Error,
      });
    }
  };
  return createAPIGatewayProxyHandler({
    logic,
    bodySchema: zMessage,
    // TODO - use app's originRegex
    allowedOrigins: [/.*/],
  });
};

export default createApiBackendPostHandler;
