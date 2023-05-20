import { z } from "zod";

export const zGetAccessTokenPayload = z.object({
  authorization: z.string(),
  userId: z.string().optional(),
});
export type GetAccessTokenPayload = z.infer<typeof zGetAccessTokenPayload>;
export const zGetAccessTokenResponse = z.object({
  accessToken: z.string(),
  workspace: z.string(),
  notebookUuid: z.string(),
  token: z.string(),
});
export type GetAccessTokenResponse = z.infer<typeof zGetAccessTokenResponse>;

export const zGetNotebookCredentialsPayload = z.object({
  email: z.string(),
  app: z.string(),
  workspace: z.string(),
});
export type GetNotebookCredentialsPayload = z.infer<
  typeof zGetNotebookCredentialsPayload
>;
export const zGetNotebookCredentialsResponse = z.object({
  uuid: z.string(),
  token: z.string(),
});
export type GetNotebookCredentialsResponse = z.infer<
  typeof zGetNotebookCredentialsResponse
>;

export const zOnboardNotebookPayload = z.object({
  email: z.string(),
  password: z.string(),
  app: z.string().or(z.number()),
  workspace: z.string(),
  label: z.string().optional(),
});
export type OnboardNotebookPayload = z.infer<typeof zOnboardNotebookPayload>;
export const zOnboardNotebookResponse = z.object({
  notebookUuid: z.string(),
  token: z.string(),
});
export type OnboardNotebookResponse = z.infer<typeof zOnboardNotebookResponse>;
