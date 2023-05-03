import { z } from "zod";

const zSupportedNotebook = z.object({
  app: z.literal("Notion"),
  workspace: z.string(),
});
export const zSetup = zSupportedNotebook.or(z.literal(false)).or(z.undefined());

export type SupportedNotebook = z.infer<typeof zSupportedNotebook>;
export type AppData = z.infer<typeof zSetup>;
