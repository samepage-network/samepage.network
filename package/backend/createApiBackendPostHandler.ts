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
import { GetAccessTokenResponse } from "./types";

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
  }),
  z.object({
    type: z.literal("DECODE_STATE"),
    notebookPageId: z.string(),
    state: zSamePageState,
  }),
  z.object({
    type: z.literal("COMMAND_HANDLER"),
    args: zCommandArgs,
    text: z.string(),
    workflowContext: zWorkflowContext,
  }),
  z.object({
    type: z.literal("TRIGGER_WORKFLOW"),
    source: z.string(),
    target: z.string(),
  }),
]);

const createApiBackendPostHandler = ({
  getDecodeState = () => async () => ({}),
  getEncodeState = () => async (notebookPageId) => ({
    $title: { content: notebookPageId, annotations: [] },
    $body: { content: "", annotations: [] },
  }),
  getEnsurePageByTitle = () => async (title) => ({
    notebookPageId: title.content,
    preExisting: false,
  }),
  getCommandLibrary = () => ({}),
  getDeletePage = () => async () => {},
  getOpenPage = () => async (notebookPageId) => ({
    notebookPageId,
    url: notebookPageId,
  }),
}: {
  getEnsurePageByTitle?: (
    credentials: GetAccessTokenResponse
  ) => EnsurePageByTitle;
  getEncodeState?: (credentials: GetAccessTokenResponse) => EncodeState;
  getDecodeState?: (credentials: GetAccessTokenResponse) => DecodeState;
  getCommandLibrary?: (credentials: GetAccessTokenResponse) => CommandLibrary;
  getDeletePage?: (credentials: GetAccessTokenResponse) => DeletePage;
  getOpenPage?: (credentials: GetAccessTokenResponse) => OpenPage;
}) => {
  const logic = async (args: BackendRequest<typeof zMessage>) => {
    const { authorization, ...data } = args;
    if (!authorization) {
      throw new Error("Unauthorized");
    }
    log("backend post", data.type);

    const credentials = await getAccessToken({
      authorization,
    });
    try {
      switch (data.type) {
        case "SETUP": {
          // TODO: Do we need this anymore?
          return { success: true };
        }
        case "ENSURE_PAGE_BY_TITLE": {
          const { path = "", title } = data;
          return getEnsurePageByTitle(credentials)(title, path);
        }
        case "DELETE_PAGE": {
          const { notebookPageId } = data;
          await getDeletePage(credentials)(notebookPageId);
          return { success: true };
        }
        case "OPEN_PAGE": {
          const { notebookPageId } = data;
          return getOpenPage(credentials)(notebookPageId);
        }
        case "ENCODE_STATE": {
          const { notebookPageId } = data;
          return getEncodeState(credentials)(notebookPageId);
        }
        case "DECODE_STATE": {
          const { notebookPageId, state } = data;
          await getDecodeState(credentials)(notebookPageId, state);
          return { success: true };
        }
        case "COMMAND_HANDLER": {
          const { args, text, workflowContext } = data;
          const commands = getCommandLibrary(credentials);
          const response = await commands[text].handler(args, workflowContext);
          return { response };
        }
        case "TRIGGER_WORKFLOW": {
          const { source, target } = data;
          const { triggerWorkflow } = setupCrossNotebookWorkflows({
            decodeState: getDecodeState(credentials),
            encodeState: getEncodeState(credentials),
            appCommands: getCommandLibrary(credentials),
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
