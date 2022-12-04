import createAPIGatewayProxyHandler from "@dvargas92495/app/backend/createAPIGatewayProxyHandler.server";
import sendEmail from "@dvargas92495/app/backend/sendEmail.server";
import { appsById } from "package/internal/apps";
import { z } from "zod";
import getMysql from "fuegojs/utils/mysql";
import { Notebook } from "package/internal/types";
import AtJsonParserErrorEmail from "~/components/AtJsonParserErrorEmail";
import { v4 } from "uuid";
import uploadFile from "@dvargas92495/app/backend/uploadFile.server";

const zBody = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("at-json-parser"),
    results: z.unknown().array(),
    input: z.string(),
    app: z.number(),
  }),
  z.object({
    method: z.literal("message-handler-failed"),
    notebookUuid: z.string(),
    message: z.string(),
    data: z.record(z.unknown()),
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
  }),
]);

const logic = async (body: Record<string, unknown>) => {
  const args = zBody.parse(body);
  if (process.env.NODE_ENV === "development") {
    console.error(args);
    return { success: true };
  }
  switch (args.method) {
    case "at-json-parser": {
      const { app, input, results } = args;
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
        }`,
        body: AtJsonParserErrorEmail({ uuid }),
      });
      return { success: true };
    }
    case "message-handler-failed": {
      const { notebookUuid, data, message } = args;
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
        body: `App: ${appsById[notebook.app]}\n\nWorkspace: ${
          notebook.workspace
        }\n\nContext: ${JSON.stringify(data, null, 4)}`,
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
      const { label, stack } = args;
      await sendEmail({
        to: "support@samepage.network",
        subject: `SamePage webapp path failed: /${label}`,
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
