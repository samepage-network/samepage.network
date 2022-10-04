import { z } from "zod";

const uuid = z.string().uuid().describe("primary");
const optionalUuid = z.string().uuid().optional();
const notebookUuid = optionalUuid.describe("foreign");

const notebook = z.object({
  uuid,
  workspace: z.string(),
  app: z.number().max(Math.pow(2, 8)).min(0),
});

const pageNotebookLink = z.object({
  uuid,
  pageUuid: z.string().uuid().describe("foreign"),
  notebookPageId: z.string().describe("unique"),
  workspace: z.string().describe("unique"),
  app: z.number().max(Math.pow(2, 8)).describe("unique"),
  version: z.number(),
  open: z.boolean(), // .default(true), need to update fuego to handle defaults
  invitedBy: z.string().uuid().optional(),
  invitedDate: z.date().optional(),
  notebookUuid: z.string().uuid().optional().describe("foreign"),
});

const page = z.object({
  uuid,
  version: z.number(),
});

const onlineClient = z.object({
  id: z.string().describe("primary"),
  instance: z.string(),
  app: z.number().max(Math.pow(2, 8)),
  createdDate: z.date(),
  notebookUuid,
});

const clientSession = z.object({
  id: z.string().describe("primary"),
  instance: z.string(),
  app: z.number().max(Math.pow(2, 8)),
  createdDate: z.date(),
  endDate: z.date(),
  disconnectedBy: z.string(),
  notebookUuid,
});

const message = z.object({
  uuid,
  sourceInstance: z.string(),
  sourceApp: z.number().max(Math.pow(2, 8)),
  targetInstance: z.string(),
  targetApp: z.number().max(Math.pow(2, 8)),
  createdDate: z.date(),
  marked: z.boolean(),
  source: optionalUuid,
  target: optionalUuid,
});

const ongoingMessage = z.object({
  uuid,
  chunk: z.number().describe("unique"),
  messageUuid: z.string().uuid().describe("unique"),
});

const schema = {
  notebook,
  page,
  pageNotebookLink,
  onlineClient,
  clientSession,
  message,
  ongoingMessage,
};

export default schema;
