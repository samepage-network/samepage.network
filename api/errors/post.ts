import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";
import sendEmail from "package/backend/sendEmail.server";
import { z } from "zod";
import getMysql from "~/data/mysql.server";
import { eq } from "drizzle-orm/expressions";
import ExtensionErrorEmail from "~/components/ExtensionErrorEmail";
import { v4, validate } from "uuid";
import uploadFile from "~/data/uploadFile.server";
import EmailLayout from "package/components/EmailLayout";
import parseZodError from "package/utils/parseZodError";
import axios from "axios";
import { apps, notebooks } from "data/schema";
import WebAppErrorEmail from "~/components/WebAppErrorEmail";

const zBody = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("extension-error"),
    type: z.string().optional().default("Unknown error extension error type"),
    notebookUuid: z.string().optional().default("Unknown notebook"),
    message: z.string().optional().default("Unknown error"),
    data: z.record(z.unknown()).optional().default({}),
    stack: z.string().optional().default(""),
    version: z.string().optional().default("stale"),
  }),
  z.object({
    method: z.literal("web-app-error"),
    path: z.string(),
    stack: z.string(),
    data: z.record(z.unknown()).optional().default({}),
  }),
]);

export type RequestBody = z.infer<typeof zBody>;

const parseNotebookUuid = (s: string) => {
  try {
    return z
      .object({ workspace: z.string(), app: z.string(), owner: z.string() })
      .parse(JSON.parse(s));
  } catch {
    return { workspace: s, app: "samepage", owner: "" };
  }
};

const logic = async (body: Record<string, unknown>) => {
  const result = zBody.safeParse(body);
  if (!result.success) {
    const messageId = await sendEmail({
      to: "support@samepage.network",
      subject: `Failed to parse error request body`,
      body: EmailLayout({
        children: `Failed to parse request. Errors:\n${parseZodError(
          result.error
        )}\nInput:${JSON.stringify(body, null, 4)}`,
      }),
      // Can remove this when we migrate sendEmail from `vargas` to `samepage`
      from: "support@samepage.network",
    });
    return { success: false, messageId };
  }
  const args = result.data;
  switch (args.method) {
    case "extension-error": {
      const { notebookUuid, data, stack, version, type } = args;
      const cxn = await getMysql();
      const notebook = validate(notebookUuid)
        ? await cxn
            .select({ app: apps.code, workspace: notebooks.workspace })
            .from(notebooks)
            .innerJoin(apps, eq(apps.id, notebooks.app))
            .where(eq(notebooks.uuid, notebookUuid))
            .then((r) => ({ ...r[0], owner: "samepage-network" }))
        : parseNotebookUuid(notebookUuid);
      await cxn.end();
      const repo =
        notebook.owner === "samepage-network"
          ? `samepage-network/${notebook.app}-samepage`
          : `${notebook.owner}/${notebook.app}`;
      const { latest, file = "main.js" } = !notebook.owner
        ? { latest: "*" }
        : await axios
            .get<{
              tag_name: string;
              assets: { name: string }[];
            }>(`https://api.github.com/repos/${repo}/releases/latest`)
            .then((r) => ({
              latest: r.data.tag_name,
              file: r.data.assets.find((a) => /\.js$/.test(a.name))?.name,
            }))
            .catch((e) => ({
              latest: `failed: ${JSON.stringify(
                e.response?.data || "unknown error"
              )}`,
              file: undefined,
            }));
      const uuid = v4();
      await uploadFile({
        Key: `data/errors/${uuid}.json`,
        Body: JSON.stringify(data),
      });
      if (
        type === "local-response-error" &&
        typeof data["headers"] === "string" &&
        data["headers"].includes("https://chat.openai.com")
      ) {
        // Ignore errors coming from `local` for now
        return { success: true, messageId: uuid };
      }
      const messageId = await sendEmail({
        to: "support@samepage.network",
        subject: `SamePage Extension Error: ${type}`,
        body: ExtensionErrorEmail({
          ...notebook,
          data: uuid,
          stack,
          version,
          type,
          latest,
          file,
          repo,
        }),
      });
      return { success: true, messageId };
    }
    case "web-app-error": {
      const { path, stack, data } = args;
      const messageId = await sendEmail({
        to: "support@samepage.network",
        subject: `SamePage webapp path failed: ${path}`,
        body: WebAppErrorEmail({ stack, path, data }),
      });
      return { success: true, messageId };
    }
    default:
      return { success: false };
  }
};

export const handler = createAPIGatewayProxyHandler({
  logic,
  allowedOrigins: [/.+/],
});
