import { apps, employeeInboxMessages } from "data/schema";
import { eq } from "drizzle-orm/expressions";
import uploadFileContent from "package/backend/uploadFileContent";
import createAPIGatewayHandler from "samepage/backend/createAPIGatewayProxyHandler";
import { v4 } from "uuid";
import { z } from "zod";
import getMysql from "~/data/mysql.server";

const zEventBase = z.object({
  event_ts: z.string(),
  user: z.string(),
  ts: z.string(),
});

const zEvent = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("app_mention"),
      text: z.string(),
      channel: z.string(),
    })
    .merge(zEventBase),
  z
    .object({
      type: z.literal("message.im"),
      channel_type: z.literal("im"),
      text: z.string(),
      channel: z.string(),
    })
    .merge(zEventBase),
]);

const zArgs = z
  .discriminatedUnion("type", [
    z.object({
      challenge: z.string(),
      type: z.literal("url_verification"),
      token: z.string(),
    }),
    z.object({
      type: z.literal("event_callback"),
      token: z.string(),
      team_id: z.string(),
      api_app_id: z.string(),
      event: zEvent,
      event_context: z.string(),
      event_id: z.string(),
      event_time: z.number(),
      authorizations: z
        .object({
          enterprise_id: z.string().nullable(),
          team_id: z.string(),
          user_id: z.string(),
          is_bot: z.boolean(),
          is_enterprise_install: z.boolean(),
        })
        .array(),
      is_ext_shared_channel: z.boolean(),
      context_team_id: z.string().nullable().optional(),
      context_enterprise_id: z.string().nullable().optional(),
    }),
  ])
  .and(z.object({ requestId: z.string() }));

const processSlackEvent = async (
  event: z.infer<typeof zEvent>,
  requestId: string,
  eventId: string
) => {
  const cxn = await getMysql(requestId);
  const [{ appId }] = await cxn
    .select({ appId: apps.id })
    .from(apps)
    .where(eq(apps.code, "slack"));
  const uuid = v4();
  const path = `data/inbox/${uuid}`;
  switch (event.type) {
    case "app_mention": {
      const { user, text, channel } = event;
      await uploadFileContent({ Key: path, Body: text });
      await cxn.insert(employeeInboxMessages).values({
        status: "unread",
        eventId,
        appId,
        createdDate: new Date(Number(event.ts) * 1000),
        uuid,
        from: user,
        context: {
          channel,
          type: "app_mention",
        },
      });
      return {
        uuid,
      };
    }
    case "message.im": {
      const { user, text, channel } = event;
      await uploadFileContent({ Key: path, Body: text });
      await cxn.insert(employeeInboxMessages).values({
        status: "unread",
        eventId,
        appId,
        createdDate: new Date(Number(event.ts) * 1000),
        uuid,
        from: user,
        context: {
          channel,
          type: "message.im",
        },
      });
      return {
        user,
        text,
      };
    }
    default: {
      throw new Error(`Unexpected event type: ${event["type"]}`);
    }
  }
};

const logic = async (evt: unknown) => {
  console.log("evt", evt);
  const args = zArgs.parse(evt);
  switch (args.type) {
    case "url_verification": {
      const { challenge } = args;
      return {
        challenge,
      };
    }
    case "event_callback": {
      return processSlackEvent(args.event, args.requestId, args.event_id);
    }
    default: {
      throw new Error(`Unexpected request type: ${args["type"]}`);
    }
  }
};

export default createAPIGatewayHandler(logic);
