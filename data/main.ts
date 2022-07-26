import { z } from "zod";

const pageInstanceLinks = z.object({
  uuid: z.string().uuid().describe("primary"),
  pageUuid: z.string().uuid(),
  clientPageId: z.string().describe("unique"),
  instance: z.string().describe("unique"),
  client: z.number().max(Math.pow(2, 8)).describe("unique"),
});

const schema = { pageInstanceLinks };

console.log(schema);
