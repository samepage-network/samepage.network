import { z } from "zod";

const uuid = z.string().uuid().describe("primary");
const optionalUuid = z.string().uuid().optional();

const notebook = z.object({
  uuid,
  workspace: z.string(),
  app: z.number().max(Math.pow(2, 8)).min(0),
});

const pageNotebookLink = z.object({
  uuid,
  pageUuid: z.string().uuid(),
  notebookPageId: z.string().describe("unique"),
  workspace: z.string().describe("unique"),
  app: z.number().max(Math.pow(2, 8)).describe("unique"),
  version: z.number(),
  open: z.boolean(), // .default(true), need to update fuego to handle defaults
  invitedBy: z.string().uuid().optional(),
  invitedDate: z.date().optional(),
  notebookUuid: optionalUuid,
  cid: z.string(),
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
  notebookUuid: optionalUuid,
});

const clientSession = z.object({
  id: z.string().describe("primary"),
  instance: z.string(),
  app: z.number().max(Math.pow(2, 8)),
  createdDate: z.date(),
  endDate: z.date(),
  disconnectedBy: z.string(),
  notebookUuid: optionalUuid,
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
