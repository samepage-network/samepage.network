import { z } from "zod";

const uuidField = z.string().uuid();
const uuid = uuidField.describe("primary");
const optionalUuid = uuidField.optional();
const uuidIndex = uuidField.describe("index");

const token = z.object({
  uuid,
  value: z.string(),
  userId: z.string(),
  createdDate: z.date(),
});

const tokenNotebookLink = z
  .object({
    uuid,
    notebookUuid: uuidIndex,
    tokenUuid: uuidIndex,
  })
  .describe(JSON.stringify({ uniques: [["notebook_uuid", "token_uuid"]] }));

const notebook = z.object({
  uuid,
  workspace: z.string(),
  app: z.number().max(Math.pow(2, 8)).min(0),
});

const pageNotebookLink = z
  .object({
    uuid,
    pageUuid: z.string().uuid().describe("index"),
    notebookPageId: z.string(),
    // possibly redundant with cid, though it saves a download
    version: z.number(),
    // .default(true), need to update schema diff to handle defaults
    open: z.boolean(),
    invitedBy: z.string().uuid().describe("index"),
    invitedDate: z.date(),
    notebookUuid: uuidIndex,
    cid: z.string(),
  })
  .describe(
    JSON.stringify({
      uniques: [
        ["notebook_page_id", "notebook_uuid"],
        ["page_uuid", "notebook_uuid"],
      ],
    })
  );

const page = z.object({
  uuid,
  createdDate: z.date(),
});

const onlineClient = z.object({
  id: z.string().describe("primary"),
  createdDate: z.date(),
  notebookUuid: optionalUuid.describe("index"),
});

const clientSession = z.object({
  id: z.string().describe("primary"),
  createdDate: z.date(),
  endDate: z.date(),
  disconnectedBy: z.string(),
  notebookUuid: optionalUuid.describe("index"),
});

const message = z
  .object({
    uuid,
    createdDate: z.date(),
    marked: z.boolean(),
    source: uuidIndex,
    target: uuidIndex,
    operation: z.string(),
    metadata: z.object({}).optional(),
  })
  .describe(JSON.stringify({ indices: [["target", "marked"]] }));

const ongoingMessage = z
  .object({
    uuid,
    chunk: z.number(),
    messageUuid: z.string().uuid(),
  })
  .describe(JSON.stringify({ uniques: [["chunk", "message_uuid"]] }));

const quota = z.object({
  uuid,
  value: z.number(),
  field: z.number().max(Math.pow(2, 8)).min(0),
  stripeId: z.string().optional(),
});

const interview = z.object({
  uuid,
  completed: z.boolean().describe("index"),
  link: z.string(),
  date: z.date(),
  email: z.string().describe("index"),
});

const schema = {
  token,
  tokenNotebookLink,
  notebook,
  page,
  pageNotebookLink,
  onlineClient,
  clientSession,
  message,
  ongoingMessage,
  quota,
  interview,
};

export default schema;
