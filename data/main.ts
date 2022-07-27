import { z } from "zod";

const pageInstanceLink = z.object({
  uuid: z.string().uuid().describe("primary"),
  pageUuid: z.string().uuid(),
  notebookPageId: z.string().describe("unique"),
  instance: z.string().describe("unique"),
  app: z.number().max(Math.pow(2, 8)).describe("unique"),
});

const network = z.object({
  uuid: z.string().uuid().describe("primary"),
  name: z.string().describe("unique"),
  password: z.string(),
  salt: z.string(),
  created_date: z.date(),
});

const networkMembership = z.object({
  uuid: z.string().uuid().describe("primary"),
  networkUuid: z.string().uuid().describe("unique"),
  instance: z.string().describe("unique"),
  app: z.number().max(Math.pow(2, 8)).describe("unique"),
});

export const onlineClient = z.object({
  id: z.string().describe("primary"),
  instance: z.string().describe("unique"),
  app: z.number().max(Math.pow(2, 8)).describe("unique"),
  created_date: z.date(),
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
});

const schema = {
  pageInstanceLink,
  network,
  networkMembership,
  onlineClient,
  clientSession,
  message,
};

console.log(schema);
