import createAPIGatewayProxyHandler from "@dvargas92495/app/backend/createAPIGatewayProxyHandler.server";
import sendEmail from "@dvargas92495/app/backend/sendEmail.server";
import { appsById } from "package/internal/apps";
import { z } from "zod";

const zBody = z.object({
  method: z.literal("at-json-parser"),
  results: z.any(),
  input: z.string(),
  app: z.number(),
});

const logic = async (body: Record<string, unknown>) => {
  const { method, ...args } = zBody.parse(body);
  switch (method) {
    case "at-json-parser": {
      const { app, input, results } = args;
      await sendEmail({
        to: "support@samepage.network",
        subject: `New AtJsonParser error in app ${
          appsById[app]?.name || "Unknown"
        }`,
        body: `Input: ${input}\n\nResults: ${JSON.stringify(results, null, 4)}`,
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
