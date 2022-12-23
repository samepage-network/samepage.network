import createAPIGatewayProxyHandler from "@dvargas92495/app/backend/createAPIGatewayProxyHandler.server";
import sendEmail from "@dvargas92495/app/backend/sendEmail.server";
import { appsById } from "package/internal/apps";
import { z } from "zod";
import getMysql from "fuegojs/utils/mysql";
import { Notebook } from "package/internal/types";
import AtJsonParserErrorEmail from "~/components/AtJsonParserErrorEmail";
import ExtensionErrorEmail from "~/components/ExtensionErrorEmail";
import { v4 } from "uuid";
import uploadFile from "@dvargas92495/app/backend/uploadFile.server";
import EmailLayout from "~/components/EmailLayout";
import parseZodError from "package/utils/parseZodError";

const zBody = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("at-json-parser"),
    results: z.unknown().array(),
    input: z.string(),
    app: z.number(),
    version: z.string().optional(),
  }),
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
  }),
  z.object({
    method: z.literal("notification-action"),
    label: z.string(),
    stack: z.string(),
    app: z.number().optional(),
    version: z.string().optional(),
  }),
]);

export type RequestBody = z.infer<typeof zBody>;

const logic = async (body: Record<string, unknown>) => {
  if (process.env.NODE_ENV === "development") {
    console.error(body);
    return { success: true };
  }
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
    });
    return { success: false, messageId };
  }
  const args = result.data;
  switch (args.method) {
    case "at-json-parser": {
      const { app, input, results, version = "stale" } = args;
      const uuid = v4();
      await uploadFile({
        Key: `data/errors/${uuid}.json`,
        Body: JSON.stringify({
          input,
          results,
        }),
      });
      await sendEmail({
        to: "support@samepage.network",
        subject: `New AtJsonParser error in app ${
          appsById[app]?.name || "Unknown"
        }, Version: ${version}`,
        body: AtJsonParserErrorEmail({ uuid }),
      });
      return { success: true };
    }
    case "extension-error": {
      const { notebookUuid, data, message, stack, version, type } = args;
      const cxn = await getMysql();
      const [notebook] = await cxn
        .execute(
          `SELECT n.app, n.workspace FROM notebooks n WHERE n.uuid = ?`,
          [notebookUuid]
        )
        .then(([n]) => n as Notebook[]);
      await sendEmail({
        to: "support@samepage.network",
        subject: `SamePage message handler failed: ${message}`,
        body: ExtensionErrorEmail({
          ...notebook,
          data,
          stack,
          version,
          type,
        }),
      });
      return { success: true };
    }
    case "web-app-error": {
      const { path, stack } = args;
      await sendEmail({
        to: "support@samepage.network",
        subject: `SamePage webapp path failed: /${path}`,
        body: stack,
      });
      return { success: true };
    }
    case "notification-action": {
      const { label, stack, app = 0, version = "stale" } = args;
      await sendEmail({
        to: "support@samepage.network",
        subject: `SamePage notification failed. Action: ${label}, App: ${appsById[app].name}, Version: ${version}`,
        body: stack,
      });
      return { success: true };
    }
    default:
      return { success: false };
  }
};

export const handler = createAPIGatewayProxyHandler({
  logic,
  allowedOrigins: [
    "https://roamresearch.com",
    "https://logseq.com",
    "app://obsidian.md",
  ],
});
