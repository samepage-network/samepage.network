import {
  padawanMissionSteps,
  padawanMissions,
  padawanMissionEvents,
} from "data/schema";
import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";
import { BackendRequest } from "package/internal/types";
import { z } from "zod";
import getMysql from "~/data/mysql.server";
import crypto from "crypto";
import uploadFile from "~/data/uploadFile.server";
import { desc, eq } from "drizzle-orm/expressions";
import { v4 } from "uuid";

const bodySchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("CREATE"),
    missionUuid: z.string(),
    label: z.string(),
  }),
  z.object({
    method: z.literal("ADD_STEP"),
    missionUuid: z.string(),
    step: z.object({
      thought: z.string(),
      action: z.string(),
      actionInput: z.string(),
      uuid: z.string(),
      generation: z.string(),
    }),
  }),
  z.object({
    method: z.literal("RECORD_OBSERVATION"),
    stepUuid: z.string(),
    observation: z.string(),
  }),
  z.object({
    method: z.literal("GET_STATUS"),
    missionUuid: z.string(),
  }),
  z.object({
    method: z.literal("FINISH_MISSION"),
    finish: z.string(),
    missionUuid: z.string(),
  }),
]);

const logic = async (args: BackendRequest<typeof bodySchema>) => {
  const cxn = await getMysql(args.requestId);
  const { method } = args;
  try {
    if (method === "CREATE") {
      const { missionUuid, label } = args;
      await cxn.insert(padawanMissions).values({
        uuid: missionUuid,
        label,
        startDate: new Date(),
      });
    } else if (method === "ADD_STEP") {
      const { missionUuid, step } = args;
      const { uuid, ...stepData } = step;
      const executionDate = new Date();
      const hash = crypto
        .createHash("sha256")
        .update(executionDate.toJSON())
        .update(stepData.thought)
        .update(stepData.action)
        .update(stepData.actionInput)
        .update(stepData.generation)
        .digest("hex");
      await uploadFile({
        Key: `data/padawan/steps/${hash}.json`,
        Body: JSON.stringify(stepData),
      });
      await cxn.insert(padawanMissionSteps).values({
        uuid: step.uuid,
        missionUuid,
        stepHash: hash,
        executionDate: new Date(),
      });
    } else if (method === "RECORD_OBSERVATION") {
      const [step] = await cxn
        .select({ stepHash: padawanMissionSteps.stepHash })
        .from(padawanMissionSteps)
        .where(eq(padawanMissionSteps.uuid, args.stepUuid));
      if (step) {
        await uploadFile({
          Key: `data/padawan/observations/${step.stepHash}.json`,
          Body: JSON.stringify({
            observation: args.observation,
            completionDate: new Date().toJSON(),
          }),
        });
      }
    } else if (method === "GET_STATUS") {
      const [mission] = await cxn
        .select({ status: padawanMissionEvents.status })
        .from(padawanMissionEvents)
        .where(eq(padawanMissionEvents.missionUuid, args.missionUuid))
        .orderBy(desc(padawanMissionEvents.createdDate))
        .limit(1);
      await cxn.end();
      return { success: true, status: mission?.status };
    } else if (method === "FINISH_MISSION") {
      const { missionUuid, finish } = args;
      const eventUuid = v4();
      await cxn.insert(padawanMissionEvents).values({
        uuid: eventUuid,
        missionUuid,
        status: "FINISHED",
        createdDate: new Date(),
      });
      await uploadFile({
        Key: `data/padawan/events/${eventUuid}.json`,
        Body: JSON.stringify({
          finish,
        }),
      });
    }
    await cxn.end();
    return { success: true };
  } catch (e) {
    console.log("padawan webhook error", e);
    return { success: false, error: (e as Error).message };
  }
};

export default createAPIGatewayProxyHandler({ logic, bodySchema });
