import base from "fuegojs/dist/base";
import { z } from "zod";

// TODO FOR FUEGO: ADD FOREIGN KEY
const pageNotebookLink = z.object({
  uuid: z.string().uuid().describe("primary"),
  pageUuid: z.string().uuid().describe("foreign"),
  notebookPageId: z.string().describe("unique"),
  workspace: z.string().describe("unique"),
  app: z.number().max(Math.pow(2, 8)).describe("unique"),
});

const page = z.object({
  uuid: z.string().uuid().describe("primary"),
  version: z.number(),
});

const onlineClient = z.object({
  id: z.string().describe("primary"),
  instance: z.string().describe("unique"),
  app: z.number().max(Math.pow(2, 8)).describe("unique"),
  createdDate: z.date(),
});

const clientSession = z.object({
  id: z.string().describe("primary"),
  instance: z.string().describe("unique"),
  app: z.number().max(Math.pow(2, 8)).describe("unique"),
  createdDate: z.date(),
  endDate: z.date(),
  disconnectedBy: z.string(),
});

const message = z.object({
  uuid: z.string().uuid().describe("primary"),
  sourceInstance: z.string(),
  sourceApp: z.number().max(Math.pow(2, 8)),
  targetInstance: z.string(),
  targetApp: z.number().max(Math.pow(2, 8)),
  createdDate: z.date(),
  marked: z.boolean(),
});

const ongoingMessage = z.object({
  uuid: z.string().uuid().describe("primary"),
  chunk: z.number().describe("unique"),
  messageUuid: z.string().uuid().describe("unique"),
});

export const schema = {
  pageNotebookLink,
  onlineClient,
  clientSession,
  message,
  ongoingMessage,
  page,
};

base({
  projectName: "samepage.network",
  safeProjectName: "samepage-network",
  emailDomain: "samepage.network",
  clerkDnsId: "l7zkq208u6ys",
  schema,
  variables: ["convertkit_api_key", "password_secret_key"],
});
