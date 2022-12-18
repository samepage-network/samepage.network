import { z } from "zod";

const uuidField = z.string().uuid();
const uuid = uuidField.describe("primary");
const optionalUuid = uuidField.optional();

const token = z.object({
  uuid,
  value: z.string(),
  userId: z.string().optional(),
});

const tokenNotebookLink = z.object({
  uuid,
  notebookUuid: uuidField,
  tokenUuid: uuidField,
});

const invitation = z.object({
  code: z.string().describe("primary"),
  createdDate: z.date(),
  expirationDate: z.date(),
  tokenUuid: z.string().optional().describe("unique"),
  email: z.string().optional(),
});

const notebook = z.object({
  uuid,
  workspace: z.string(),
  app: z.number().max(Math.pow(2, 8)).min(0),
});

const pageNotebookLink = z
  .object({
    uuid,
    pageUuid: z.string().uuid(),
    notebookPageId: z.string(),
    version: z.number(), // possibly redundant with cid, though it saves a download
    open: z.boolean(), // .default(true), need to update fuego to handle defaults
    invitedBy: z.string().uuid(),
    invitedDate: z.date(),
    notebookUuid: uuidField,
    cid: z.string(),
  })
  .describe(
    JSON.stringify({ uniques: [["notebook_page_id", "notebook_uuid"]] })
  );

const page = z.object({
  uuid,
  createdDate: z.date(),
});

const onlineClient = z.object({
  id: z.string().describe("primary"),
  createdDate: z.date(),
  notebookUuid: optionalUuid,
});

const clientSession = z.object({
  id: z.string().describe("primary"),
  createdDate: z.date(),
  endDate: z.date(),
  disconnectedBy: z.string(),
  notebookUuid: optionalUuid,
});

const message = z.object({
  uuid,
  createdDate: z.date(),
  marked: z.boolean(),
  source: optionalUuid,
  target: optionalUuid,
  operation: z.string(),
  metadata: z.object({}).optional(),
});

const ongoingMessage = z
  .object({
    uuid,
    chunk: z.number(),
    messageUuid: z.string().uuid(),
  })
  .describe(
    JSON.stringify({ uniques: [["chunk", "message_uuid"]] })
  );

const quota = z.object({
  uuid,
  value: z.number(),
  field: z.number().max(Math.pow(2, 8)).min(0),
  stripeId: z.string().optional(),
});

const schema = {
  token,
  tokenNotebookLink,
  invitation,
  notebook,
  page,
  pageNotebookLink,
  onlineClient,
  clientSession,
  message,
  ongoingMessage,
  quota,
};

export default schema;
